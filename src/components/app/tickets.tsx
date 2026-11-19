import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Link2, Plus, RefreshCw, Search, Ticket as TicketIcon, Trash2, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { call, DEMO } from "@/api/client";
import { useApps, useRun } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { TICKET_RULE_FIELDS, type AppSummary, type TicketRow, type TicketRule, type TicketSync } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { AnimatedNumber, EmptyState, Skeleton, Tabs } from "@/components/ui/bits";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImportWizard } from "@/components/app/import-wizard";
import { cn, fmtDateTime, fmtNumber, timeAgo, toneHex } from "@/lib/utils";

export type TicketStatusInfo = { sync: TicketSync; rules: TicketRule[]; total: number; sample: boolean; canManage: boolean };
export const useTickets = (appId?: string) => useQuery({ queryKey: ["tickets", appId ?? "all"], queryFn: () => call<TicketRow[]>("tickets.list", appId ? { appId } : {}) });
export const useTicketStatus = () => useQuery({ queryKey: ["tickets-status"], queryFn: () => call<TicketStatusInfo>("tickets.status") });

const isHigh = (p: string) => /high|urgent|critical|p1|p2/i.test(p);
const RULE_LABEL: Record<string, string> = { category: "Category", subcategory: "Subcategory", item: "Item", group: "Support group", subject: "Subject", requesterDept: "Requester department", site: "Site" };
const MATCH_LABEL: Record<string, string> = { manual: "Linked by hand", rule: "Matched by a rule", keyword: "Matched by app name / keyword", "": "Not matched" };

export function PriorityPill({ p }: { p: string }) {
  if (!p) return <span className="text-xs text-muted-foreground">—</span>;
  const c = /urgent|critical|p1/i.test(p) ? "#f43f5e" : /high|p2/i.test(p) ? "#f97316" : /medium|normal|p3/i.test(p) ? "#3b82f6" : "#a1a1aa";
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium"><span className="size-2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />{p}</span>;
}
export function StatusPill({ t }: { t: Pick<TicketRow, "status" | "statusColor" | "open"> }) {
  const c = t.statusColor && t.statusColor !== "#ffffff" ? t.statusColor : t.open ? "#f59e0b" : "#10b981";
  return <span className="inline-flex max-w-36 items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: c, background: `color-mix(in oklab, ${c} 14%, transparent)` }}><span className="size-1.5 shrink-0 rounded-full" style={{ background: c }} />{t.status}</span>;
}

/** Small "🎫 3 open · 1 high" badge for app cards. */
export function TicketBadge({ app, compact }: { app: AppSummary; compact?: boolean }) {
  const t = app.tickets;
  if (!t || !t.total) return null;
  const c = t.high ? "#f43f5e" : t.open ? "#f59e0b" : "#10b981";
  return (
    <Link to={`/apps/${app.id}/tickets`} onClick={(e) => e.stopPropagation()} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold tabular-nums hover:underline", compact ? "text-[11px]" : "text-xs")} style={{ color: c, background: `color-mix(in oklab, ${c} 13%, transparent)` }} title={`${t.open} open · ${t.high} high priority · ${t.created30} raised in 30 days · ${t.total} total`}>
      <TicketIcon className="size-3" />{t.open} open{t.high ? ` · ${t.high} high` : ""}
    </Link>
  );
}

