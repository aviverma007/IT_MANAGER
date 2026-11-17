// IT Manager API server.
//   npm run dev     → API on :4000 + Vite on :5173 (proxied /api)
//   npm run build && npm start → single server on :4000 serving the built app and the API
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { ApiError, Service, type Store } from "../src/core/service.ts";
import type { DB } from "../src/core/types.ts";

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
  app.use(express.static(DIST, { index: "index.html", maxAge: "1h" }));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api") ? res.sendFile(path.join(DIST, "index.html")) : next()));
}

process.on("SIGINT", async () => { try { await (await browserPromise)?.close(); } catch { /* ignore */ } process.exit(0); });

app.listen(PORT, () => {
  console.log(`IT Manager API listening on http://localhost:${PORT}  (data: ${DB_FILE})`);
});
