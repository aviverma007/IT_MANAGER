// Business logic for IT Manager. Pure TypeScript with no Node or DOM dependencies, so the same code runs
// behind the Express API (server/index.ts) and inside the browser for the offline demo build.
import type {
  Access, App, AppDetail, AppStatus, AppSummary, Attachment, AttachmentMeta, Change, CoverShot, Screenshot, ScreenshotMeta, DashboardStats, DB, Doc, DocKind,
  ImportResult, Launch, LogEntry, Paged, Priority, Role, Task, TaskGroup, Tone, UsageEntry, UsageSummary, User, UserRecord,
} from "./types";
import { APP_STATUSES, DOC_KINDS, PRIORITIES } from "./types";
import { hashPassword, newSalt, newToken, verifyPassword } from "./crypto";
import { addDays, normalizeDate, nowIso, splitList, toBool, toNumber, uid, ymd } from "./util";
import { emptyDb, freshDb, sampleDb } from "./seed";

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
  "techStack", "ownerId", "version", "cover", "tone", "startDate", "goLiveDate",
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

  constructor(private store: Store, private options: { seed: boolean } = { seed: true }) {
    this.register();
  }

  async init() {
    const loaded = await this.store.load();
    if (loaded && loaded.users?.length) this.db = this.migrate(loaded);
    else {
      this.db = this.options.seed ? await sampleDb() : await freshDb();
      await this.persist();
    }
    return this;
  }

  private migrate(db: DB): DB {
    const base = emptyDb();
    const out = { ...base, ...db, version: 2 };
    for (const a of out.apps) {
      if (a.coverShotId === undefined) a.coverShotId = null;
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
      shotCount: this.db.screenshots.filter((x) => x.appId === app.id).length,
    };
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

  async persistNow() {
    await this.persist();
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
      for (const key of ["groups", "tasks", "usage", "launches", "docs", "releases", "attachments", "screenshots", "favorites"] as const) {
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
      if ("assignee" in p) task.assignee = clean(p.assignee, 80);
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
          if (row.assignee) existing.assignee = clean(row.assignee, 80);
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

    /* ---------- logs ---------- */
    this.on("logs.list", (ctx, p: { appId?: string; userId?: string; action?: string; entity?: string; q?: string; from?: string; to?: string; limit?: number; offset?: number }): Paged<LogEntry> => {
      const visible = new Set(this.visibleApps(ctx.user).map((a) => a.id));
      const q = (p.q ?? "").toLowerCase();
      const items = this.db.logs.filter((l) => {
        if (ctx.user.role !== "admin" && !(l.appId ? visible.has(l.appId) : l.userId === ctx.user.id)) return false;
        if (p.appId && l.appId !== p.appId) return false;
        if (p.userId && l.userId !== p.userId) return false;
        if (p.action && l.action !== p.action) return false;
        if (p.entity && l.entity !== p.entity) return false;
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
    if ("tone" in p) set("tone", (Math.min(5, Math.max(1, Number(p.tone) || 1)) as Tone));
    for (const k of ["startDate", "goLiveDate"] as const) if (k in p) set(k, normalizeDate(p[k]));
    void partial;
  }

  private buildApp(ctx: Ctx, p: Record<string, any>): App {
    const now = nowIso();
    const app: App = {
      id: uid(), name: "", code: "", tagline: "", description: "", category: "Internal tool", department: "", status: "planning", priority: "medium",
      url: "", environments: [], techStack: [], ownerId: ctx.user.id, version: "", cover: "", coverShotId: null, tone: ((this.db.apps.length % 5) + 1) as Tone,
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
      assignee: clean(p.assignee, 80), dueDate: normalizeDate(p.dueDate), priority: PRIORITIES.includes(p.priority) ? p.priority : "medium",
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

function normalizeUrl(value: unknown) {
  const s = String(value ?? "").trim().slice(0, 500);
  if (!s) return "";
  if (/^(https?:|mailto:|ftp:|\\\\|file:)/i.test(s)) return s;
  return `https://${s}`;
}


export { pick, publicUser };
