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

app.listen(PORT, () => {
  console.log(`IT Manager API listening on http://localhost:${PORT}  (data: ${DB_FILE})`);
});
