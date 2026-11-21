// Business logic for IT Manager. Pure TypeScript with no Node or DOM dependencies, so the same code runs
// behind the Express API (server/index.ts) and inside the browser for the offline demo build.
import type {
  LiveUsage, Access, App, AppDetail, AppStatus, AppSummary, Attachment, AttachmentMeta, Change, CoverShot, Screenshot, ScreenshotMeta, DashboardStats, DB, Doc, DocKind,
  ImportResult, Launch, LogEntry, Paged, Priority, Role, Task, TaskGroup, Tone, UsageEntry, UsageSummary, User, UserRecord,
} from "./types";
import { APP_STATUSES, DOC_KINDS, HOSTINGS, PRIORITIES, TICKET_RULE_FIELDS } from "./types";
import type { AppUser, AppUserRow, Ticket, TicketCounts, TicketRow, TicketRuleField } from "./types";
import { hashPassword, newSalt, newToken, verifyPassword } from "./crypto";
import { addDays, normalizeDate, nowIso, splitList, toBool, toNumber, uid, ymd } from "./util";
import { emptyDb, freshDb, sampleDb } from "./seed";
import { LANDSCAPE, landscapeItemFor } from "./landscape";
import { detailsFor, RETIRED_DOC_TITLES, RETIRED_TASK_TITLES } from "./details";

export interface Store {
  load(): Promise<DB | null>;
  save(db: DB): Promise<void>;
}

