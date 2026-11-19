// IT Manager API server.
//   npm run dev     → API on :4000 + Vite on :5173 (proxied /api)
//   npm run build && npm start → single server on :4000 serving the built app and the API
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { ApiError, Service, type Store } from "../src/core/service.ts";
import type { DB } from "../src/core/types.ts";
import { fetchTickets, sdpConfigured } from "./sdp.ts";
import { landscapeItemFor } from "../src/core/landscape.ts";

// Optional .env next to package.json (ServiceDesk Plus keys etc.) — never committed.
try { process.loadEnvFile(path.resolve(import.meta.dirname, "../.env")); } catch { /* no .env */ }

const PORT = Number(process.env.PORT ?? 4000);
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(import.meta.dirname, "data"));
const DB_FILE = path.join(DATA_DIR, "db.json");
const DIST = path.resolve(import.meta.dirname, "../dist");
const SEED = process.env.SEED !== "false"; // SEED=false → start empty with admin/admin123

class FileStore implements Store {
  async load() {
    if (!fs.existsSync(DB_FILE)) return null;
    const raw = await fs.promises.readFile(DB_FILE, "utf8");
    // keep one rolling copy of the last good file from startup
    await fs.promises.writeFile(DB_FILE + ".bak", raw);
    return JSON.parse(raw) as DB;
  }
  async save(db: DB) {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(db));
    await fs.promises.rename(tmp, DB_FILE);
  }
}

const service = await new Service(new FileStore(), { seed: SEED }).init();
const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "40mb" }));

const tokenOf = (req: express.Request) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || null;

function fail(res: express.Response, e: unknown) {
  if (e instanceof ApiError) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: "Something went wrong on the server." });
}

/* ----------------------------- usage tracking ----------------------------- */
// track.js is embedded in each application; it posts tiny text/plain beacons (no CORS preflight) to /api/track.
const TRACK_JS = fs.readFileSync(path.join(import.meta.dirname, "public", "track.js"), "utf8");
app.get("/track.js", (_req, res) => {
  res.setHeader("content-type", "application/javascript; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=3600");
  res.setHeader("access-control-allow-origin", "*");
  res.end(TRACK_JS);
});
let trackSave: NodeJS.Timeout | null = null;
const trackEmitAt = new Map<string, number>();
app.post("/api/track", express.text({ type: "*/*", limit: "8kb" }), (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    const tracked = service.track(body);
    if (tracked) {
      if (!trackSave) trackSave = setTimeout(() => { trackSave = null; void service.persistNow(); }, 10_000);
      const last = trackEmitAt.get(tracked.id) ?? 0;
      if (Date.now() - last > 30_000) { // let open IT Manager screens refresh, at most twice a minute per app
        trackEmitAt.set(tracked.id, Date.now());
        service.emitChange({ method: "usage.track", userId: "tracker", userName: "Tracker", appId: tracked.id, summary: "", at: new Date().toISOString() });
      }
    }
  } catch { /* ignore malformed beacons */ }
  res.status(204).end();
});
setInterval(() => { if (service.pruneTracking(3)) void service.persistNow(); }, 6 * 3600e3).unref();

/* ----------------------------- live refresh ----------------------------- */
// Server-Sent Events: every open browser keeps one connection and is told about each saved change,
// so lists, dashboards and task boards update on everyone's screen within a second.
const clients = new Set<{ res: express.Response; userId: string }>();
app.get("/api/events", (req, res) => {
  const user = service.authenticate((req.query.t as string) || tokenOf(req));
  if (!user) return res.status(401).end();
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
  res.write(`event: hello\ndata: ${JSON.stringify({ online: clients.size + 1 })}\n\n`);
  const client = { res, userId: user.id };
  clients.add(client);
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => { clearInterval(ping); clients.delete(client); });
});
service.onChange((e) => {
  const data = `event: change\ndata: ${JSON.stringify(e)}\n\n`;
  for (const c of clients) c.res.write(data);
});

