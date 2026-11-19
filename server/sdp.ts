// ManageEngine ServiceDesk Plus Cloud → IT Manager ticket sync (read-only).
// Configure in .env next to package.json (never commit it):
//   SDP_BASE=https://sdpondemand.manageengine.com/app/itdesk   (portal URL; without /app/<portal> also works)
//   SDP_ACCOUNTS=https://accounts.zoho.com                      (accounts.zoho.in for the India data centre)
//   SDP_CLIENT_ID=…  SDP_CLIENT_SECRET=…  SDP_REFRESH_TOKEN=…   (Zoho API console → Self Client)
//   SDP_SYNC_MINUTES=10   SDP_SYNC_DAYS=365   SDP_DETAIL_LIMIT=150
import type { Ticket } from "../src/core/types.ts";
import { CLOSED_STATUS } from "../src/core/service.ts";

const env = (k: string, d = "") => (process.env[k] ?? d).trim();
export const sdpConfigured = () => !!(env("SDP_CLIENT_ID") && env("SDP_CLIENT_SECRET") && env("SDP_REFRESH_TOKEN"));
const base = () => env("SDP_BASE", "https://sdpondemand.manageengine.com/app/itdesk").replace(/\/+$/, "");

let token: { value: string; until: number } | null = null;
async function accessToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const accounts = env("SDP_ACCOUNTS", "https://accounts.zoho.com").replace(/\/+$/, "");
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: env("SDP_CLIENT_ID"), client_secret: env("SDP_CLIENT_SECRET"), refresh_token: env("SDP_REFRESH_TOKEN") });
  const r = await fetch(`${accounts}/oauth/v2/token`, { method: "POST", body, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!j.access_token) throw new Error(`Zoho token refresh failed: ${j.error ?? r.status}. Check SDP_CLIENT_ID / SDP_CLIENT_SECRET / SDP_REFRESH_TOKEN / SDP_ACCOUNTS.`);
  token = { value: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function sdpGet(path: string, input?: unknown): Promise<any> {
  const url = `${base()}/api/v3/${path}${input ? `?input_data=${encodeURIComponent(JSON.stringify(input))}` : ""}`;
  const r = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${await accessToken()}`, Accept: "application/vnd.manageengine.sdp.v3+json" },
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    const msg = j?.response_status?.[0]?.messages?.[0]?.message ?? j?.response_status?.messages?.[0]?.message ?? `HTTP ${r.status}`;
    throw new Error(`ServiceDesk Plus: ${msg}`);
  }
  return j;
}

const name = (v: any) => (v && typeof v === "object" ? String(v.name ?? v.display_value ?? "") : v == null ? "" : String(v));
const time = (v: any) => (v?.value ? new Date(Number(v.value)).toISOString() : "");

function toTicket(r: any): Ticket {
  const status = name(r.status) || "Open";
  return {
    id: String(r.id), displayId: String(r.display_id ?? r.display_key?.value ?? r.id), subject: String(r.subject ?? "(no subject)").slice(0, 300),
    status, statusColor: String(r.status?.color ?? ""), open: !CLOSED_STATUS.test(r.status?.internal_name ?? status),
    priority: name(r.priority), category: name(r.category), subcategory: name(r.subcategory), item: name(r.item), group: name(r.group), site: name(r.site ?? r.requester?.site),
    requester: name(r.requester), requesterDept: name(r.requester?.department), technician: name(r.technician),
    createdAt: time(r.created_time), dueAt: time(r.due_by_time), closedAt: time(r.resolved_time) || time(r.completed_time),
    url: `${base()}/ui/requests/${r.id}/details`, source: "sdp", overrideAppId: null,
  };
}

const FIELDS = ["subject", "status", "priority", "category", "subcategory", "item", "group", "site", "requester", "technician", "created_time", "due_by_time", "resolved_time", "completed_time"];

/** Newest-first walk over requests until older than SDP_SYNC_DAYS (or `pages` pages). Fills category/priority from
 *  request details when the list view leaves them out (capped by SDP_DETAIL_LIMIT per run). */
export async function fetchTickets(opts: { pages?: number; known?: Map<string, Ticket> } = {}) {
  const days = Number(env("SDP_SYNC_DAYS", "365")) || 365;
  const stopAt = new Date(Date.now() - days * 864e5).toISOString();
  const maxPages = opts.pages ?? 100;
  const out: Ticket[] = [];
  let total = 0;
  let withFields = true;
  for (let page = 0; page < maxPages; page++) {
    const list_info: Record<string, unknown> = { row_count: 100, start_index: page * 100 + 1, sort_field: "created_time", sort_order: "desc", get_total_count: page === 0 };
    if (withFields) list_info.fields_required = FIELDS;
    let j: any;
    try { j = await sdpGet("requests", { list_info }); }
    catch (e) { if (withFields && page === 0) { withFields = false; page--; continue; } throw e; }
    if (page === 0) total = Number(j.list_info?.total_count ?? 0);
    const rows: any[] = j.requests ?? [];
    let older = false;
    for (const r of rows) { const t = toTicket(r); if (t.createdAt && t.createdAt < stopAt) { older = true; break; } out.push(t); }
    if (older || !j.list_info?.has_more_rows || !rows.length) break;
  }
  // details for tickets the list returned without category/priority (only new or still-open ones, to stay light)
  let budget = Number(env("SDP_DETAIL_LIMIT", "150")) || 0;
  for (const t of out) {
    if (budget <= 0) break;
    if (t.category || t.priority) continue;
    const prev = opts.known?.get(t.id);
    if (prev && (prev.category || prev.priority)) { t.category = prev.category; t.subcategory = prev.subcategory; t.item = prev.item; t.priority = prev.priority; t.group ||= prev.group; continue; }
    budget--;
    try {
      const d = (await sdpGet(`requests/${t.id}`)).request;
      if (d) { const full = toTicket(d); Object.assign(t, { priority: full.priority, category: full.category, subcategory: full.subcategory, item: full.item, group: full.group || t.group, closedAt: full.closedAt || t.closedAt, dueAt: full.dueAt || t.dueAt }); }
    } catch { /* keep the list version */ }
  }
  return { tickets: out, total };
}
