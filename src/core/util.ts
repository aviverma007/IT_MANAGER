export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

/** Local calendar date as YYYY-MM-DD. */
export function ymd(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date: string | Date, days: number) {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** Accepts many human date shapes (2024-05-01, 01/05/2024, 1-May-2024, Excel serials) → YYYY-MM-DD or "". */
export function normalizeDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !isNaN(value.getTime())) return ymd(value);
  if (typeof value === "number" && value > 20000 && value < 80000) {
    // Excel serial date
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return ymd(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(new Date(+m[1]!, +m[2]! - 1, +m[3]!));
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    // Indian / European style: DD-MM-YYYY
    const y = +m[3]! < 100 ? 2000 + +m[3]! : +m[3]!;
    return ymd(new Date(y, +m[2]! - 1, +m[1]!));
  }
  const t = Date.parse(s);
  return isNaN(t) ? "" : ymd(new Date(t));
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "").replace(/[, ]/g, ""));
  return isFinite(n) ? n : 0;
}

export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "done", "completed", "complete", "x", "✓", "✔"].includes(s);
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tiny deterministic PRNG for reproducible sample data. */
export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