/* ----------------------------- screenshots ----------------------------- */
// Real images of each application. Served as files (not inlined in JSON) so lists stay light.
app.get("/api/shot/:id", (req, res) => {
  const user = service.authenticate((req.query.t as string) || tokenOf(req));
  const shot = user && service.screenshotFor(user, req.params.id);
  if (!shot) return res.status(404).end();
  const [meta, b64 = ""] = shot.dataUrl.split(",");
  res.setHeader("content-type", meta!.slice(5).split(";")[0] || "image/jpeg");
  res.setHeader("cache-control", "private, max-age=31536000, immutable");
  res.end(Buffer.from(b64, "base64"));
});

// Headless browser for "Capture from link". Uses the Edge or Chrome already installed on the server
// (no download needed); set CAPTURE_BROWSER to a chrome/msedge executable to choose one explicitly.
type Browser = import("playwright-core").Browser;
let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const attempts: Parameters<typeof chromium.launch>[0][] = [];
      if (process.env.CAPTURE_BROWSER) attempts.push({ executablePath: process.env.CAPTURE_BROWSER });
      attempts.push({ channel: "msedge" }, { channel: "chrome" }, {});
      let last: unknown;
      for (const opts of attempts) {
        try { return await chromium.launch({ headless: true, ...opts, args: ["--disable-dev-shm-usage", "--no-sandbox"] }); } catch (e) { last = e; }
      }
      throw new Error(`No Chrome/Edge found for screenshots. Install Edge or Chrome on the server, or set CAPTURE_BROWSER. (${(last as Error)?.message?.split("\n")[0]})`);
    })();
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

type CaptureOptions = {
  width?: number; height?: number; delay?: number; fullPage?: boolean;
  /** Extra pages to capture after the first one: paths ("/reports") or full URLs. */
  pages?: string[];
  /** Optional sign-in, typed at capture time and never stored. */
  login?: { username?: string; password?: string };
};

type Shot = { dataUrl: string; width: number; height: number; title: string; url: string };

async function capture(url: string, opts: CaptureOptions): Promise<Shot[]> {
  const browser = await getBrowser();
  const width = Math.min(2560, Math.max(320, Number(opts.width) || 1440));
  const height = Math.min(2000, Math.max(300, Number(opts.height) || 900));
  const delay = Math.min(15_000, Math.max(0, Number(opts.delay) || 1200));
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const open = async (target: string) => {
    try { await page.goto(target, { waitUntil: "networkidle", timeout: 25_000 }); }
    catch { await page.goto(target, { waitUntil: "load", timeout: 25_000 }); }
  };
  const snap = async (): Promise<Shot> => {
    await page.waitForTimeout(delay);
    const buffer = await page.screenshot({ type: "jpeg", quality: 82, fullPage: !!opts.fullPage });
    const dims = opts.fullPage ? await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })) : { w: width, h: height };
    return { dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`, width: dims.w, height: Math.min(dims.h, 16000), title: await page.title(), url: page.url() };
  };
  try {
    await open(url);
    if (opts.login?.username && opts.login?.password) {
      const pw = page.locator("input[type=password]:visible").first();
      if (await pw.count()) {
        // the username box is the last visible text-like input before the password box
        const user = page.locator("input:visible:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])");
        const n = await user.count();
        if (n) await user.nth(0).fill(opts.login.username);
        await pw.fill(opts.login.password);
        await Promise.all([page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined), pw.press("Enter")]);
        await page.waitForTimeout(800);
      }
    }
    const shots = [await snap()];
    for (const p of (opts.pages ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 10)) {
      await open(new URL(p, url).toString());
      shots.push(await snap());
    }
    return shots;
  } finally {
    await context.close();
  }
}

app.post("/api/apps.capture", async (req, res) => {
  try {
    const user = service.authenticate(tokenOf(req));
    if (!user) throw new ApiError(401, "Please sign in again.");
    const target = service.db.apps.find((a) => a.id === req.body?.id);
    if (!target) throw new ApiError(404, "Application not found.");
    const url = String(req.body?.url || target.url || "");
    if (!/^https?:/i.test(url)) throw new ApiError(400, "Set an http(s) link for this application first.");
    if (service.permission(user, target) !== "edit") throw new ApiError(403, `You have view-only rights on ${target.name}.`);
    let shots: Shot[];
    try { shots = await capture(url, req.body ?? {}); }
    catch (e) { throw new ApiError(502, `Couldn't capture ${url}: ${(e as Error).message.split("\n")[0]}`); }
    const metas = shots.map((shot, i) => service.addScreenshot(user, target.id, { ...shot, source: "capture", caption: shot.title || "", setCover: !!req.body?.setCover && i === 0 }));
    await service.persistNow();
    service.emitChange({ method: "apps.capture", userId: user.id, userName: user.name, appId: target.id, summary: `Captured ${metas.length} screenshot(s) of ${target.name}`, at: new Date().toISOString() });
    res.json({ shots: metas });
  } catch (e) {
    fail(res, e);
  }
});

