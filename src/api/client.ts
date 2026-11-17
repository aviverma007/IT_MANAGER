// One API surface, two transports:
//   • server mode (default build): POST /api/<method> to the Express server
//   • demo mode (`npm run build:demo`): the same Service runs in the browser and persists to localStorage
import type { DB } from "@/core/types";
import type { Service, Store } from "@/core/service";

declare const __DEMO__: boolean;
export const DEMO = typeof __DEMO__ !== "undefined" && __DEMO__;

const TOKEN_KEY = "itm.token";
const DB_KEY = "itm.db.v1";

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ } },
};

class LocalStore implements Store {
  private memory: DB | null = null;
  async load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      return raw ? (JSON.parse(raw) as DB) : this.memory;
    } catch {
      return this.memory;
    }
  }
  async save(db: DB) {
    this.memory = db;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      window.dispatchEvent(new CustomEvent("itm:storage-full"));
    }
  }
}

let local: Promise<Service> | null = null;
async function localService() {
  if (!local) {
    local = (async () => {
      const { Service } = await import("@/core/service");
      return new Service(new LocalStore(), { seed: true }).init();
    })();
  }
  return local;
}

function unauthorized() {
  tokenStore.set(null);
  window.dispatchEvent(new CustomEvent("itm:unauthorized"));
}

export async function call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = tokenStore.get();
  if (DEMO) {
    const service = await localService();
    try {
      // structuredClone mimics the network boundary so the UI never mutates the store by reference
      const result = await service.call(method, method === "logout" ? { token } : params, token);
      return (result === undefined ? { ok: true } : structuredClone(result)) as T;
    } catch (e) {
      const err = e as { status?: number; message: string };
      if (err.status === 401 && method !== "login") unauthorized();
      throw new RequestError(err.status ?? 500, err.message);
    }
  }
  let res: Response;
  try {
    res = await fetch(`/api/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(params),
    });
  } catch {
    throw new RequestError(0, "Can't reach the IT Manager server. Check that it is running.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && method !== "login") unauthorized();
    throw new RequestError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

/** Is the app's link reachable? Server mode asks the API; demo mode does an opaque browser probe. */
export async function pingUrl(appId: string, url: string): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  if (!DEMO) {
    try {
      return await call("apps.ping", { id: appId, url });
    } catch {
      /* fall through to browser probe */
    }
  }
  if (!url) return { ok: false, status: 0, ms: 0, error: "No link set" };
  const started = performance.now();
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(8000) });
    return { ok: true, status: 0, ms: Math.round(performance.now() - started) };
  } catch (e) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - started), error: (e as Error).message };
  }
}