export interface ChangeEvent {
  method: string;
  userId: string;
  userName: string;
  appId: string | null;
  summary: string;
  at: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Ctx = { user: UserRecord };
type Handler = (ctx: Ctx, params: any) => unknown | Promise<unknown>;

const SESSION_DAYS = 7;
const MAX_LOGS = 25_000;
const MAX_ATTACHMENT = 8 * 1024 * 1024;

const USER_EDITABLE = ["name", "email", "title", "department", "bio", "avatar", "tone"] as const;
const APP_FIELDS = [
  "name", "code", "tagline", "description", "category", "department", "status", "priority", "url", "environments",
  "techStack", "ownerId", "version", "cover", "tone", "startDate", "goLiveDate", "seats", "activeUsersManual", "hosting", "source", "vendor", "ticketKeywords", "logo",
] as const;

function publicUser(u: UserRecord): User {
  const { salt: _s, passwordHash: _p, ...rest } = u;
  return rest;
}

function clean(s: unknown, max = 500) {
  return String(s ?? "").trim().slice(0, max);
}

function pick<T extends object>(obj: T, keys: readonly (keyof T)[]) {
  const out: Partial<T> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

function sameValue(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diff(before: object, after: object, keys: readonly string[]): Change[] {
  const changes: Change[] = [];
  for (const k of keys) {
    const from = (before as Record<string, unknown>)[k];
    const to = (after as Record<string, unknown>)[k];
    if (!sameValue(from, to)) changes.push({ field: k, from: k === "cover" || k === "avatar" ? "(image)" : from, to: k === "cover" || k === "avatar" ? "(image)" : to });
  }
  return changes;
}

const CLOSED_STATUS = /resolv|clos|cancel|complet|reject|done/i;
export { CLOSED_STATUS };

export class Service {
  db: DB = emptyDb();
  private saving: Promise<void> = Promise.resolve();
  private methods: Record<string, { handler: Handler; public?: boolean; write?: boolean }> = {};
  /** Live-refresh listeners: called after every saved change (the server fans this out to open browsers). */
  private listeners = new Set<(e: ChangeEvent) => void>();
  onChange(fn: (e: ChangeEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emitChange(e: ChangeEvent) {
    for (const fn of this.listeners) { try { fn(e); } catch { /* a dead listener must not break writes */ } }
  }

  constructor(private store: Store, private options: { seed: boolean; logoUrl?: (app: App) => string } = { seed: true }) {
    this.register();
  }

  async init() {
    const loaded = await this.store.load();
    if (loaded && loaded.users?.length) {
      this.db = this.migrate(loaded);
      for (const a of this.db.apps) if (a.source === "vendor" && !a.url) { const li = landscapeItemFor(a.name); if (li?.url) a.url = li.url; }
      // one-time: bring in the vendor apps from the Smartworld landscape if none exist yet
      const admin = this.db.users.find((u) => u.role === "admin" && u.active);
      if (admin && !this.db.apps.some((a) => a.source === "vendor") && !this.db.logs.some((l) => l.summary.startsWith("Loaded the application landscape"))) {
        const r = this.loadLandscape({ user: admin });
        console.log(`[landscape] added ${r.created} vendor apps, updated ${r.updated}`);
        await this.persist();
      }
      // one-time: real details for every app (replaces the sample About text and placeholder dates)
      const adminU = this.db.users.find((u) => u.role === "admin" && u.active);
      if (adminU && !this.db.logs.some((l) => l.summary.startsWith("Filled application details (user view)"))) {
        const r = this.fillDetails({ user: adminU }, "overwrite");
        console.log(`[details] filled ${r.apps} apps (${r.docs} docs, ${r.releases} releases, ${r.tasks} tasks)`);
        await this.persist();
      }
    }
    else {
      this.db = this.options.seed ? await sampleDb() : await freshDb();
      await this.persist();
    }
    return this;
  }

  private migrate(db: DB): DB {
    const base = emptyDb();
    const out = { ...base, ...db, version: 2 };
    for (const t of out.tasks) if (t.assignee) t.assignee = this.assigneeName(t.assignee, out.users);
    for (const a of out.apps) {
      if (a.coverShotId === undefined) a.coverShotId = null;
      if (a.seats === undefined) a.seats = 0;
      if (a.activeUsersManual === undefined) a.activeUsersManual = 0;
      if (a.hosting === undefined) a.hosting = "on-prem"; // existing apps were all built in-house and hosted on the LAN
      if (a.source === undefined) a.source = "in-house";
      if (a.vendor === undefined) a.vendor = "";
      if (!Array.isArray(a.ticketKeywords)) a.ticketKeywords = [];
      if (a.logo === undefined) a.logo = "";
      delete (a as { repoUrl?: string }).repoUrl; // repository links are no longer kept
    }
    return out;
  }

  private persist() {
    // Serialize saves so a slow disk never interleaves two writes.
    this.saving = this.saving.then(() => this.store.save(this.db)).catch((e) => console.error("[store] save failed", e));
    return this.saving;
  }

  /* --------------------------------------------------- entry point --------------------------------------------------- */

  async call(method: string, params: unknown, token: string | null) {
    const def = this.methods[method];
    if (!def) throw new ApiError(404, `Unknown method: ${method}`);
    if (def.public) return def.handler({ user: null as unknown as UserRecord }, params ?? {});
    const user = this.authenticate(token);
    if (!user) throw new ApiError(401, "Your session has expired. Please sign in again.");
    const result = await def.handler({ user }, params ?? {});
    if (def.write) {
      this.ticketIndex = null;
      await this.persist();
      const last = this.db.logs[0];
      this.emitChange({ method, userId: user.id, userName: user.name, appId: last?.appId ?? null, summary: last && last.userId === user.id ? last.summary : "", at: nowIso() });
    }
    return result;
  }

  authenticate(token: string | null) {
    if (!token) return null;
    const session = this.db.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt < nowIso()) return null;
    const user = this.db.users.find((u) => u.id === session.userId);
    return user && user.active ? user : null;
  }

  /* --------------------------------------------------- permissions --------------------------------------------------- */

  permission(user: UserRecord, app: App): Access | null {
    if (user.role === "admin") return "edit";
    const grant = app.acl?.[user.id];
    if (grant) return grant;
    if (app.ownerId === user.id || app.createdBy === user.id) return user.role === "viewer" ? "view" : "edit";
    if (app.visibility === "restricted") return null;
    return user.role === "editor" ? "edit" : "view";
  }

  private app(ctx: Ctx, appId: string, need: Access) {
    const app = this.db.apps.find((a) => a.id === appId);
    if (!app) throw new ApiError(404, "Application not found.");
    const perm = this.permission(ctx.user, app);
    if (!perm) throw new ApiError(403, "You don't have access to this application.");
    if (need === "edit" && perm !== "edit") throw new ApiError(403, `You have view-only rights on ${app.name}.`);
    return app;
  }

  private admin(ctx: Ctx) {
    if (ctx.user.role !== "admin") throw new ApiError(403, "Only administrators can do this.");
  }

  private visibleApps(user: UserRecord) {
    return this.db.apps.filter((a) => this.permission(user, a));
  }

  /* ------------------------------------------------------ logs ------------------------------------------------------- */

  private log(ctx: Ctx | null, action: string, entity: string, entityId: string | null, app: App | null, summary: string, changes: Change[] = []) {
    const entry: LogEntry = {
      id: uid(), at: nowIso(), userId: ctx?.user?.id ?? null, userName: ctx?.user?.name ?? "System", action, entity, entityId,
      appId: app?.id ?? null, appName: app?.name ?? null, summary, changes,
    };
    this.db.logs.unshift(entry);
    if (this.db.logs.length > MAX_LOGS) this.db.logs.length = MAX_LOGS;
  }

  private touch(app: App) {
    app.updatedAt = nowIso();
  }

  /* ---------------------------------------------------- summaries ---------------------------------------------------- */

  usageSummary(appIds: Set<string> | string): UsageSummary {
    const ids = typeof appIds === "string" ? new Set([appIds]) : appIds;
    const today = ymd();
    const from30 = addDays(today, -29);
    const from60 = addDays(today, -59);
    const from14 = addDays(today, -13);
    let sessions30 = 0, sessionsPrev30 = 0, transactions30 = 0;
    const perDay = new Map<string, number>();
    const latestByApp = new Map<string, UsageEntry>();
    let lastEntry: string | null = null;
    for (const u of this.db.usage) {
      if (!ids.has(u.appId)) continue;
      if (u.date >= from30 && u.date <= today) { sessions30 += u.sessions; transactions30 += u.transactions; }
      else if (u.date >= from60 && u.date < from30) sessionsPrev30 += u.sessions;
      if (u.date >= from14 && u.date <= today) perDay.set(u.date, (perDay.get(u.date) ?? 0) + u.sessions);
      const prev = latestByApp.get(u.appId);
      if (!prev || u.date > prev.date) latestByApp.set(u.appId, u);
      if (!lastEntry || u.date > lastEntry) lastEntry = u.date;
    }
    const since = from30 + "T00:00:00";
    const launches30 = this.db.launches.filter((l) => ids.has(l.appId) && l.at >= new Date(since).toISOString()).length;
    const spark = Array.from({ length: 14 }, (_, i) => perDay.get(addDays(from14, i)) ?? 0);
    const activeUsers = [...latestByApp.values()].reduce((s, u) => s + u.activeUsers, 0);
    const trend = sessionsPrev30 ? Math.round(((sessions30 - sessionsPrev30) / sessionsPrev30) * 1000) / 10 : sessions30 ? 100 : 0;
    return { sessions30, sessionsPrev30, trend, activeUsers, transactions30, launches30, lastEntry, spark };
  }

  private summarize(user: UserRecord, app: App): AppSummary {
    const tasks = this.db.tasks.filter((t) => t.appId === app.id);
    const done = tasks.filter((t) => t.done).length;
    const today = ymd();
    const owner = this.db.users.find((u) => u.id === app.ownerId);
    return {
      ...app,
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      tasksDone: done,
      tasksTotal: tasks.length,
      overdue: tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length,
      usage: this.usageSummary(app.id),
      permission: this.permission(user, app) ?? "view",
      favorite: this.db.favorites.some((f) => f.userId === user.id && f.appId === app.id),
      ownerName: owner?.name ?? "",
      docCount: this.db.docs.filter((d) => d.appId === app.id).length,
      coverShot: this.coverShot(app),
      landscape: this.landscapeOf(app),
      ...(app.logo && this.options.logoUrl ? { logo: this.options.logoUrl(app) } : {}),
      tickets: this.ticketCounts(app.id),
      people: this.peopleCounts(app.id),
      shotCount: this.db.screenshots.filter((x) => x.appId === app.id).length,
    };
  }

  /** Map typed/imported assignees ("Priya, rahul; anirudh") to real users' full names. Unknown names are dropped. */
  assigneeName(raw: unknown, users = this.db.users) {
    const one = (v: string) => {
      v = v.trim().toLowerCase();
      if (!v) return "";
      const exact = users.find((u) => u.name.toLowerCase() === v || u.username.toLowerCase() === v || (u.email && u.email.toLowerCase() === v));
      if (exact) return exact.name;
      const byFirst = users.filter((u) => u.name.split(/\s+/)[0]!.toLowerCase() === v);
      return byFirst.length === 1 ? byFirst[0]!.name : "";
    };
    const list = (Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split(/[,;|]/)).map(one).filter(Boolean);
    return [...new Set(list)].join(", ").slice(0, 400);
  }

  /** Active users for licence utilization: tracker data (peak day, last 30 days) first, then the figure typed on the app, then logged usage. */
  private landscapeOf(app: App): AppSummary["landscape"] {
    const from = addDays(ymd(), -29);
    let tracked = 0, logged = 0;
    for (const u of this.db.usage) {
      if (u.appId !== app.id || u.date < from) continue;
      if (u.source === "auto") tracked = Math.max(tracked, u.activeUsers);
      else logged = Math.max(logged, u.activeUsers);
    }
    const listed = this.db.appUsers.filter((u) => u.appId === app.id).length;
    const activeUsers = tracked || app.activeUsersManual || listed || logged;
    const activeSource = tracked ? "tracked" : app.activeUsersManual || listed ? "manual" : logged ? "logged" : "none";
    return { activeUsers, activeSource, utilization: app.seats && activeUsers ? Math.round((activeUsers / app.seats) * 100) : app.seats ? 0 : null };
  }

  private coverShot(app: App): CoverShot {
    const shot = (app.coverShotId && this.db.screenshots.find((x) => x.id === app.coverShotId)) || this.db.screenshots.filter((x) => x.appId === app.id).sort((a, b) => a.order - b.order)[0];
    return shot ? { id: shot.id, width: shot.width, height: shot.height } : null;
  }

  /** Store a screenshot (used by the API methods and the server's capture endpoint). */
  addScreenshot(user: UserRecord, appId: string, p: { dataUrl: string; width?: number; height?: number; caption?: string; source?: Screenshot["source"]; url?: string; setCover?: boolean }) {
    const ctx = { user };
    const app = this.app(ctx, appId, "edit");
    const dataUrl = String(p.dataUrl ?? "");
    if (!/^data:image\//.test(dataUrl)) throw new ApiError(400, "Screenshots must be images.");
    if (dataUrl.length > 9_000_000) throw new ApiError(413, "Screenshot is too large (max ~6 MB).");
    const shot: Screenshot = {
      id: uid(), appId: app.id, dataUrl, width: Math.max(1, Math.round(Number(p.width) || 1600)), height: Math.max(1, Math.round(Number(p.height) || 1000)),
      caption: clean(p.caption, 200), source: p.source === "capture" || p.source === "paste" ? p.source : "upload", url: clean(p.url, 500),
      order: this.db.screenshots.filter((x) => x.appId === app.id).length, createdAt: nowIso(), createdBy: user.name,
    };
    this.db.screenshots.push(shot);
    if (p.setCover || !app.coverShotId) app.coverShotId = shot.id;
    this.touch(app);
    this.log(ctx, shot.source === "capture" ? "capture" : "upload", "screenshot", shot.id, app,
      shot.source === "capture" ? `Captured a screenshot of ${app.name}${shot.url ? ` from ${shot.url}` : ""}` : `Added a screenshot to ${app.name}${shot.caption ? ` — ${shot.caption}` : ""}`);
    const { dataUrl: _d, ...meta } = shot;
    return meta as ScreenshotMeta;
  }

  /** Raw image bytes for the server's /api/shot/:id route (view permission required). */
  screenshotFor(user: UserRecord, id: string) {
    const shot = this.db.screenshots.find((x) => x.id === id);
    if (!shot) return null;
    const app = this.db.apps.find((a) => a.id === shot.appId);
    if (!app || !this.permission(user, app)) return null;
    return shot;
  }

  /* ------------------------------------------- usage tracking (track.js) ------------------------------------------- */

  /** Record a beacon from the tracking script. Public (no login): only counts visits for a known app code. */
  track(e: { app?: string; sid?: string; vid?: string; user?: string; page?: string; ev?: string }) {
    const key = clean(e.app, 60).toLowerCase();
    const app = this.db.apps.find((a) => a.code.toLowerCase() === key || a.id === key);
    if (!app) return null;
    const sid = clean(e.sid, 64);
    if (!sid) return null;
    const now = Date.now();
    const date = ymd();
    const id = `${app.id}:${sid}`;
    let s = this.db.tracking.find((x) => x.id === id && x.date === date);
    if (!s) {
      s = { id, appId: app.id, date, sid, visitor: clean(e.vid, 64), user: clean(e.user, 120), first: now, last: now, pages: {}, hits: 0 };
      this.db.tracking.push(s);
    }
    s.last = now;
    s.hits++;
    const who = clean(e.user, 120) || s.user;
    const newSessionForUser = !!who && (s.hits === 1 || !s.user);
    if (e.user) s.user = clean(e.user, 120);
    if (who) this.seen(app.id, who, now, date, newSessionForUser);
    const page = clean(e.page, 200) || "/";
    if (e.ev === "start" || e.ev === "page") s.pages[page] = (s.pages[page] ?? 0) + 1;
    this.rollUp(app.id, date);
    return app;
  }

  /** Per-user "last seen" kept for 90 days (raw sessions are pruned after 3). */
  private seen(appId: string, user: string, now: number, date: string, newSession: boolean) {
    const id = `${appId}|${user.toLowerCase()}`;
    let r = this.db.appSeen.find((x) => x.id === id);
    if (!r) { r = { id, appId, user, first: now, last: now, sessions: 0, days: [] }; this.db.appSeen.push(r); }
    r.last = now;
    r.user = user;
    if (newSession) r.sessions++;
    if (r.days[r.days.length - 1] !== date) {
      r.days.push(date);
      const cutoff = addDays(ymd(), -89);
      r.days = r.days.filter((d) => d >= cutoff);
    }
  }

  /** Listed users merged with people the tracker saw. Matched by email, then by name (case-insensitive). */
  appUserRows(appId: string): AppUserRow[] {
    const from30 = addDays(ymd(), -29);
    const rows: AppUserRow[] = this.db.appUsers.filter((u) => u.appId === appId).map((u) => ({
      key: u.id, listedId: u.id, name: u.name, email: u.email, department: u.department, licence: u.licence, notes: u.notes,
      tracked: false, lastSeen: null, activeDays30: 0, sessions: 0,
    }));
    const people = new Map(this.db.users.map((u) => [u.username.toLowerCase(), u]));
    for (const s of this.db.appSeen.filter((x) => x.appId === appId)) {
      const k = s.user.toLowerCase();
      const row = rows.find((r) => (r.email && r.email.toLowerCase() === k) || r.name.toLowerCase() === k);
      const seen = { tracked: true, lastSeen: new Date(s.last).toISOString(), activeDays30: s.days.filter((d) => d >= from30).length, sessions: s.sessions };
      if (row) Object.assign(row, seen);
      else {
        const known = people.get(k);
        rows.push({ key: s.id, listedId: null, name: known?.name ?? s.user, email: s.user.includes("@") ? s.user : known?.email ?? "", department: known?.department ?? "", licence: "", notes: "", ...seen });
      }
    }
    return rows.sort((a, b) => (b.lastSeen ?? "").localeCompare(a.lastSeen ?? "") || a.name.localeCompare(b.name));
  }

  private peopleCounts(appId: string) {
    const from30 = addDays(ymd(), -29);
    return {
      listed: this.db.appUsers.filter((u) => u.appId === appId).length,
      seen30: this.db.appSeen.filter((x) => x.appId === appId && x.days.some((d) => d >= from30)).length,
    };
  }

  /** Recompute the day's automatic usage entry from tracked sessions (keeps manual transactions & notes). */
  private rollUp(appId: string, date: string) {
    const list = this.db.tracking.filter((x) => x.appId === appId && x.date === date);
    const users = new Set(list.map((x) => x.user || x.visitor || x.sid));
    const minutes = list.map((x) => Math.max(0.5, (x.last - x.first) / 60000));
    const avg = minutes.length ? Math.round((minutes.reduce((a, b) => a + b, 0) / minutes.length) * 10) / 10 : 0;
    let entry = this.db.usage.find((u) => u.appId === appId && u.date === date);
    if (!entry) {
      entry = { id: uid(), appId, date, activeUsers: 0, sessions: 0, transactions: 0, avgMinutes: 0, notes: "", source: "auto", createdAt: nowIso() };
      this.db.usage.push(entry);
    }
    entry.activeUsers = users.size;
    entry.sessions = list.length;
    entry.avgMinutes = avg;
    if (entry.source !== "manual") entry.source = "auto";
  }

  /** Drop tracked sessions older than a few days (daily totals stay in usage entries). */
  pruneTracking(days = 3) {
    const cutoff = ymd(new Date(Date.now() - days * 864e5));
    const before = this.db.tracking.length;
    this.db.tracking = this.db.tracking.filter((x) => x.date >= cutoff);
    return before - this.db.tracking.length;
  }

  liveUsage(appId: string): LiveUsage {
    const today = ymd();
    const all = this.db.tracking.filter((x) => x.appId === appId);
    const list = all.filter((x) => x.date === today);
    const now = Date.now();
    const hours = Array.from({ length: 24 }, () => 0);
    const pages = new Map<string, number>();
    const users = new Map<string, { sessions: number; minutes: number }>();
    for (const s of list) {
      hours[new Date(s.first).getHours()]!++;
      for (const [p, n] of Object.entries(s.pages)) pages.set(p, (pages.get(p) ?? 0) + n);
      if (s.user) {
        const u = users.get(s.user) ?? { sessions: 0, minutes: 0 };
        u.sessions++;
        u.minutes += Math.max(0.5, (s.last - s.first) / 60000);
        users.set(s.user, u);
      }
    }
    const uniq = new Set(list.map((x) => x.user || x.visitor || x.sid));
    const mins = list.map((x) => Math.max(0.5, (x.last - x.first) / 60000));
    return {
      activeNow: list.filter((x) => now - x.last < 2.5 * 60_000).length,
      today: { sessions: list.length, users: uniq.size, avgMinutes: mins.length ? Math.round((mins.reduce((a, b) => a + b, 0) / mins.length) * 10) / 10 : 0 },
      hours,
      topPages: [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([page, views]) => ({ page, views })),
      topUsers: [...users.entries()].sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 8).map(([user, v]) => ({ user, sessions: v.sessions, minutes: Math.round(v.minutes) })),
      lastSeen: all.length ? Math.max(...all.map((x) => x.last)) : null,
      tracking: all.length > 0,
    };
  }

  async persistNow() {
    await this.persist();
  }




  /** Fill About fields, docs, releases and open items from details.ts.
   *  mode "overwrite" replaces the About fields (first run); "fill" only fills empty ones. Docs / releases / tasks are only ever added. */
  fillDetails(ctx: Ctx, mode: "overwrite" | "fill" = "fill") {
    const admin = ctx.user;
    let apps = 0, docs = 0, releases = 0, tasks = 0;
    if (mode === "overwrite") {
      // drop the first, technical version of the generated docs / tasks (and headings left empty by that)
      const oldDocs = new Set(RETIRED_DOC_TITLES.map((t) => t.toLowerCase()));
      const oldTasks = new Set(RETIRED_TASK_TITLES.map((t) => t.toLowerCase()));
      // technical notes are not for users: the generated ones and the sample "Technical notes" pages go
      this.db.docs = this.db.docs.filter((d) => !oldDocs.has(d.title.toLowerCase()) && !(d.kind === "technical" && d.title.toLowerCase() === "technical notes"));
      // the generic sample "User manual" is replaced by the app's real user guide
      const guides = new Set(this.db.apps.filter((a) => detailsFor(a)?.docs?.some((x) => x.kind === "manual")).map((a) => a.id));
      this.db.docs = this.db.docs.filter((d) => !(guides.has(d.appId) && d.title === "User manual"));
      this.db.tasks = this.db.tasks.filter((t) => !oldTasks.has(t.title.toLowerCase()));
      const oldGroups = new Set(["go-live", "enhancements from 06-nov review", "open items", "uat", "rebuild"]);
      this.db.groups = this.db.groups.filter((g) => !oldGroups.has(g.title.toLowerCase()) || this.db.tasks.some((t) => t.groupId === g.id));
      for (const r of this.db.releases) {
        const d = detailsFor(this.db.apps.find((a) => a.id === r.appId) ?? { name: "", code: "" });
        const fresh = d?.releases?.find((x) => x.version === r.version);
        if (fresh) { r.title = fresh.title; r.notes = fresh.notes; }
      }
    }
    for (const app of this.db.apps) {
      const d = detailsFor(app);
      if (!d) continue;
      apps++;
      const put = <K extends keyof App>(k: K, v: App[K] | undefined) => {
        if (v === undefined) return;
        const cur = app[k];
        const empty = cur === "" || cur == null || (Array.isArray(cur) && !cur.length);
        if (mode === "overwrite" || empty) app[k] = v;
      };
      put("tagline", d.tagline);
      put("description", d.description);
      put("department", d.department);
      put("category", d.category);
      put("techStack", d.techStack);
      put("version", d.version);
      if (mode === "overwrite") {
        if (d.status) app.status = d.status;
        if (d.priority) app.priority = d.priority;
        app.startDate = d.startDate ?? ""; // placeholder dates go; unknown stays blank
        app.goLiveDate = d.goLiveDate ?? "";
      } else {
        put("startDate", d.startDate || undefined);
        put("goLiveDate", d.goLiveDate || undefined);
      }
      if (!app.url && d.url) app.url = d.url;
      for (const e of d.environments ?? []) if (e.url && !app.environments.some((x) => x.url === e.url)) app.environments.push(e);
      if (app.source !== "vendor" && !app.ownerId) app.ownerId = admin.id;
      for (const doc of d.docs ?? []) {
        const existing = this.db.docs.find((x) => x.appId === app.id && x.title.toLowerCase() === doc.title.toLowerCase());
        if (existing) { if (mode === "overwrite") { existing.content = doc.content; existing.kind = doc.kind; existing.updatedAt = nowIso(); } continue; }
        this.db.docs.push({ id: uid(), appId: app.id, kind: doc.kind, title: doc.title, content: doc.content, order: this.db.docs.filter((x) => x.appId === app.id).length, updatedAt: nowIso(), updatedBy: admin.name });
        docs++;
      }
      for (const r of d.releases ?? []) {
        if (this.db.releases.some((x) => x.appId === app.id && x.version === r.version)) continue;
        this.db.releases.push({ id: uid(), appId: app.id, version: r.version, date: r.date, title: r.title, notes: r.notes, createdAt: nowIso() });
        releases++;
      }
      if (d.tasks) {
        let group = this.db.groups.find((g) => g.appId === app.id && g.title.toLowerCase() === d.tasks!.group.toLowerCase());
        if (!group) { group = { id: uid(), appId: app.id, title: d.tasks.group, order: this.db.groups.filter((g) => g.appId === app.id).length, createdAt: nowIso() }; this.db.groups.push(group); }
        for (const t of d.tasks.items) {
          if (this.db.tasks.some((x) => x.appId === app.id && x.title.toLowerCase() === t.title.toLowerCase())) continue;
          this.db.tasks.push(this.buildTask(group, { ...t, assignee: app.source !== "vendor" ? admin.name : "" }, admin.name));
          tasks++;
        }
      }
      this.touch(app);
    }
    this.log(ctx, "update", "app", null, null, `Filled application details (user view): ${apps} apps, ${docs} docs, ${releases} releases, ${tasks} tasks`);
    return { apps, docs, releases, tasks };
  }

  /** Adds the vendor apps from the Smartworld landscape and fills seats / ticket keywords on matching apps. Safe to re-run. */
  loadLandscape(ctx: Ctx) {
    let created = 0, updated = 0, skipped = 0;
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "");
    for (const item of LANDSCAPE) {
      const keys = [item.name, ...(item.aliases ?? [])].map(norm);
      // vendor entries match by name only, so "VendorGlobe" never lands on the in-house "VendorGlobe API Sync"
      const existing = this.db.apps.find((a) => keys.includes(norm(a.name)) || (item.inHouse && keys.includes(norm(a.code))));
      if (existing) {
        if (!existing.seats) existing.seats = item.seats;
        if (!existing.activeUsersManual) existing.activeUsersManual = item.active;
        if (!existing.category || existing.category === "Internal tool") existing.category = item.category;
        if (!existing.hosting && item.hosting) existing.hosting = item.hosting;
        if (!existing.url && item.url && !item.inHouse) existing.url = item.url;
        const have = new Set(existing.ticketKeywords.map((k) => k.toLowerCase()));
        existing.ticketKeywords = [...existing.ticketKeywords, ...(item.keywords ?? []).filter((k) => !have.has(k.toLowerCase()))];
        this.touch(existing);
        updated++;
      } else if (item.inHouse) {
        skipped++; // your own apps are never created from the sheet — only matched ones get seat figures
      } else {
        const app = this.buildApp(ctx, {
          name: item.name, category: item.category, status: "live", seats: item.seats, activeUsersManual: item.active, hosting: item.hosting ?? "",
          source: "vendor", vendor: item.vendor ?? "", tagline: item.tagline ?? "", priority: "medium", ticketKeywords: item.keywords ?? [], url: item.url ?? "",
        });
        this.db.apps.push(app);
        created++;
      }
    }
    this.ticketIndex = null;
    this.log(ctx, "import", "app", null, null, `Loaded the application landscape: ${created} vendor apps added, ${updated} updated`);
    return { created, updated, skipped };
  }


  private dashboardExtras(user: UserRecord, apps: App[], summaries: AppSummary[], tasks: Task[], dates: string[]) {
    const today = ymd();
    const ids = new Set(apps.map((a) => a.id));
    const index = new Map(dates.map((d, i) => [d, i]));
    // per-app series for the busiest 6
    const top = [...summaries].sort((a, b) => b.usage.sessions30 - a.usage.sessions30 || b.landscape.activeUsers - a.landscape.activeUsers).slice(0, 6);
    const appSeries = top.map((a) => ({ id: a.id, name: a.name, tone: a.tone, sessions: dates.map(() => 0), users: dates.map(() => 0) }));
    const pos = new Map(appSeries.map((x, i) => [x.id, i]));
    for (const u of this.db.usage) {
      const k = pos.get(u.appId); const i = index.get(u.date);
      if (k !== undefined && i !== undefined) { appSeries[k]!.sessions[i] += u.sessions; appSeries[k]!.users[i] += u.activeUsers; }
    }
    // tickets
    const match = this.ticketMatches();
    const rows = this.db.tickets.filter((t) => { const a = match.get(t.id)?.appId; return a ? ids.has(a) : user.role !== "viewer"; });
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString(), since60 = new Date(Date.now() - 60 * 864e5).toISOString();
    const from14 = addDays(today, -13);
    const perDay = Array.from({ length: 14 }, (_, i) => ({ date: addDays(from14, i), created: 0, closed: 0 }));
    const dayIdx = new Map(perDay.map((d, i) => [d.date, i]));
    const byApp = new Map<string, { open: number; high: number }>();
    const isHigh = (p: string) => /high|urgent|critical|p1|p2/i.test(p);
    for (const t of rows) {
      const c = dayIdx.get(ymd(new Date(t.createdAt))); if (c !== undefined) perDay[c]!.created++;
      if (!t.open && t.closedAt) { const d = dayIdx.get(ymd(new Date(t.closedAt))); if (d !== undefined) perDay[d]!.closed++; }
      const a = match.get(t.id)?.appId;
      if (a && t.open) { const e = byApp.get(a) ?? { open: 0, high: 0 }; e.open++; if (isHigh(t.priority)) e.high++; byApp.set(a, e); }
    }
    const names = new Map(apps.map((a) => [a.id, a]));
    const open = rows.filter((t) => t.open);
    const rank = (p: string) => (/urgent|critical|p1/i.test(p) ? 0 : /high|p2/i.test(p) ? 1 : /medium|normal/i.test(p) ? 2 : 3);
    const tickets = {
      open: open.length, high: open.filter((t) => isHigh(t.priority)).length,
      created30: rows.filter((t) => t.createdAt >= since30).length, prevCreated30: rows.filter((t) => t.createdAt >= since60 && t.createdAt < since30).length,
      closed30: rows.filter((t) => !t.open && (t.closedAt || t.createdAt) >= since30).length,
      unmatched: open.filter((t) => !match.get(t.id)?.appId).length,
      perDay,
      byApp: [...byApp.entries()].map(([id, e]) => ({ id, name: names.get(id)?.name ?? "", tone: names.get(id)?.tone ?? 1, ...e })).sort((a, b) => b.open - a.open).slice(0, 8),
      latest: [...open].sort((a, b) => rank(a.priority) - rank(b.priority) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((t) => {
        const a = match.get(t.id)?.appId ?? null;
        return { id: t.id, displayId: t.displayId, subject: t.subject, priority: t.priority, status: t.status, appId: a, appName: a ? names.get(a)?.name ?? "" : "", createdAt: t.createdAt, url: t.url, technician: t.technician };
      }),
      lastSync: this.db.ticketSync.lastOk,
    };
    // seats
    const withSeats = summaries.filter((a) => a.seats > 0);
    const seatsTotal = withSeats.reduce((n, a) => n + a.seats, 0);
    const activeOnSeats = withSeats.reduce((n, a) => n + Math.min(a.landscape.activeUsers, a.seats * 5), 0);
    const seats = {
      seats: seatsTotal, active: summaries.reduce((n, a) => n + a.landscape.activeUsers, 0), util: seatsTotal ? Math.round((activeOnSeats / seatsTotal) * 100) : null,
      under: withSeats.filter((a) => (a.landscape.utilization ?? 100) < 60).sort((a, b) => (a.landscape.utilization ?? 0) - (b.landscape.utilization ?? 0)).slice(0, 6)
        .map((a) => ({ id: a.id, name: a.name, tone: a.tone, util: a.landscape.utilization ?? 0, active: a.landscape.activeUsers, seats: a.seats })),
    };
    const hostCount = new Map<string, number>();
    for (const a of apps) hostCount.set(a.hosting || "", (hostCount.get(a.hosting || "") ?? 0) + 1);
    const mix = { inHouse: apps.filter((a) => a.source !== "vendor").length, vendor: apps.filter((a) => a.source === "vendor").length, hosting: [...hostCount.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count) };
    // workload per assignee
    const load = new Map<string, { open: number; overdue: number }>();
    for (const t of tasks) {
      if (t.done) continue;
      for (const n of String(t.assignee || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
        const e = load.get(n) ?? { open: 0, overdue: 0 }; e.open++; if (t.dueDate && t.dueDate < today) e.overdue++; load.set(n, e);
      }
    }
    const workload = [...load.entries()].map(([name, e]) => ({ name, ...e })).sort((a, b) => b.open - a.open).slice(0, 6);
    const calendar: Record<string, number> = {};
    const cFrom = addDays(today, -7), cTo = addDays(today, 45);
    for (const t of tasks) if (!t.done && t.dueDate && t.dueDate >= cFrom && t.dueDate <= cTo) calendar[t.dueDate] = (calendar[t.dueDate] ?? 0) + 1;
    const people = summaries.reduce((acc, a) => ({ listed: acc.listed + a.people.listed, seen30: acc.seen30 + a.people.seen30 }), { listed: 0, seen30: 0 });
    return { appSeries, tickets, seats, mix, workload, calendar, people };
  }

  /* ---------------------------------------------------- tickets ----------------------------------------------------- */

  /** ticket id → { appId, matchedBy }. Rebuilt lazily after any write or sync. */
  private ticketIndex: Map<string, { appId: string | null; matchedBy: TicketRow["matchedBy"] }> | null = null;

  private ticketMatcher() {
    const STOP = new Set(["its", "it", "one", "all", "app", "portal", "sync", "api", "the", "and", "flow", "review", "register", "dashboard", "desk", "client"]);
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const terms: { re: RegExp; len: number; appId: string }[] = [];
    for (const a of this.db.apps) {
      const own = new Set(a.ticketKeywords.map((k) => k.trim().toLowerCase()));
      const words = new Set<string>([...a.ticketKeywords, a.name, a.code.replace(/_/g, " ")]);
      for (const raw of words) {
        const w = raw.trim();
        if (w.length < 2 || (!own.has(w.toLowerCase()) && STOP.has(w.toLowerCase()))) continue;
        terms.push({ re: new RegExp(`(^|[^a-z0-9])${esc(w).replace(/\\? /g, "[\\s_-]*")}($|[^a-z0-9])`, "i"), len: w.length, appId: a.id });
      }
    }
    terms.sort((x, y) => y.len - x.len); // most specific first
    const appIds = new Set(this.db.apps.map((a) => a.id));
    // whole-word match, so a rule for "ITS" doesn't catch "kits"
    const rules = this.db.ticketRules.filter((r) => appIds.has(r.appId)).map((r) => ({ ...r, re: new RegExp(`(^|[^a-z0-9])${esc(r.contains.trim()).replace(/\\? /g, "[\\s_-]*")}($|[^a-z0-9])`, "i") }));
    return (t: Ticket): { appId: string | null; matchedBy: TicketRow["matchedBy"] } => {
      if (t.overrideAppId && appIds.has(t.overrideAppId)) return { appId: t.overrideAppId, matchedBy: "manual" };
      for (const r of rules) {
        const v = String(t[r.field] ?? "");
        if (v && r.re.test(v)) return { appId: r.appId, matchedBy: "rule" };
      }
      const text = [t.subject, t.category, t.subcategory, t.item].join(" | ");
      for (const term of terms) if (term.re.test(text)) return { appId: term.appId, matchedBy: "keyword" };
      return { appId: null, matchedBy: "" };
    };
  }

  private ticketMatches() {
    if (!this.ticketIndex) {
      const match = this.ticketMatcher();
      this.ticketIndex = new Map(this.db.tickets.map((t) => [t.id, match(t)]));
    }
    return this.ticketIndex;
  }

  private ticketCounts(appId: string): TicketCounts {
    const idx = this.ticketMatches();
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const c: TicketCounts = { open: 0, high: 0, created30: 0, total: 0 };
    for (const t of this.db.tickets) {
      if (idx.get(t.id)?.appId !== appId) continue;
      c.total++;
      if (t.open) { c.open++; if (/high|urgent|critical|p1|p2/i.test(t.priority)) c.high++; }
      if (t.createdAt >= since) c.created30++;
    }
    return c;
  }

  /** Called by the ServiceDesk Plus sync (server) — upserts by id and keeps hand-made app assignments. */
  ingestTickets(list: Ticket[], meta: { total?: number } = {}) {
    const byId = new Map(this.db.tickets.map((t) => [t.id, t]));
    let added = 0;
    for (const t of list) {
      const prev = byId.get(t.id);
      if (prev) Object.assign(prev, t, { overrideAppId: prev.overrideAppId });
      else { this.db.tickets.push(t); byId.set(t.id, t); added++; }
    }
    // drop the made-up sample tickets once real ones arrive
    if (list.some((t) => t.source === "sdp")) this.db.tickets = this.db.tickets.filter((t) => !t.id.startsWith("sample-"));
    if (this.db.tickets.length > 20000) this.db.tickets = this.db.tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20000);
    const now = nowIso();
    this.db.ticketSync = { ...this.db.ticketSync, lastRun: now, lastOk: now, error: "", fetched: list.length, total: meta.total ?? this.db.ticketSync.total };
    this.ticketIndex = null;
    return { added, updated: list.length - added };
  }
  ticketSyncFailed(error: string) {
    this.db.ticketSync = { ...this.db.ticketSync, lastRun: nowIso(), error: error.slice(0, 500) };
  }

  private ticketRows(user: UserRecord, appId?: string | null) {
    const idx = this.ticketMatches();
    const apps = new Map(this.visibleApps(user).map((a) => [a.id, a]));
    const out: TicketRow[] = [];
    for (const t of this.db.tickets) {
      const m = idx.get(t.id) ?? { appId: null, matchedBy: "" as const };
      if (appId !== undefined && m.appId !== appId) continue;
      if (m.appId ? !apps.has(m.appId) : user.role === "viewer") continue;
      const a = m.appId ? apps.get(m.appId)! : null;
      out.push({ ...t, appId: m.appId, matchedBy: m.matchedBy, appName: a?.name ?? "", appTone: a?.tone ?? 1 });
    }
    return out.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  private rowToTicket(row: Record<string, unknown>, i: number): Ticket | null {
    const subject = clean(row.subject, 300);
    if (!subject) return null;
    const displayId = clean(row.displayId, 40) || String(i + 1);
    const status = clean(row.status, 60) || "Open";
    const date = (v: unknown) => { const d = normalizeDate(v); return d ? new Date(d + "T09:00:00").toISOString() : ""; };
    return {
      id: `imp-${displayId}`, displayId, subject, status, statusColor: "", open: !CLOSED_STATUS.test(status), priority: clean(row.priority, 40),
      category: clean(row.category, 80), subcategory: clean(row.subcategory, 80), item: clean(row.item, 80), group: clean(row.group, 80), site: clean(row.site, 80),
      requester: clean(row.requester, 120), requesterDept: clean(row.requesterDept, 120), technician: clean(row.technician, 120),
      createdAt: date(row.createdAt) || nowIso(), dueAt: date(row.dueAt), closedAt: date(row.closedAt), url: clean(row.url, 500), source: "import", overrideAppId: null,
    };
  }

  /* ---------------------------------------------------- handlers ---------------------------------------------------- */

  private on(name: string, handler: Handler, opts: { public?: boolean; write?: boolean } = {}) {
    this.methods[name] = { handler, ...opts };
  }

  private register() {
    /* ---------- auth ---------- */
    this.on("health", () => ({ ok: true, time: nowIso(), apps: this.db.apps.length }), { public: true });

    this.on("login", async (_c, p: { username: string; password: string }) => {
      const username = clean(p.username, 80).toLowerCase();
      const user = this.db.users.find((u) => u.username.toLowerCase() === username || u.email.toLowerCase() === username);
      if (!user || !(await verifyPassword(String(p.password ?? ""), user.salt, user.passwordHash))) {
        throw new ApiError(401, "Wrong username or password.");
      }
      if (!user.active) throw new ApiError(403, "This account is deactivated. Ask an administrator.");
      const token = newToken();
      const now = new Date();
      this.db.sessions = this.db.sessions.filter((s) => s.expiresAt > now.toISOString()).slice(-500);
      this.db.sessions.push({ token, userId: user.id, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + SESSION_DAYS * 864e5).toISOString() });
      user.lastLoginAt = now.toISOString();
      this.log({ user }, "login", "session", user.id, null, `${user.name} signed in`);
      await this.persist();
      return { token, user: publicUser(user) };
    }, { public: true });

    this.on("logout", (ctx, p: { token?: string }) => {
      this.db.sessions = this.db.sessions.filter((s) => s.token !== p.token);
      this.log(ctx, "logout", "session", ctx.user.id, null, `${ctx.user.name} signed out`);
    }, { write: true });

    this.on("me", (ctx) => publicUser(ctx.user));

    /* ---------- users ---------- */
    this.on("users.list", () => this.db.users.map(publicUser));

    this.on("users.create", async (ctx, p) => {
      this.admin(ctx);
      const username = clean(p.username, 60).toLowerCase();
      if (!/^[a-z0-9._-]{3,}$/.test(username)) throw new ApiError(400, "Username needs 3+ characters: letters, numbers, dot, dash or underscore.");
      if (this.db.users.some((u) => u.username === username)) throw new ApiError(409, "That username is taken.");
      const password = String(p.password ?? "");
      if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters.");
      const salt = newSalt();
      const user: UserRecord = {
        id: uid(), username, name: clean(p.name, 80) || username, email: clean(p.email, 120), role: (["admin", "editor", "viewer"].includes(p.role) ? p.role : "viewer") as Role,
        title: clean(p.title, 80), department: clean(p.department, 80), bio: clean(p.bio, 400), avatar: String(p.avatar ?? ""), tone: (Number(p.tone) || 1) as Tone,
        active: true, createdAt: nowIso(), lastLoginAt: null, salt, passwordHash: await hashPassword(password, salt),
      };
      this.db.users.push(user);
      this.log(ctx, "create", "user", user.id, null, `Created user ${user.name} (${user.role})`);
      return publicUser(user);
    }, { write: true });

    this.on("users.update", (ctx, p) => {
      const user = this.db.users.find((u) => u.id === p.id);
      if (!user) throw new ApiError(404, "User not found.");
      const self = user.id === ctx.user.id;
      if (!self) this.admin(ctx);
      const before = { ...user };
      for (const k of USER_EDITABLE) if (k in p) (user as any)[k] = k === "tone" ? Number(p[k]) || 1 : k === "avatar" ? String(p[k] ?? "") : clean(p[k], k === "bio" ? 400 : 120);
      if (ctx.user.role === "admin") {
        if (p.role && p.role !== user.role) {
          if (self) throw new ApiError(400, "You can't change your own role.");
          user.role = p.role;
        }
        if (typeof p.active === "boolean" && p.active !== user.active) {
          if (self) throw new ApiError(400, "You can't deactivate yourself.");
          user.active = p.active;
          if (!p.active) this.db.sessions = this.db.sessions.filter((s) => s.userId !== user.id);
        }
      }
      if (before.name !== user.name) for (const t of this.db.tasks) if (t.assignee) t.assignee = t.assignee.split(", ").map((n) => (n === before.name ? user.name : n)).join(", ");
      const changes = diff(before, user, [...USER_EDITABLE, "role", "active"]);
      if (changes.length) this.log(ctx, "update", "user", user.id, null, `Updated user ${user.name}`, changes);
      return publicUser(user);
    }, { write: true });

    this.on("users.resetPassword", async (ctx, p) => {
      this.admin(ctx);
      const user = this.db.users.find((u) => u.id === p.id);
      if (!user) throw new ApiError(404, "User not found.");
      if (String(p.password ?? "").length < 6) throw new ApiError(400, "Password must be at least 6 characters.");
      user.salt = newSalt();
      user.passwordHash = await hashPassword(String(p.password), user.salt);
      this.db.sessions = this.db.sessions.filter((s) => s.userId !== user.id);
      this.log(ctx, "reset-password", "user", user.id, null, `Reset password for ${user.name}`);
    }, { write: true });

    this.on("users.changePassword", async (ctx, p) => {
      if (!(await verifyPassword(String(p.current ?? ""), ctx.user.salt, ctx.user.passwordHash))) throw new ApiError(400, "Current password is wrong.");
      if (String(p.next ?? "").length < 6) throw new ApiError(400, "New password must be at least 6 characters.");
      ctx.user.salt = newSalt();
      ctx.user.passwordHash = await hashPassword(String(p.next), ctx.user.salt);
      this.log(ctx, "change-password", "user", ctx.user.id, null, `${ctx.user.name} changed their password`);
    }, { write: true });

    this.on("users.delete", (ctx, p) => {
      this.admin(ctx);
      if (p.id === ctx.user.id) throw new ApiError(400, "You can't delete yourself.");
      const user = this.db.users.find((u) => u.id === p.id);
      if (!user) throw new ApiError(404, "User not found.");
      if (user.role === "admin" && this.db.users.filter((u) => u.role === "admin" && u.active).length <= 1) throw new ApiError(400, "Keep at least one administrator.");
      this.db.users = this.db.users.filter((u) => u.id !== p.id);
      this.db.sessions = this.db.sessions.filter((s) => s.userId !== p.id);
      this.db.favorites = this.db.favorites.filter((f) => f.userId !== p.id);
      for (const t of this.db.tasks) if (t.assignee) t.assignee = t.assignee.split(", ").filter((n) => n !== user.name).join(", ");
      for (const a of this.db.apps) {
        if (a.ownerId === p.id) a.ownerId = null;
        delete a.acl[p.id];
      }
      this.log(ctx, "delete", "user", p.id, null, `Deleted user ${user.name}`);
    }, { write: true });

    /* ---------- applications ---------- */
    this.on("apps.list", (ctx) => this.visibleApps(ctx.user).map((a) => this.summarize(ctx.user, a)));

    this.on("apps.get", (ctx, p) => {
      const app = this.app(ctx, p.id, "view");
      const detail: AppDetail = {
        ...this.summarize(ctx.user, app),
        groups: this.db.groups.filter((g) => g.appId === app.id).sort((a, b) => a.order - b.order),
        tasks: this.db.tasks.filter((t) => t.appId === app.id).sort((a, b) => a.order - b.order),
        usageEntries: this.db.usage.filter((u) => u.appId === app.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
        docs: this.db.docs.filter((d) => d.appId === app.id).sort((a, b) => a.order - b.order),
        releases: this.db.releases.filter((r) => r.appId === app.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
        attachments: this.db.attachments.filter((f) => f.appId === app.id).map(({ dataUrl: _d, ...meta }) => meta as AttachmentMeta),
        screenshots: this.db.screenshots.filter((x) => x.appId === app.id).sort((a, b) => a.order - b.order).map(({ dataUrl: _d, ...meta }) => meta as ScreenshotMeta),
        activity: this.db.logs.filter((l) => l.appId === app.id).slice(0, 60),
      };
      return detail;
    });

    this.on("apps.create", (ctx, p) => {
      if (ctx.user.role === "viewer") throw new ApiError(403, "Viewers can't add applications.");
      const app = this.buildApp(ctx, p);
      this.db.apps.push(app);
      if (p.withTemplate !== false) this.addTemplateTasks(app);
      this.log(ctx, "create", "app", app.id, app, `Added application ${app.name}`);
      return this.summarize(ctx.user, app);
    }, { write: true });

    this.on("apps.update", (ctx, p) => {
      const app = this.app(ctx, p.id, "edit");
      const before = { ...app };
      this.applyAppFields(app, p);
      const changes = diff(before, app, APP_FIELDS as unknown as string[]);
      if (changes.length) {
        this.touch(app);
        const statusChange = changes.find((c) => c.field === "status");
        this.log(ctx, statusChange ? "status" : "update", "app", app.id, app,
          statusChange ? `Moved ${app.name} from ${statusChange.from} to ${statusChange.to}` : `Updated ${app.name} (${changes.map((c) => c.field).join(", ")})`, changes);
      }
      return this.summarize(ctx.user, app);
    }, { write: true });

    this.on("apps.delete", (ctx, p) => {
      const app = this.app(ctx, p.id, "edit");
      if (ctx.user.role === "viewer") throw new ApiError(403, "Viewers can't delete applications.");
      const id = app.id;
      this.db.apps = this.db.apps.filter((a) => a.id !== id);
      for (const key of ["groups", "tasks", "usage", "launches", "docs", "releases", "attachments", "screenshots", "tracking", "favorites", "appUsers", "appSeen"] as const) {
        (this.db[key] as { appId: string }[]) = (this.db[key] as { appId: string }[]).filter((x) => x.appId !== id);
      }
      this.log(ctx, "delete", "app", id, app, `Deleted application ${app.name}`);
    }, { write: true });

    this.on("apps.favorite", (ctx, p) => {
      this.app(ctx, p.id, "view");
      const i = this.db.favorites.findIndex((f) => f.userId === ctx.user.id && f.appId === p.id);
      if (i >= 0) this.db.favorites.splice(i, 1);
      else this.db.favorites.push({ userId: ctx.user.id, appId: p.id });
      return { favorite: i < 0 };
    }, { write: true });

    this.on("apps.launch", (ctx, p) => {
      const app = this.app(ctx, p.id, "view");
      const launch: Launch = { id: uid(), appId: app.id, userId: ctx.user.id, at: nowIso() };
      this.db.launches.push(launch);
      if (this.db.launches.length > 100_000) this.db.launches.splice(0, this.db.launches.length - 100_000);
      this.log(ctx, "open", "app", app.id, app, `${ctx.user.name} opened ${app.name}`);
      return { ok: true };
    }, { write: true });

    this.on("apps.access", (ctx, p) => {
      const app = this.app(ctx, p.id, "edit");
      if (ctx.user.role === "viewer") throw new ApiError(403, "Viewers can't change access.");
      const before = { visibility: app.visibility, acl: { ...app.acl } };
      if (p.visibility === "public" || p.visibility === "restricted") app.visibility = p.visibility;
      if (p.acl && typeof p.acl === "object") {
        const acl: Record<string, Access> = {};
        for (const [userId, access] of Object.entries(p.acl as Record<string, string>)) {
          if (this.db.users.some((u) => u.id === userId) && (access === "edit" || access === "view")) acl[userId] = access;
        }
        app.acl = acl;
      }
      const name = (id: string) => this.db.users.find((u) => u.id === id)?.name ?? id;
      const changes: Change[] = [];
      if (before.visibility !== app.visibility) changes.push({ field: "visibility", from: before.visibility, to: app.visibility });
      const ids = new Set([...Object.keys(before.acl), ...Object.keys(app.acl)]);
      for (const id of ids) if (before.acl[id] !== app.acl[id]) changes.push({ field: `access: ${name(id)}`, from: before.acl[id] ?? "default", to: app.acl[id] ?? "default" });
      if (changes.length) { this.touch(app); this.log(ctx, "access", "app", app.id, app, `Changed access rights on ${app.name}`, changes); }
      return this.summarize(ctx.user, app);
    }, { write: true });

    this.on("apps.import", (ctx, p: { rows: Record<string, unknown>[] }) => {
      if (ctx.user.role === "viewer") throw new ApiError(403, "Viewers can't import applications.");
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      (p.rows ?? []).forEach((row, i) => {
        const name = clean(row.name, 120);
        if (!name) { result.skipped++; result.errors.push(`Row ${i + 1}: missing name`); return; }
        const code = clean(row.code, 40);
        const existing = this.db.apps.find((a) => (code && a.code.toLowerCase() === code.toLowerCase()) || a.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          if (this.permission(ctx.user, existing) !== "edit") { result.skipped++; result.errors.push(`Row ${i + 1}: no edit rights on ${existing.name}`); return; }
          const before = { ...existing };
          this.applyAppFields(existing, this.rowToApp(row), true);
          const changes = diff(before, existing, APP_FIELDS as unknown as string[]);
          if (changes.length) { this.touch(existing); result.updated++; this.log(ctx, "import", "app", existing.id, existing, `Updated ${existing.name} from import`, changes); }
          else result.skipped++;
        } else {
          const app = this.buildApp(ctx, this.rowToApp(row));
          this.db.apps.push(app);
          this.addTemplateTasks(app);
          result.created++;
          this.log(ctx, "import", "app", app.id, app, `Imported application ${app.name}`);
        }
      });
      return result;
    }, { write: true });

    /* ---------- task groups & tasks ---------- */
    this.on("groups.create", (ctx, p) => {
      const app = this.app(ctx, p.appId, "edit");
      const order = Math.max(-1, ...this.db.groups.filter((g) => g.appId === app.id).map((g) => g.order)) + 1;
      const group: TaskGroup = { id: uid(), appId: app.id, title: clean(p.title, 120) || "New section", order, createdAt: nowIso() };
      this.db.groups.push(group);
      this.touch(app);
      this.log(ctx, "create", "group", group.id, app, `Added heading "${group.title}"`);
      return group;
    }, { write: true });

    this.on("groups.update", (ctx, p) => {
      const group = this.db.groups.find((g) => g.id === p.id);
      if (!group) throw new ApiError(404, "Heading not found.");
      const app = this.app(ctx, group.appId, "edit");
      const before = group.title;
      group.title = clean(p.title, 120) || group.title;
      if (before !== group.title) this.log(ctx, "update", "group", group.id, app, `Renamed heading "${before}" → "${group.title}"`);
      return group;
    }, { write: true });

    this.on("groups.move", (ctx, p: { id: string; dir: -1 | 1 }) => {
      const group = this.db.groups.find((g) => g.id === p.id);
      if (!group) throw new ApiError(404, "Heading not found.");
      this.app(ctx, group.appId, "edit");
      const list = this.db.groups.filter((g) => g.appId === group.appId).sort((a, b) => a.order - b.order);
      const i = list.indexOf(group);
      const j = i + (p.dir < 0 ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      list.forEach((g, k) => (g.order = k));
    }, { write: true });

    this.on("groups.delete", (ctx, p) => {
      const group = this.db.groups.find((g) => g.id === p.id);
      if (!group) throw new ApiError(404, "Heading not found.");
      const app = this.app(ctx, group.appId, "edit");
      const n = this.db.tasks.filter((t) => t.groupId === group.id).length;
      this.db.groups = this.db.groups.filter((g) => g.id !== group.id);
      this.db.tasks = this.db.tasks.filter((t) => t.groupId !== group.id);
      this.touch(app);
      this.log(ctx, "delete", "group", group.id, app, `Deleted heading "${group.title}" and ${n} task(s)`);
    }, { write: true });

    this.on("tasks.create", (ctx, p) => {
      const group = this.db.groups.find((g) => g.id === p.groupId);
      if (!group) throw new ApiError(404, "Heading not found.");
      const app = this.app(ctx, group.appId, "edit");
      const title = clean(p.title, 300);
      if (!title) throw new ApiError(400, "Task title is required.");
      const task = this.buildTask(group, { ...p, title });
      this.db.tasks.push(task);
      this.touch(app);
      this.log(ctx, "create", "task", task.id, app, `Added task "${task.title}" under ${group.title}`);
      return task;
    }, { write: true });

    this.on("tasks.update", (ctx, p) => {
      const task = this.db.tasks.find((t) => t.id === p.id);
      if (!task) throw new ApiError(404, "Task not found.");
      const app = this.app(ctx, task.appId, "edit");
      const before = { ...task };
      if ("title" in p) task.title = clean(p.title, 300) || task.title;
      if ("notes" in p) task.notes = clean(p.notes, 4000);
      if ("assignee" in p) task.assignee = this.assigneeName(p.assignee);
      if ("dueDate" in p) task.dueDate = normalizeDate(p.dueDate);
      if ("priority" in p && PRIORITIES.includes(p.priority)) task.priority = p.priority;
      if ("groupId" in p && p.groupId !== task.groupId) {
        const target = this.db.groups.find((g) => g.id === p.groupId && g.appId === task.appId);
        if (!target) throw new ApiError(400, "Target heading not found.");
        task.groupId = target.id;
      }
      if ("done" in p && Boolean(p.done) !== task.done) {
        task.done = Boolean(p.done);
        task.doneAt = task.done ? nowIso() : null;
        task.doneBy = task.done ? ctx.user.name : null;
      }
      const changes = diff(before, task, ["title", "notes", "assignee", "dueDate", "priority", "groupId", "done"]);
      if (changes.length) {
        this.touch(app);
        const onlyDone = changes.length === 1 && changes[0]!.field === "done";
        this.log(ctx, onlyDone ? (task.done ? "complete" : "reopen") : "update", "task", task.id, app,
          onlyDone ? `${task.done ? "Completed" : "Reopened"} "${task.title}"` : `Updated task "${task.title}"`, changes);
      }
      return task;
    }, { write: true });

    this.on("tasks.move", (ctx, p: { id: string; dir: -1 | 1 }) => {
      const task = this.db.tasks.find((t) => t.id === p.id);
      if (!task) throw new ApiError(404, "Task not found.");
      this.app(ctx, task.appId, "edit");
      const list = this.db.tasks.filter((t) => t.groupId === task.groupId).sort((a, b) => a.order - b.order);
      const i = list.indexOf(task);
      const j = i + (p.dir < 0 ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      list.forEach((t, k) => (t.order = k));
    }, { write: true });

    this.on("tasks.delete", (ctx, p) => {
      const task = this.db.tasks.find((t) => t.id === p.id);
      if (!task) throw new ApiError(404, "Task not found.");
      const app = this.app(ctx, task.appId, "edit");
      this.db.tasks = this.db.tasks.filter((t) => t.id !== task.id);
      this.touch(app);
      this.log(ctx, "delete", "task", task.id, app, `Deleted task "${task.title}"`);
    }, { write: true });

    /** Every task the user can see, across all applications (the global Tasks page). */


    /* ---------- people who use each app ---------- */
    this.on("appusers.list", (ctx, p: { appId: string }) => {
      this.app(ctx, p.appId, "view");
      return this.appUserRows(p.appId);
    });
    this.on("appusers.save", (ctx, p: Partial<AppUser> & { appId: string }) => {
      const app = this.app(ctx, p.appId, "edit");
      const name = clean(p.name, 120);
      if (!name) throw new ApiError(400, "Name is required.");
      const fields = { name, email: clean(p.email, 160), department: clean(p.department, 120), licence: clean(p.licence, 60), notes: clean(p.notes, 400) };
      const existing = p.id ? this.db.appUsers.find((u) => u.id === p.id && u.appId === app.id) : null;
      if (existing) Object.assign(existing, fields);
      else this.db.appUsers.push({ id: uid(), appId: app.id, ...fields, createdAt: nowIso() });
      this.touch(app);
      this.log(ctx, existing ? "update" : "create", "app-user", null, app, `${existing ? "Updated" : "Added"} ${name} as a user of ${app.name}`);
      return this.appUserRows(app.id);
    }, { write: true });
    this.on("appusers.delete", (ctx, p: { appId: string; ids: string[] }) => {
      const app = this.app(ctx, p.appId, "edit");
      const ids = new Set(Array.isArray(p.ids) ? p.ids : []);
      const n = this.db.appUsers.filter((u) => u.appId === app.id && ids.has(u.id)).length;
      this.db.appUsers = this.db.appUsers.filter((u) => !(u.appId === app.id && ids.has(u.id)));
      this.log(ctx, "delete", "app-user", null, app, `Removed ${n} user(s) from ${app.name}`);
      return this.appUserRows(app.id);
    }, { write: true });
    this.on("appusers.import", (ctx, p: { appId?: string; rows: Record<string, unknown>[] }) => {
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      const byKey = (v: unknown) => { const k = clean(v, 80).toLowerCase(); return this.db.apps.find((a) => a.code.toLowerCase() === k || a.name.toLowerCase() === k); };
      (p.rows ?? []).forEach((row, i) => {
        const app = p.appId ? this.db.apps.find((a) => a.id === p.appId) : byKey(row.app);
        if (!app) { result.skipped++; result.errors.push(`Row ${i + 1}: application not found`); return; }
        if (this.permission(ctx.user, app) !== "edit") { result.skipped++; result.errors.push(`Row ${i + 1}: no edit rights on ${app.name}`); return; }
        const name = clean(row.name, 120);
        if (!name) { result.skipped++; result.errors.push(`Row ${i + 1}: missing name`); return; }
        const email = clean(row.email, 160);
        const fields = { name, email, department: clean(row.department, 120), licence: clean(row.licence, 60), notes: clean(row.notes, 400) };
        const existing = this.db.appUsers.find((u) => u.appId === app.id && ((email && u.email.toLowerCase() === email.toLowerCase()) || u.name.toLowerCase() === name.toLowerCase()));
        if (existing) { Object.assign(existing, Object.fromEntries(Object.entries(fields).filter(([, v]) => v))); result.updated++; }
        else { this.db.appUsers.push({ id: uid(), appId: app.id, ...fields, createdAt: nowIso() }); result.created++; }
      });
      this.log(ctx, "import", "app-user", null, p.appId ? this.db.apps.find((a) => a.id === p.appId) ?? null : null, `Imported app users: ${result.created} added, ${result.updated} updated`);
      return result;
    }, { write: true });

    /* ---------- tickets ---------- */
    this.on("tickets.list", (ctx, p: { appId?: string }) => {
      if (p.appId) this.app(ctx, p.appId, "view");
      return this.ticketRows(ctx.user, p.appId);
    });
    this.on("tickets.status", (ctx) => ({
      sync: this.db.ticketSync,
      rules: this.db.ticketRules,
      total: this.db.tickets.length,
      sample: this.db.tickets.some((t) => t.id.startsWith("sample-")),
      canManage: ctx.user.role === "admin",
    }));
    this.on("tickets.suggest", (ctx) => {
      if (ctx.user.role === "viewer") throw new ApiError(403, "View-only users can't tag tickets.");
      const idx = this.ticketMatches();
      const STOP = new Set("re fw fwd fyi the and for with from to of in on at by is are was be it this that please kindly pls request requested requesting regarding reg need needed required require issue issues problem error not working unable cannot can't cant new access dear sir mam team hi hello help urgent asap update updated query support id ids user users system related same also via your our my all any one two get got give provide providing change changes create created creating add added remove removed done check checking pending approval approve approved".split(" "));
      const counts = new Map<string, { n: number; open: number; examples: string[] }>();
      let unmatched = 0;
      for (const t of this.db.tickets) {
        if (idx.get(t.id)?.appId) continue;
        unmatched++;
        const words = t.subject.toLowerCase().replace(/[^a-z0-9&+./ -]+/g, " ").split(/[\s/.-]+/).filter((w) => w.length >= 2 && !/^\d+$/.test(w));
        const seen = new Set<string>();
        for (let i = 0; i < words.length; i++) {
          const w = words[i]!;
          if (!STOP.has(w) && w.length >= 3) seen.add(w);
          const n = words[i + 1];
          if (n && !STOP.has(w) && !STOP.has(n)) seen.add(`${w} ${n}`);
        }
        for (const term of seen) {
          const e = counts.get(term) ?? { n: 0, open: 0, examples: [] };
          e.n++; if (t.open) e.open++;
          if (e.examples.length < 3) e.examples.push(t.subject);
          counts.set(term, e);
        }
      }
      const terms = [...counts.entries()].filter(([, e]) => e.n >= 3).sort((a, b) => b[1].n - a[1].n).slice(0, 80).map(([term, e]) => ({ term, ...e }));
      return { unmatched, terms };
    });
    this.on("tickets.assign", (ctx, p: { ids: string[]; appId: string | null }) => {
      const target = p.appId ? this.app(ctx, p.appId, "edit") : null;
      if (!target && ctx.user.role === "viewer") throw new ApiError(403, "View-only users can't reassign tickets.");
      const ids = new Set(Array.isArray(p.ids) ? p.ids : []);
      const list = this.db.tickets.filter((t) => ids.has(t.id));
      for (const t of list) t.overrideAppId = target?.id ?? null;
      this.log(ctx, "update", "ticket", null, target, target ? `Linked ${list.length} ticket(s) to ${target.name}` : `Reset the app link on ${list.length} ticket(s)`);
      return { updated: list.length };
    }, { write: true });
    this.on("tickets.rules.save", (ctx, p: { id?: string; field: string; contains: string; appId: string }) => {
      this.admin(ctx);
      const app = this.app(ctx, p.appId, "view");
      const field = (TICKET_RULE_FIELDS as readonly string[]).includes(p.field) ? (p.field as TicketRuleField) : null;
      const contains = clean(p.contains, 80);
      if (!field || !contains) throw new ApiError(400, "Pick a field and the text it should contain.");
      const existing = p.id ? this.db.ticketRules.find((r) => r.id === p.id) : null;
      if (existing) Object.assign(existing, { field, contains, appId: app.id });
      else this.db.ticketRules.push({ id: uid(), field, contains, appId: app.id, createdAt: nowIso() });
      this.log(ctx, "update", "ticket-rule", null, app, `Tickets whose ${field} contains “${contains}” → ${app.name}`);
      return this.db.ticketRules;
    }, { write: true });
    this.on("tickets.rules.delete", (ctx, p: { id: string }) => {
      this.admin(ctx);
      this.db.ticketRules = this.db.ticketRules.filter((r) => r.id !== p.id);
      this.log(ctx, "delete", "ticket-rule", p.id, null, "Removed a ticket matching rule");
      return this.db.ticketRules;
    }, { write: true });
    this.on("tickets.import", (ctx, p: { rows: Record<string, unknown>[] }) => {
      if (ctx.user.role === "viewer") throw new ApiError(403, "View-only users can't import tickets.");
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      const list: Ticket[] = [];
      (p.rows ?? []).forEach((row, i) => { const t = this.rowToTicket(row, i); if (t) list.push(t); else { result.skipped++; result.errors.push(`Row ${i + 1}: no subject`); } });
      this.db.tickets = this.db.tickets.filter((t) => !t.id.startsWith("sample-"));
      const r = this.ingestTickets(list);
      this.db.ticketSync.fetched = list.length;
      result.created = r.added; result.updated = r.updated;
      this.log(ctx, "import", "ticket", null, null, `Imported ${list.length} helpdesk ticket(s)`);
      return result;
    }, { write: true });

    this.on("tasks.all", (ctx) => {
      const apps = new Map(this.visibleApps(ctx.user).map((a) => [a.id, a]));
      const groups = new Map(this.db.groups.map((g) => [g.id, g]));
      return this.db.tasks.filter((t) => apps.has(t.appId)).map((t) => {
        const app = apps.get(t.appId)!;
        return { ...t, appName: app.name, appCode: app.code, appTone: app.tone, appStatus: app.status, groupTitle: groups.get(t.groupId)?.title ?? "", canEdit: this.permission(ctx.user, app) === "edit" };
      });
    });

    this.on("tasks.import", (ctx, p: { appId: string; rows: Record<string, unknown>[] }) => {
      const app = this.app(ctx, p.appId, "edit");
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      (p.rows ?? []).forEach((row, i) => {
        const title = clean(row.title, 300);
        if (!title) { result.skipped++; result.errors.push(`Row ${i + 1}: missing task title`); return; }
        const heading = clean(row.group, 120) || "Imported";
        let group = this.db.groups.find((g) => g.appId === app.id && g.title.toLowerCase() === heading.toLowerCase());
        if (!group) {
          group = { id: uid(), appId: app.id, title: heading, order: this.db.groups.filter((g) => g.appId === app.id).length, createdAt: nowIso() };
          this.db.groups.push(group);
        }
        const existing = this.db.tasks.find((t) => t.groupId === group!.id && t.title.toLowerCase() === title.toLowerCase());
        if (existing) {
          const done = "done" in row ? toBool(row.done) : existing.done;
          if (done !== existing.done) { existing.done = done; existing.doneAt = done ? nowIso() : null; existing.doneBy = done ? ctx.user.name : null; }
          if (row.assignee) existing.assignee = this.assigneeName(row.assignee);
          if (row.dueDate) existing.dueDate = normalizeDate(row.dueDate);
          if (row.notes) existing.notes = clean(row.notes, 4000);
          result.updated++;
        } else {
          this.db.tasks.push(this.buildTask(group, { ...row, title, done: toBool(row.done), dueDate: normalizeDate(row.dueDate) }, ctx.user.name));
          result.created++;
        }
      });
      this.touch(app);
      this.log(ctx, "import", "task", null, app, `Imported tasks: ${result.created} new, ${result.updated} updated`);
      return result;
    }, { write: true });

    /* ---------- usage ---------- */
    this.on("usage.save", (ctx, p) => {
      const app = this.app(ctx, p.appId, "edit");
      const date = normalizeDate(p.date);
      if (!date) throw new ApiError(400, "A valid date is required.");
      const result = this.upsertUsage(app, { ...p, date }, "manual");
      this.touch(app);
      this.log(ctx, result.created ? "create" : "update", "usage", result.entry.id, app,
        `${result.created ? "Logged" : "Updated"} usage for ${date}: ${result.entry.sessions} sessions, ${result.entry.activeUsers} active users`);
      return result.entry;
    }, { write: true });

    this.on("usage.delete", (ctx, p) => {
      const entry = this.db.usage.find((u) => u.id === p.id);
      if (!entry) throw new ApiError(404, "Usage entry not found.");
      const app = this.app(ctx, entry.appId, "edit");
      this.db.usage = this.db.usage.filter((u) => u.id !== entry.id);
      this.log(ctx, "delete", "usage", entry.id, app, `Deleted usage entry for ${entry.date}`);
    }, { write: true });

    this.on("usage.import", (ctx, p: { appId?: string; rows: Record<string, unknown>[] }) => {
      const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
      const touched = new Set<App>();
      (p.rows ?? []).forEach((row, i) => {
        let app: App | undefined;
        if (p.appId) app = this.db.apps.find((a) => a.id === p.appId);
        else {
          const key = clean(row.app, 120).toLowerCase();
          app = this.db.apps.find((a) => a.code.toLowerCase() === key || a.name.toLowerCase() === key);
        }
        if (!app) { result.skipped++; result.errors.push(`Row ${i + 1}: application "${clean(row.app, 60)}" not found`); return; }
        if (this.permission(ctx.user, app) !== "edit") { result.skipped++; result.errors.push(`Row ${i + 1}: no edit rights on ${app.name}`); return; }
        const date = normalizeDate(row.date);
        if (!date) { result.skipped++; result.errors.push(`Row ${i + 1}: invalid date`); return; }
        const r = this.upsertUsage(app, { ...row, date }, "import");
        r.created ? result.created++ : result.updated++;
        touched.add(app);
      });
      for (const app of touched) { this.touch(app); this.log(ctx, "import", "usage", null, app, `Imported usage data into ${app.name}`); }
      if (!touched.size) this.log(ctx, "import", "usage", null, null, `Usage import: nothing imported (${result.skipped} skipped)`);
      return result;
    }, { write: true });

    /* ---------- documents ---------- */
    this.on("docs.save", (ctx, p) => {
      const app = this.app(ctx, p.appId, "edit");
      const kind: DocKind = DOC_KINDS.includes(p.kind) ? p.kind : "other";
      if (p.id) {
        const doc = this.db.docs.find((d) => d.id === p.id && d.appId === app.id);
        if (!doc) throw new ApiError(404, "Document not found.");
        const before = { ...doc };
        doc.title = clean(p.title, 160) || doc.title;
        doc.kind = kind;
        doc.content = String(p.content ?? "").slice(0, 2_000_000);
        doc.updatedAt = nowIso();
        doc.updatedBy = ctx.user.name;
        const changes = diff(before, doc, ["title", "kind"]);
        if (before.content !== doc.content) changes.push({ field: "content", from: `${before.content.length} chars`, to: `${doc.content.length} chars` });
        if (changes.length) { this.touch(app); this.log(ctx, "update", "doc", doc.id, app, `Edited document "${doc.title}"`, changes); }
        return doc;
      }
      const doc: Doc = {
        id: uid(), appId: app.id, kind, title: clean(p.title, 160) || "Untitled", content: String(p.content ?? "").slice(0, 2_000_000),
        order: this.db.docs.filter((d) => d.appId === app.id).length, updatedAt: nowIso(), updatedBy: ctx.user.name,
      };
      this.db.docs.push(doc);
      this.touch(app);
      this.log(ctx, "create", "doc", doc.id, app, `Added document "${doc.title}"`);
      return doc;
    }, { write: true });

    this.on("docs.delete", (ctx, p) => {
      const doc = this.db.docs.find((d) => d.id === p.id);
      if (!doc) throw new ApiError(404, "Document not found.");
      const app = this.app(ctx, doc.appId, "edit");
      this.db.docs = this.db.docs.filter((d) => d.id !== doc.id);
      this.log(ctx, "delete", "doc", doc.id, app, `Deleted document "${doc.title}"`);
    }, { write: true });

    /* ---------- releases ---------- */
    this.on("releases.save", (ctx, p) => {
      const app = this.app(ctx, p.appId, "edit");
      const version = clean(p.version, 40);
      if (!version) throw new ApiError(400, "Version is required.");
      let release = p.id ? this.db.releases.find((r) => r.id === p.id && r.appId === app.id) : undefined;
      const created = !release;
      if (!release) {
        release = { id: uid(), appId: app.id, version, date: normalizeDate(p.date) || ymd(), title: clean(p.title, 160), notes: clean(p.notes, 8000), createdAt: nowIso() };
        this.db.releases.push(release);
      } else Object.assign(release, { version, date: normalizeDate(p.date) || release.date, title: clean(p.title, 160), notes: clean(p.notes, 8000) });
      if (p.setCurrent) { const before = app.version; app.version = version; if (before !== version) this.log(ctx, "update", "app", app.id, app, `Version ${before || "—"} → ${version}`, [{ field: "version", from: before, to: version }]); }
      this.touch(app);
      this.log(ctx, created ? "create" : "update", "release", release.id, app, `${created ? "Published" : "Edited"} release ${release.version}${release.title ? ` — ${release.title}` : ""}`);
      return release;
    }, { write: true });

    this.on("releases.delete", (ctx, p) => {
      const release = this.db.releases.find((r) => r.id === p.id);
      if (!release) throw new ApiError(404, "Release not found.");
      const app = this.app(ctx, release.appId, "edit");
      this.db.releases = this.db.releases.filter((r) => r.id !== release.id);
      this.log(ctx, "delete", "release", release.id, app, `Deleted release ${release.version}`);
    }, { write: true });

    /* ---------- attachments ---------- */
    this.on("files.upload", (ctx, p) => {
      const app = this.app(ctx, p.appId, "edit");
      const dataUrl = String(p.dataUrl ?? "");
      if (!dataUrl.startsWith("data:")) throw new ApiError(400, "Invalid file.");
      const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      const size = Number(p.size) || Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
      if (size > MAX_ATTACHMENT) throw new ApiError(413, "Files must be 8 MB or smaller.");
      const file: Attachment = { id: uid(), appId: app.id, name: clean(p.name, 200) || "file", size, type: clean(p.type, 120) || "application/octet-stream", dataUrl, uploadedAt: nowIso(), uploadedBy: ctx.user.name };
      this.db.attachments.push(file);
      this.touch(app);
      this.log(ctx, "upload", "file", file.id, app, `Uploaded ${file.name}`);
      const { dataUrl: _d, ...meta } = file;
      return meta;
    }, { write: true });

    this.on("files.get", (ctx, p) => {
      const file = this.db.attachments.find((f) => f.id === p.id);
      if (!file) throw new ApiError(404, "File not found.");
      this.app(ctx, file.appId, "view");
      return file;
    });

    this.on("files.delete", (ctx, p) => {
      const file = this.db.attachments.find((f) => f.id === p.id);
      if (!file) throw new ApiError(404, "File not found.");
      const app = this.app(ctx, file.appId, "edit");
      this.db.attachments = this.db.attachments.filter((f) => f.id !== file.id);
      this.log(ctx, "delete", "file", file.id, app, `Deleted file ${file.name}`);
    }, { write: true });

    /* ---------- screenshots ---------- */
    this.on("shots.add", (ctx, p) => this.addScreenshot(ctx.user, p.appId, p), { write: true });

    this.on("shots.get", (ctx, p) => {
      const shot = this.screenshotFor(ctx.user, p.id);
      if (!shot) throw new ApiError(404, "Screenshot not found.");
      return shot;
    });

    this.on("shots.update", (ctx, p) => {
      const shot = this.db.screenshots.find((x) => x.id === p.id);
      if (!shot) throw new ApiError(404, "Screenshot not found.");
      const app = this.app(ctx, shot.appId, "edit");
      const before = shot.caption;
      shot.caption = clean(p.caption, 200);
      if (before !== shot.caption) this.log(ctx, "update", "screenshot", shot.id, app, `Captioned a screenshot “${shot.caption}”`, [{ field: "caption", from: before, to: shot.caption }]);
      const { dataUrl: _d, ...meta } = shot;
      return meta;
    }, { write: true });

    this.on("shots.cover", (ctx, p) => {
      const shot = this.db.screenshots.find((x) => x.id === p.id);
      if (!shot) throw new ApiError(404, "Screenshot not found.");
      const app = this.app(ctx, shot.appId, "edit");
      app.coverShotId = shot.id;
      this.touch(app);
      this.log(ctx, "update", "app", app.id, app, `Changed the cover image of ${app.name}`);
    }, { write: true });

    this.on("shots.move", (ctx, p: { id: string; dir: -1 | 1 }) => {
      const shot = this.db.screenshots.find((x) => x.id === p.id);
      if (!shot) throw new ApiError(404, "Screenshot not found.");
      this.app(ctx, shot.appId, "edit");
      const list = this.db.screenshots.filter((x) => x.appId === shot.appId).sort((a, b) => a.order - b.order);
      const i = list.indexOf(shot);
      const j = i + (p.dir < 0 ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j]!, list[i]!];
      list.forEach((x, k) => (x.order = k));
    }, { write: true });

    this.on("shots.delete", (ctx, p) => {
      const shot = this.db.screenshots.find((x) => x.id === p.id);
      if (!shot) throw new ApiError(404, "Screenshot not found.");
      const app = this.app(ctx, shot.appId, "edit");
      this.db.screenshots = this.db.screenshots.filter((x) => x.id !== shot.id);
      if (app.coverShotId === shot.id) app.coverShotId = null;
      this.touch(app);
      this.log(ctx, "delete", "screenshot", shot.id, app, `Deleted a screenshot${shot.caption ? ` “${shot.caption}”` : ""}`);
    }, { write: true });

    this.on("usage.live", (ctx, p) => { this.app(ctx, p.appId, "view"); return this.liveUsage(p.appId); });

    /* ---------- logs ---------- */
    this.on("logs.list", (ctx, p: { appId?: string | string[]; userId?: string | string[]; action?: string | string[]; entity?: string | string[]; q?: string; from?: string; to?: string; limit?: number; offset?: number }): Paged<LogEntry> => {
      const set = (v: string | string[] | undefined) => (Array.isArray(v) ? (v.length ? new Set(v) : null) : v ? new Set([v]) : null);
      const apps = set(p.appId), users = set(p.userId), actions = set(p.action), entities = set(p.entity);
      const visible = new Set(this.visibleApps(ctx.user).map((a) => a.id));
      const q = (p.q ?? "").toLowerCase();
      const items = this.db.logs.filter((l) => {
        if (ctx.user.role !== "admin" && !(l.appId ? visible.has(l.appId) : l.userId === ctx.user.id)) return false;
        if (apps && !apps.has(l.appId ?? "")) return false;
        if (users && !users.has(l.userId ?? "")) return false;
        if (actions && !actions.has(l.action)) return false;
        if (entities && !entities.has(l.entity)) return false;
        if (p.from && l.at < p.from) return false;
        if (p.to && l.at > p.to + "T23:59:59.999Z") return false;
        if (q && !`${l.summary} ${l.userName} ${l.appName ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const offset = Math.max(0, Number(p.offset) || 0);
      const limit = Math.min(1000, Math.max(1, Number(p.limit) || 50));
      return { items: items.slice(offset, offset + limit), total: items.length };
    });

    /* ---------- dashboard ---------- */
    this.on("dashboard", (ctx): DashboardStats => {
      const apps = this.visibleApps(ctx.user);
      const ids = new Set(apps.map((a) => a.id));
      const summaries = apps.map((a) => this.summarize(ctx.user, a));
      const today = ymd();
      const tasks = this.db.tasks.filter((t) => ids.has(t.appId));
      const usage = this.usageSummary(ids);
      const from = addDays(today, -29);
      const series = Array.from({ length: 30 }, (_, i) => ({ date: addDays(from, i), sessions: 0, activeUsers: 0, launches: 0 }));
      const index = new Map(series.map((s, i) => [s.date, i]));
      for (const u of this.db.usage) {
        const i = ids.has(u.appId) ? index.get(u.date) : undefined;
        if (i !== undefined) { series[i]!.sessions += u.sessions; series[i]!.activeUsers += u.activeUsers; }
      }
      for (const l of this.db.launches) {
        const i = ids.has(l.appId) ? index.get(ymd(new Date(l.at))) : undefined;
        if (i !== undefined) series[i]!.launches++;
      }
      const soon = addDays(today, 14);
      return {
        totals: {
          apps: apps.length,
          live: apps.filter((a) => a.status === "live").length,
          inProgress: apps.filter((a) => ["development", "testing", "uat"].includes(a.status)).length,
          avgProgress: summaries.length ? Math.round(summaries.reduce((s, a) => s + a.progress, 0) / summaries.length) : 0,
          tasksOpen: tasks.filter((t) => !t.done).length,
          overdue: tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today).length,
          sessions30: usage.sessions30,
          trend: usage.trend,
          users: this.db.users.filter((u) => u.active).length,
        },
        byStatus: APP_STATUSES.map((status) => ({ status, count: apps.filter((a) => a.status === status).length })).filter((s) => s.count),
        usageSeries: series,
        topApps: summaries.sort((a, b) => b.usage.sessions30 - a.usage.sessions30).slice(0, 6).map((a) => ({ id: a.id, name: a.name, sessions: a.usage.sessions30, tone: a.tone })),
        dueSoon: tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= soon).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).slice(0, 8)
          .map((t) => ({ ...t, appName: apps.find((a) => a.id === t.appId)?.name ?? "" })),
        recent: this.db.logs.filter((l) => ctx.user.role === "admin" || (l.appId ? ids.has(l.appId) : l.userId === ctx.user.id)).slice(0, 12),
        ...this.dashboardExtras(ctx.user, apps, summaries, tasks, series.map((x) => x.date)),
      };
    });

    /* ---------- admin: backup / restore / reset ---------- */
    this.on("admin.export", (ctx) => {
      this.admin(ctx);
      this.log(ctx, "export", "backup", null, null, "Downloaded a full backup");
      return { ...this.db, sessions: [] };
    }, { write: true });

    this.on("admin.import", (ctx, p: { db: DB }) => {
      this.admin(ctx);
      const db = p.db;
      if (!db || !Array.isArray(db.users) || !Array.isArray(db.apps)) throw new ApiError(400, "That file isn't an IT Manager backup.");
      if (!db.users.some((u) => u.role === "admin" && u.active)) throw new ApiError(400, "The backup has no active administrator.");
      const sessions = this.db.sessions;
      this.db = this.migrate({ ...emptyDb(), ...db, sessions: [] });
      // keep the current admin signed in if they exist in the backup
      this.db.sessions = sessions.filter((s) => this.db.users.some((u) => u.id === s.userId));
      this.log(ctx, "restore", "backup", null, null, `Restored a backup (${db.apps.length} applications, ${db.users.length} users)`);
      return { apps: this.db.apps.length, users: this.db.users.length };
    }, { write: true });

    this.on("admin.fillDetails", (ctx, p: { overwrite?: boolean }) => {
      this.admin(ctx);
      return this.fillDetails(ctx, p.overwrite ? "overwrite" : "fill");
    }, { write: true });

    this.on("admin.loadLandscape", (ctx) => {
      this.admin(ctx);
      return this.loadLandscape(ctx);
    }, { write: true });

    this.on("admin.clearUsage", (ctx) => {
      this.admin(ctx);
      const before = this.db.usage.length;
      this.db.usage = this.db.usage.filter((u) => u.source === "auto");
      this.db.launches = [];
      const removed = before - this.db.usage.length;
      this.log(ctx, "reset", "usage", null, null, `Cleared ${removed} sample/manual usage entries (kept automatic tracking)`);
      return { removed };
    }, { write: true });

    this.on("admin.reset", async (ctx, p: { mode: "sample" | "empty" }) => {
      this.admin(ctx);
      const me = ctx.user;
      const sessions = this.db.sessions;
      if (p.mode === "sample") {
        this.db = await sampleDb();
        if (!this.db.users.some((u) => u.id === me.id)) this.db.users.unshift(me);
      } else {
        const users = this.db.users;
        this.db = emptyDb();
        this.db.users = users;
      }
      this.db.sessions = sessions.filter((s) => this.db.users.some((u) => u.id === s.userId));
      this.log(ctx, "reset", "backup", null, null, p.mode === "sample" ? "Reloaded sample data" : "Cleared all applications (users kept)");
      return { ok: true };
    }, { write: true });
  }

  /* ---------------------------------------------------- builders ---------------------------------------------------- */

  private rowToApp(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of ["name", "code", "tagline", "description", "category", "department", "url", "version", "cover"]) if (row[k] !== undefined && row[k] !== "") out[k] = row[k];
    if (row.status) {
      const s = String(row.status).toLowerCase().trim().replace(/\s+/g, "-");
      out.status = (APP_STATUSES as readonly string[]).includes(s) ? s : s === "production" || s === "prod" ? "live" : s === "dev" ? "development" : undefined;
    }
    if (row.priority) out.priority = String(row.priority).toLowerCase();
    if (row.techStack) out.techStack = splitList(row.techStack);
    if (row.startDate) out.startDate = row.startDate;
    if (row.goLiveDate) out.goLiveDate = row.goLiveDate;
    if (row.seats !== undefined && row.seats !== "") out.seats = row.seats;
    if (row.activeUsers !== undefined && row.activeUsers !== "") out.activeUsersManual = row.activeUsers;
    if (row.hosting) out.hosting = row.hosting;
    if (row.vendor) { out.vendor = row.vendor; out.source = "vendor"; }
    if (row.source) out.source = row.source;
    if (row.ticketKeywords) out.ticketKeywords = row.ticketKeywords;
    if (row.owner) {
      const key = String(row.owner).toLowerCase().trim();
      const owner = this.db.users.find((u) => u.name.toLowerCase() === key || u.username === key || u.email.toLowerCase() === key);
      if (owner) out.ownerId = owner.id;
    }
    return out;
  }

  private applyAppFields(app: App, p: Record<string, any>, partial = false) {
    const set = <K extends keyof App>(k: K, v: App[K]) => { app[k] = v; };
    if ("name" in p) set("name", clean(p.name, 120) || app.name);
    if ("code" in p) set("code", clean(p.code, 40).toUpperCase());
    for (const k of ["tagline", "category", "department", "version"] as const) if (k in p) set(k, clean(p[k], k === "tagline" ? 200 : 80));
    if ("description" in p) set("description", clean(p.description, 6000));
    if ("url" in p) set("url", normalizeUrl(p.url));
    if ("status" in p && APP_STATUSES.includes(p.status)) set("status", p.status as AppStatus);
    if ("priority" in p && PRIORITIES.includes(p.priority)) set("priority", p.priority as Priority);
    if ("environments" in p && Array.isArray(p.environments)) set("environments", p.environments.map((e: any) => ({ label: clean(e?.label, 40), url: normalizeUrl(e?.url) })).filter((e: { label: string; url: string }) => e.url).slice(0, 12));
    if ("techStack" in p) set("techStack", splitList(p.techStack).slice(0, 20));
    if ("ownerId" in p) set("ownerId", this.db.users.some((u) => u.id === p.ownerId) ? p.ownerId : null);
    if ("cover" in p) set("cover", String(p.cover ?? "").slice(0, 3_000_000));
    // a logo link handed back from the list (/api/logo/…) means "unchanged"
    if ("logo" in p && !String(p.logo ?? "").startsWith("/api/logo/")) { set("logo", String(p.logo ?? "").slice(0, 600_000)); app.logoSource = app.logo ? "upload" : ""; }
    if ("seats" in p) set("seats", Math.max(0, Math.round(toNumber(p.seats))));
    if ("activeUsersManual" in p) set("activeUsersManual", Math.max(0, Math.round(toNumber(p.activeUsersManual))));
    if ("hosting" in p) { const h = normHosting(p.hosting); if (h !== null) set("hosting", h); }
    if ("source" in p) set("source", String(p.source).toLowerCase().startsWith("v") || String(p.source).toLowerCase().includes("third") ? "vendor" : "in-house");
    if ("vendor" in p) set("vendor", clean(p.vendor, 80));
    if ("ticketKeywords" in p) set("ticketKeywords", splitList(p.ticketKeywords).map((k) => k.slice(0, 60)).slice(0, 30));
    if ("tone" in p) set("tone", (Math.min(5, Math.max(1, Number(p.tone) || 1)) as Tone));
    for (const k of ["startDate", "goLiveDate"] as const) if (k in p) set(k, normalizeDate(p[k]));
    void partial;
  }

  private buildApp(ctx: Ctx, p: Record<string, any>): App {
    const now = nowIso();
    const app: App = {
      id: uid(), name: "", code: "", tagline: "", description: "", category: "Internal tool", department: "", status: "planning", priority: "medium",
      url: "", environments: [], techStack: [], ownerId: ctx.user.id, version: "", cover: "", logo: "", coverShotId: null, seats: 0, activeUsersManual: 0, hosting: "", source: "in-house", vendor: "", ticketKeywords: [], tone: ((this.db.apps.length % 5) + 1) as Tone,
      startDate: ymd(), goLiveDate: "", visibility: "public", acl: {}, createdAt: now, updatedAt: now, createdBy: ctx.user.id,
    };
    this.applyAppFields(app, p);
    if (!app.name) throw new ApiError(400, "Application name is required.");
    if (!app.code) app.code = app.name.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase().slice(0, 16);
    if (this.db.apps.some((a) => a.code === app.code)) app.code = `${app.code}_${this.db.apps.length + 1}`;
    if (p.visibility === "restricted") app.visibility = "restricted";
    return app;
  }

  private addTemplateTasks(app: App) {
    const template: [string, string[]][] = [
      ["Planning & requirements", ["Gather requirements from stakeholders", "Sign off scope document"]],
      ["Development", ["Set up repository & environments", "Build core features", "Code review"]],
      ["Testing & UAT", ["Internal QA", "User acceptance testing", "Fix UAT issues"]],
      ["Go-live & handover", ["Deploy to production", "Write user manual", "Train users"]],
    ];
    const done = ({ planning: 0, development: 2, testing: 6, uat: 7, live: 12, maintenance: 12, "on-hold": 1, retired: 12 } as Record<AppStatus, number>)[app.status];
    let n = 0;
    template.forEach(([title, tasks], gi) => {
      const group: TaskGroup = { id: uid(), appId: app.id, title, order: gi, createdAt: nowIso() };
      this.db.groups.push(group);
      tasks.forEach((t) => {
        const task = this.buildTask(group, { title: t });
        if (n++ < done) { task.done = true; task.doneAt = nowIso(); task.doneBy = "Template"; }
        this.db.tasks.push(task);
      });
    });
  }

  private buildTask(group: TaskGroup, p: Record<string, any>, doneBy = "Import"): Task {
    const done = Boolean(p.done);
    return {
      id: uid(), appId: group.appId, groupId: group.id, title: clean(p.title, 300), notes: clean(p.notes, 4000), done, doneAt: done ? nowIso() : null, doneBy: done ? doneBy : null,
      assignee: this.assigneeName(p.assignee), dueDate: normalizeDate(p.dueDate), priority: PRIORITIES.includes(p.priority) ? p.priority : "medium",
      order: this.db.tasks.filter((t) => t.groupId === group.id).length, createdAt: nowIso(),
    };
  }

  private upsertUsage(app: App, p: Record<string, any>, source: UsageEntry["source"]) {
    const existing = this.db.usage.find((u) => u.appId === app.id && u.date === p.date);
    const values = {
      activeUsers: Math.max(0, Math.round(toNumber(p.activeUsers))),
      sessions: Math.max(0, Math.round(toNumber(p.sessions))),
      transactions: Math.max(0, Math.round(toNumber(p.transactions))),
      avgMinutes: Math.max(0, Math.round(toNumber(p.avgMinutes) * 10) / 10),
      notes: clean(p.notes, 500),
    };
    if (existing) { Object.assign(existing, values, { source }); return { entry: existing, created: false }; }
    const entry: UsageEntry = { id: uid(), appId: app.id, date: p.date, ...values, source, createdAt: nowIso() };
    this.db.usage.push(entry);
    return { entry, created: true };
  }
}

function normHosting(v: unknown): App["hosting"] | null {
  const s = String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "";
  if (s.startsWith("onprem") || s === "onpremise" || s === "lan" || s === "local" || s === "server") return "on-prem";
  if (s === "saas") return "saas";
  if (s.startsWith("cloud") || s === "azure" || s === "aws") return "cloud";
  if (s.startsWith("desktop") || s === "installed") return "desktop";
  return (HOSTINGS as readonly string[]).includes(s) ? (s as App["hosting"]) : null;
}

function normalizeUrl(value: unknown) {
  const s = String(value ?? "").trim().slice(0, 500);
  if (!s) return "";
  if (/^(https?:|mailto:|ftp:|\\\\|file:)/i.test(s)) return s;
  return `https://${s}`;
}


export { pick, publicUser };