app.post("/api/apps.captureAll", async (req, res) => {
  try {
    const user = service.authenticate(tokenOf(req));
    if (!user) throw new ApiError(401, "Please sign in again.");
    const onlyMissing = req.body?.onlyMissing !== false;
    const targets = service.db.apps.filter((a) => /^https?:/i.test(a.url) && service.permission(user, a) === "edit" && (!onlyMissing || !service.db.screenshots.some((x) => x.appId === a.id)));
    const result = { captured: 0, failed: [] as string[], skipped: service.db.apps.length - targets.length };
    const queue = [...targets];
    await Promise.all([0, 1].map(async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        try {
          const [shot] = await capture(a.url, {});
          service.addScreenshot(user, a.id, { ...shot!, source: "capture", caption: shot!.title, setCover: true });
          result.captured++;
        } catch (e) {
          result.failed.push(`${a.name}: ${(e as Error).message.split("\n")[0]}`);
        }
      }
    }));
    await service.persistNow();
    (result as { logos?: number }).logos = await logoCovers().catch(() => 0);
    if (result.captured) service.emitChange({ method: "apps.captureAll", userId: user.id, userName: user.name, appId: null, summary: `Captured ${result.captured} screenshot(s)`, at: new Date().toISOString() });
    res.json(result);
  } catch (e) {
    fail(res, e);
  }
});

// Server-only: check whether an application's link answers (browsers can't, because of CORS).
app.post("/api/apps.ping", async (req, res) => {
  try {
    const user = service.authenticate(tokenOf(req));
    if (!user) throw new ApiError(401, "Please sign in again.");
    const target = service.db.apps.find((a) => a.id === req.body?.id);
    if (!target || !service.permission(user, target)) throw new ApiError(404, "Application not found.");
    const url = (req.body?.url as string) || target.url;
    if (!url || !/^https?:/i.test(url)) return res.json({ ok: false, status: 0, ms: 0, error: "No http(s) link set" });
    const started = Date.now();
    try {
      const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
      res.json({ ok: r.status < 500, status: r.status, ms: Date.now() - started });
    } catch (err) {
      res.json({ ok: false, status: 0, ms: Date.now() - started, error: (err as Error).message });
    }
  } catch (e) {
    fail(res, e);
  }
});