export function exportTickets(rows: TicketRow[], name = "tickets") {
  const data = rows.map((t) => ({
    "#": t.displayId, Subject: t.subject, Application: t.appName || "(unmatched)", Status: t.status, Priority: t.priority, Category: t.category, Subcategory: t.subcategory, Item: t.item,
    Group: t.group, Technician: t.technician, Requester: t.requester, Department: t.requesterDept, Created: fmtDateTime(t.createdAt), Closed: fmtDateTime(t.closedAt), Link: t.url,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Tickets");
  XLSX.writeFile(wb, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function TicketKpis({ rows }: { rows: TicketRow[] }) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const open = rows.filter((t) => t.open);
  const items = [
    { label: "Open", value: open.length, color: "#f59e0b" },
    { label: "High / urgent open", value: open.filter((t) => isHigh(t.priority)).length, color: "#f43f5e" },
    { label: "Raised (30 days)", value: rows.filter((t) => t.createdAt >= since).length, color: "#3b82f6" },
    { label: "Closed (30 days)", value: rows.filter((t) => !t.open && (t.closedAt || t.createdAt) >= since).length, color: "#10b981" },
    { label: "Unmatched", value: rows.filter((t) => !t.appId).length, color: "#a1a1aa" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {items.map((k, i) => (
        <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-3xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
          <div className="text-2xl font-bold" style={{ color: k.color }}><AnimatedNumber value={k.value} /></div>
        </motion.div>
      ))}
    </div>
  );
}

/** Sortable, filterable ticket list. `fixedApp` hides the app column and filter (app detail tab). */
export function TicketTable({ rows, fixedApp, apps }: { rows: TicketRow[]; fixedApp?: boolean; apps: AppSummary[] }) {
  const me = useMe();
  const run = useRun();
  const [q, setQ] = React.useState("");
  const [state, setState] = React.useState<"open" | "all" | "closed">("open");
  const [appSel, setAppSel] = React.useState<string[]>([]);
  const [prio, setPrio] = React.useState<string[]>([]);
  const [tech, setTech] = React.useState<string[]>([]);
  const [cat, setCat] = React.useState<string[]>([]);
  const [limit, setLimit] = React.useState(100);
  const editable = new Set(apps.filter((a) => a.permission === "edit").map((a) => a.id));
  const uniq = (f: (t: TicketRow) => string) => [...new Set(rows.map(f).filter(Boolean))].sort();

  const list = rows.filter((t) =>
    (state === "all" || (state === "open" ? t.open : !t.open)) &&
    (!appSel.length || appSel.includes(t.appId ?? "__none")) &&
    (!prio.length || prio.includes(t.priority || "—")) &&
    (!tech.length || tech.includes(t.technician || "Unassigned")) &&
    (!cat.length || cat.includes(t.category || "—")) &&
    (!q || `${t.displayId} ${t.subject} ${t.requester} ${t.category} ${t.subcategory} ${t.item} ${t.appName}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f: (t: TicketRow) => boolean) => String(rows.filter(f).length);

  async function reassign(t: TicketRow, appId: string) {
    await run("tickets.assign", { ids: [t.id], appId: appId === "__auto" ? null : appId }, { success: appId === "__auto" ? "Back to automatic matching" : "Ticket linked" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search #, subject, requester, category…" className="pl-9" />
        </div>
        <Tabs id={`tk-state-${fixedApp ? "app" : "all"}`} value={state} onChange={setState} tabs={[{ value: "open", label: "Open", count: rows.filter((t) => t.open).length }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
        {!fixedApp && <MultiSelect className="w-52" label="Applications" placeholder="All applications" value={appSel} onChange={setAppSel}
          options={[{ value: "__none", label: "Unmatched", hint: count((t) => !t.appId), color: "#a1a1aa" }, ...apps.filter((a) => rows.some((t) => t.appId === a.id)).map((a) => ({ value: a.id, label: a.name, color: toneHex(a.tone), hint: count((t) => t.appId === a.id) }))]} />}
        <MultiSelect className="w-40" label="Priority" placeholder="All priorities" searchable={false} value={prio} onChange={setPrio} options={uniq((t) => t.priority || "—").map((p) => ({ value: p, label: p, hint: count((t) => (t.priority || "—") === p) }))} />
        <MultiSelect className="w-44" label="Category" placeholder="All categories" value={cat} onChange={setCat} options={uniq((t) => t.category || "—").map((p) => ({ value: p, label: p, hint: count((t) => (t.category || "—") === p) }))} />
        <MultiSelect className="w-44" label="Technician" placeholder="All technicians" value={tech} onChange={setTech} options={uniq((t) => t.technician || "Unassigned").map((p) => ({ value: p, label: p, hint: count((t) => (t.technician || "Unassigned") === p) }))} />
        <Button variant="secondary" size="sm" onClick={() => exportTickets(list)} disabled={!list.length}><Download />Export</Button>
      </div>

      {!list.length ? (
        <EmptyState icon={<CheckCircle2 />} title={rows.length ? "No tickets match these filters" : "No tickets yet"} text={rows.length ? "Try All instead of Open, or clear a filter." : fixedApp ? "Tickets whose subject or category mentions this app show up here. Add more words under Edit → Ticket keywords." : undefined} />
      ) : (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              {["#", "Subject", ...(fixedApp ? [] : ["Application"]), "Status", "Priority", "Category", "Technician", "Raised"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.slice(0, limit).map((t, i) => (
                  <motion.tr key={t.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="border-t border-border align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">#{t.displayId}<ExternalLink className="size-3" /></a> : `#${t.displayId}`}</td>
                    <td className="max-w-md px-4 py-3">
                      <div className="font-medium">{t.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">{[t.requester, t.requesterDept, t.subcategory, t.item].filter(Boolean).join(" · ")}</div>
                    </td>
                    {!fixedApp && (
                      <td className="px-4 py-3">
                        {(me.role === "admin" || (t.appId ? editable.has(t.appId) : me.role === "editor")) ? (
                          <Select className="h-8 w-48 text-xs" value={t.matchedBy === "manual" ? t.appId ?? "" : t.appId ? `auto:${t.appId}` : ""} title={MATCH_LABEL[t.matchedBy]}
                            onChange={(e) => void reassign(t, e.target.value.startsWith("auto:") ? "__auto" : e.target.value || "__auto")}>
                            <option value="">{t.appId ? "— automatic —" : "— Unmatched —"}</option>
                            {t.appId && t.matchedBy !== "manual" && <option value={`auto:${t.appId}`}>{t.appName} (auto)</option>}
                            {apps.filter((a) => me.role === "admin" || editable.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </Select>
                        ) : t.appId ? <Link to={`/apps/${t.appId}/tickets`} className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"><span className="size-2 rounded-full" style={{ background: toneHex(t.appTone) }} />{t.appName}</Link> : <span className="text-xs text-muted-foreground">Unmatched</span>}
                      </td>
                    )}
                    <td className="px-4 py-3"><StatusPill t={t} /></td>
                    <td className="px-4 py-3"><PriorityPill p={t.priority} /></td>
                    <td className="px-4 py-3 text-xs">{t.category || "—"}{t.subcategory && <div className="text-muted-foreground">{t.subcategory}</div>}</td>
                    <td className="px-4 py-3 text-xs">{t.technician || <span className="text-muted-foreground">Unassigned</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground" title={fmtDateTime(t.createdAt)}>{timeAgo(t.createdAt)}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {list.length > limit && <button onClick={() => setLimit((l) => l + 200)} className="w-full border-t border-border py-3 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">Show more ({fmtNumber(list.length - limit)} left)</button>}
        </div>
      )}
    </div>
  );
}

/** Sync status + "Sync now" (server only, admins). */
export function SyncBar({ status }: { status?: TicketStatusInfo }) {
  const run = useRun();
  const [busy, setBusy] = React.useState(false);
  if (!status) return null;
  const s = status.sync;
  async function sync() {
    setBusy(true);
    const r = await run<{ fetched: number; added: number }>("tickets.sync", {}, { success: "Tickets synced from ServiceDesk Plus" });
    setBusy(false);
    void r;
  }
  return (
    <div className={cn("glass flex flex-wrap items-center gap-3 rounded-3xl px-4 py-3 text-sm", s.error && "ring-1 ring-rose-500/40")}>
      {s.error ? <AlertTriangle className="size-4 text-rose-500" /> : s.lastOk ? <CheckCircle2 className="size-4 text-emerald-500" /> : <TicketIcon className="size-4 text-muted-foreground" />}
      <span className="flex-1 text-muted-foreground">
        {s.error ? <><b className="text-rose-500">Last sync failed:</b> {s.error}</>
          : s.lastOk ? <>ServiceDesk Plus synced <b className="text-foreground">{timeAgo(s.lastOk)}</b> · {fmtNumber(status.total)} tickets kept{s.total ? ` · ${fmtNumber(s.total)} in the helpdesk` : ""}</>
            : status.sample ? <>Showing <b className="text-foreground">sample tickets</b>. Connect ServiceDesk Plus (keys in the server's .env) or import an Excel export.</>
              : <>{fmtNumber(status.total)} tickets (imported).</>}
      </span>
      {status.canManage && !DEMO && <Button size="sm" variant="secondary" loading={busy} onClick={sync}><RefreshCw />Sync now</Button>}
    </div>
  );
}

/** Admin: "tickets whose <field> contains <text> belong to <app>". */
export function RulesPanel({ status, apps }: { status: TicketStatusInfo; apps: AppSummary[] }) {
  const run = useRun();
  const [field, setField] = React.useState<string>("subcategory");
  const [contains, setContains] = React.useState("");
  const [appId, setAppId] = React.useState("");
  const name = (id: string) => apps.find((a) => a.id === id)?.name ?? "(deleted app)";
  async function add() {
    if (!contains.trim() || !appId) return;
    const r = await run("tickets.rules.save", { field, contains, appId }, { success: "Rule added" });
    if (r) setContains("");
  }
  return (
    <div className="glass flex flex-col gap-3 rounded-3xl p-5">
      <div className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /><h3 className="font-semibold">Matching rules</h3></div>
      <p className="text-xs text-muted-foreground">
        Tickets are linked to apps in this order: picked by hand in the table → these rules → the app's name, code or <b>Ticket keywords</b> (Edit app → Basics) found in the subject, category, subcategory or item. Anything left over is <b>Unmatched</b>.
      </p>
      {status.rules.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {status.rules.map((r) => (
            <li key={r.id} className="deboss flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <span className="flex-1"><span className="text-muted-foreground">{RULE_LABEL[r.field]} contains</span> “<b>{r.contains}</b>” <Link2 className="mx-1 inline size-3.5 text-muted-foreground" /> <b>{name(r.appId)}</b></span>
              <Button size="icon-sm" variant="ghost" aria-label="Delete rule" onClick={() => void run("tickets.rules.delete", { id: r.id }, { success: "Rule removed" })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-44" value={field} onChange={(e) => setField(e.target.value)}>{TICKET_RULE_FIELDS.map((f) => <option key={f} value={f}>{RULE_LABEL[f]}</option>)}</Select>
        <span className="text-sm text-muted-foreground">contains</span>
        <Input className="w-48" value={contains} onChange={(e) => setContains(e.target.value)} placeholder="e.g. SAP" onKeyDown={(e) => e.key === "Enter" && void add()} />
        <span className="text-sm text-muted-foreground">→</span>
        <Select className="w-56" value={appId} onChange={(e) => setAppId(e.target.value)}><option value="">Pick an application…</option>{apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Button size="sm" variant="primary" onClick={add} disabled={!contains.trim() || !appId}><Plus />Add rule</Button>
      </div>
    </div>
  );
}

/** App detail → Tickets tab. */
export function TicketsTab({ app }: { app: AppSummary }) {
  const { data: rows, isLoading } = useTickets(app.id);
  const { data: apps } = useApps();
  const { data: status } = useTicketStatus();
  if (isLoading || !rows) return <Skeleton className="h-64" />;
  return (
    <div className="flex flex-col gap-4">
      <SyncBar status={status} />
      <TicketKpis rows={rows} />
      <TicketTable rows={rows} apps={apps ?? []} fixedApp />
      <p className="text-xs text-muted-foreground">Missing tickets for {app.name}? Add the words people use for it (e.g. module names) under <b>Edit → Ticket keywords</b>, or link tickets by hand on the <Link to="/tickets" className="underline">Tickets page</Link>.</p>
    </div>
  );
}

export function TicketImportButton() {
  const me = useMe();
  const [open, setOpen] = React.useState(false);
  if (me.role === "viewer") return null;
  return (<><Button variant="secondary" onClick={() => setOpen(true)}><FileSpreadsheet />Import export</Button><ImportWizard open={open} onClose={() => setOpen(false)} kind="tickets" /></>);
}