/* ---------- ServiceDesk Plus ticket sync ---------- */
let syncing: Promise<{ added: number; updated: number; fetched: number; total: number }> | null = null;
function syncTickets(full: boolean) {
  if (!sdpConfigured()) return Promise.reject(new ApiError(400, "ServiceDesk Plus isn't connected yet — add the SDP_* keys to the .env file on the server and restart."));
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const known = new Map(service.db.tickets.map((t) => [t.id, t]));
      const { tickets, total } = await fetchTickets({ pages: full ? undefined : 3, known });
      const r = service.ingestTickets(tickets, { total });
      await service.persistNow();
      service.emitChange({ method: "tickets.sync", userId: "system", userName: "ServiceDesk Plus", appId: null, summary: `Synced ${tickets.length} ticket(s)`, at: new Date().toISOString() });
      console.log(`[tickets] synced ${tickets.length} (${r.added} new)`);
      return { ...r, fetched: tickets.length, total };
    } catch (e) {
      service.ticketSyncFailed((e as Error).message);
      await service.persistNow();
      console.log("[tickets] sync failed:", (e as Error).message);
      throw e instanceof ApiError ? e : new ApiError(502, (e as Error).message);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

app.post("/api/tickets.sync", async (req, res) => {
  try {
    const user = service.authenticate(tokenOf(req));
    if (!user) throw new ApiError(401, "Please sign in again.");
    if (user.role !== "admin") throw new ApiError(403, "Only administrators can sync tickets.");
    res.json(await syncTickets(req.body?.full !== false));
  } catch (e) {
    fail(res, e);
  }
});

if (sdpConfigured()) {
  const minutes = Math.max(2, Number(process.env.SDP_SYNC_MINUTES ?? 10));
  let runs = 0;
  const tick = () => { const full = runs++ % Math.max(1, Math.round(360 / minutes)) === 0; void syncTickets(full).catch(() => undefined); };
  setTimeout(tick, 6000);
  setInterval(tick, minutes * 60e3).unref();
  console.log(`[tickets] ServiceDesk Plus sync every ${minutes} min (full sync every ~6 h)`);
}

app.post("/api/:method", async (req, res) => {
  try {
    const params = req.params.method === "logout" ? { token: tokenOf(req) } : req.body;
    const result = await service.call(req.params.method, params, tokenOf(req));
    res.json(result ?? { ok: true });
  } catch (e) {
    fail(res, e);
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, apps: service.db.apps.length, time: new Date().toISOString() }));

if (fs.existsSync(DIST)) {
  // index.html is never cached, so a new build shows up on the next refresh; hashed /assets files can be cached for a long time
  app.use(express.static(DIST, {
    index: "index.html",
    setHeaders: (res, file) => res.setHeader("Cache-Control", file.endsWith(".html") ? "no-cache" : /[\\/]assets[\\/]/.test(file) ? "public, max-age=31536000, immutable" : "public, max-age=3600"),
  }));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api") ? res.setHeader("Cache-Control", "no-cache").sendFile(path.join(DIST, "index.html")) : next()));
}


/* Logo covers: apps with no screenshot (desktop software like SAP GUI / Tally, or sign-in pages that block capture)
   get a cover with the vendor's logo, fetched once on the server and stored with the app. */
const TONES = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"];
const xml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
function logoDomain(a: { name: string; url: string }) {
  const li = landscapeItemFor(a.name);
  if (li?.domain) return li.domain;
  try {
    const h = new URL(a.url).hostname;
    if (/^(\d+\.){3}\d+$/.test(h) || h === "localhost" || !h.includes(".") || /\.(local|lan|internal)$/.test(h)) return "";
    return h.replace(/^(www|app|login)\./, "");
  } catch { return ""; }
}
async function logoCover(a: (typeof service.db.apps)[number]) {
  const domain = logoDomain(a);
  if (!domain) return false;
  const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
  let buf: Buffer | null = null, type = "image/png";
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(10_000) });
    if (r.ok) { buf = Buffer.from(await r.arrayBuffer()); type = r.headers.get("content-type") || type; }
  } catch { /* no direct internet (company proxy) — try through Edge below */ }
  if (!buf) {
    // Edge uses the Windows proxy settings, so this works where Node's own requests can't get out
    const ctx = await (await getBrowser()).newContext();
    try {
      const res = await (await ctx.newPage()).goto(src, { timeout: 15_000 });
      if (res?.ok()) { buf = await res.body(); type = res.headers()["content-type"] || type; }
    } finally { await ctx.close(); }
  }
  if (!buf || buf.length < 400) return false; // nothing, or the generic globe
  const tone = TONES[((a.tone || 1) - 1) % 5]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tone}" stop-opacity=".22"/><stop offset="1" stop-color="${tone}" stop-opacity=".06"/></linearGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="${tone}" flood-opacity=".35"/></filter></defs>
<rect width="1280" height="800" fill="#f8fafc"/><rect width="1280" height="800" fill="url(#g)"/>
<circle cx="1120" cy="120" r="260" fill="${tone}" opacity=".10"/><circle cx="140" cy="720" r="200" fill="${tone}" opacity=".08"/>
<rect x="490" y="170" width="300" height="300" rx="64" fill="#fff" filter="url(#s)"/>
<image href="data:${type};base64,${buf.toString("base64")}" x="540" y="220" width="200" height="200" preserveAspectRatio="xMidYMid meet"/>
<text x="640" y="580" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="64" font-weight="700" fill="#0f172a">${xml(a.name)}</text>
<text x="640" y="640" text-anchor="middle" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="30" fill="#64748b">${xml(a.vendor || a.category || "")}</text></svg>`;
  a.cover = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return true;
}
async function logoCovers() {
  let n = 0;
  for (const a of service.db.apps) {
    if (a.cover || service.db.screenshots.some((x) => x.appId === a.id)) continue;
    try { if (await logoCover(a)) n++; } catch { /* offline or blocked — keep the generated cover */ }
  }
  if (n) {
    await service.persistNow();
    service.emitChange({ method: "apps.captureAll", userId: "system", userName: "System", appId: null, summary: `Added ${n} logo cover(s)`, at: new Date().toISOString() });
    console.log(`[capture] added ${n} logo cover(s)`);
  }
  return n;
}

/* Automatic capture: any app that has a link but no screenshot is captured shortly after start-up and
   retried every CAPTURE_RETRY_HOURS (apps that were down get picked up later). CAPTURE_ON_START=false turns it off. */
async function captureMissing() {
  const admin = service.db.users.find((u) => u.role === "admin" && u.active);
  if (!admin) return;
  const targets = service.db.apps.filter((a) => /^https?:/i.test(a.url) && !service.db.screenshots.some((x) => x.appId === a.id));
  if (!targets.length) return;
  console.log(`[capture] ${targets.length} app(s) without screenshots — capturing…`);
  let done = 0;
  for (const a of targets) {
    try {
      const [shot] = await capture(a.url, { delay: 2000 });
      service.addScreenshot(admin, a.id, { ...shot!, source: "capture", caption: shot!.title || a.name, setCover: true });
      done++;
      console.log(`[capture] ✓ ${a.name}`);
    } catch (e) {
      console.log(`[capture] ✗ ${a.name}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  if (done) {
    await service.persistNow();
    service.emitChange({ method: "apps.captureAll", userId: "system", userName: "System", appId: null, summary: `Captured ${done} screenshot(s)`, at: new Date().toISOString() });
  }
}
if (process.env.CAPTURE_ON_START !== "false") {
  setTimeout(() => void captureMissing().catch((e) => console.log("[capture]", e.message)).finally(() => void logoCovers().catch(() => undefined)), 4000);
  const hours = Number(process.env.CAPTURE_RETRY_HOURS ?? 6);
  if (hours > 0) setInterval(() => void captureMissing().catch(() => undefined), hours * 3600e3).unref();
}

process.on("SIGINT", async () => { try { await (await browserPromise)?.close(); } catch { /* ignore */ } process.exit(0); });

app.listen(PORT, () => {
  console.log(`IT Manager API listening on http://localhost:${PORT}  (data: ${DB_FILE})`);
});
