import * as React from "react";
import { createPortal } from "react-dom";
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
import { Drawer } from "@/components/ui/modal";
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
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [detail, setDetail] = React.useState<TicketRow | null>(null);
  const editable = new Set(apps.filter((a) => a.permission === "edit").map((a) => a.id));
  const canBulk = me.role !== "viewer";
  const uniq = (f: (t: TicketRow) => string) => [...new Set(rows.map(f).filter(Boolean))].sort();

  const list = rows.filter((t) =>
    (state === "all" || (state === "open" ? t.open : !t.open)) &&
    (!appSel.length || appSel.includes(t.appId ?? "__none")) &&
    (!prio.length || prio.includes(t.priority || "—")) &&
    (!tech.length || tech.includes(t.technician || "Unassigned")) &&
    (!cat.length || cat.includes(t.category || "—")) &&
    (!q || `${t.displayId} ${t.subject} ${t.requester} ${t.category} ${t.subcategory} ${t.item} ${t.appName}`.toLowerCase().includes(q.toLowerCase())));
  const count = (f: (t: TicketRow) => boolean) => String(rows.filter(f).length);

  async function bulk(appId: string) {
    if (!sel.size) return;
    const r = await run("tickets.assign", { ids: [...sel], appId: appId === "__auto" ? null : appId }, { success: appId === "__auto" ? `${sel.size} ticket(s) back to automatic matching` : `${sel.size} ticket(s) tagged` });
    if (r) setSel(new Set());
  }
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
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 text-sm ring-1 ring-primary/40">
            <b>{sel.size} selected</b>
            <span className="text-muted-foreground">Tag to</span>
            <Select className="h-8 w-60 text-xs" value="" onChange={(e) => e.target.value && void bulk(e.target.value)}>
              <option value="">Pick an application…</option>
              <option value="__auto">↺ Automatic matching</option>
              {apps.filter((a) => me.role === "admin" || editable.has(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!list.length ? (
        <EmptyState icon={<CheckCircle2 />} title={rows.length ? "No tickets match these filters" : "No tickets yet"} text={rows.length ? "Try All instead of Open, or clear a filter." : fixedApp ? "Tickets whose subject or category mentions this app show up here. Add more words under Edit → Ticket keywords." : undefined} />
      ) : (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              {canBulk && <th className="w-10 px-4 py-3"><input type="checkbox" className="size-4 accent-[var(--primary)]" aria-label="Select all shown" checked={list.slice(0, limit).length > 0 && list.slice(0, limit).every((t) => sel.has(t.id))} onChange={(e) => setSel(e.target.checked ? new Set(list.slice(0, limit).map((t) => t.id)) : new Set())} /></th>}
              {["#", "Subject", ...(fixedApp ? [] : ["Application"]), "Status", "Priority", "Category", "Technician", "Raised"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.slice(0, limit).map((t, i) => (
                  <motion.tr key={t.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(i, 20) * 0.015 }} className="border-t border-border align-top hover:bg-muted/30">
                    {canBulk && <td className="px-4 py-3"><input type="checkbox" className="size-4 accent-[var(--primary)]" aria-label={`Select #${t.displayId}`} checked={sel.has(t.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(t.id); else n.delete(t.id); return n; })} /></td>}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">#{t.displayId}<ExternalLink className="size-3" /></a> : `#${t.displayId}`}</td>
                    <td className="max-w-md px-4 py-3">
                      <button onClick={() => setDetail(t)} className="text-left font-medium hover:text-primary hover:underline">{t.subject}</button>
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
          <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail ? `Ticket #${detail.displayId}` : "Ticket"}>
            {detail && <TicketCard key={detail.id} t={rows.find((r) => r.id === detail.id) ?? detail} apps={apps} defaultOpen />}
          </Drawer>
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

/* ---------------------------------------------------------------- drill-down ---------------------------------------------------------------- */

/** One ticket, expandable to full details + tagging actions (move to app, turn into a rule). */
export function TicketCard({ t, apps, defaultOpen }: { t: TicketRow; apps: AppSummary[]; defaultOpen?: boolean }) {
  const me = useMe();
  const run = useRun();
  const [open, setOpen] = React.useState(!!defaultOpen);
  const editable = apps.filter((a) => me.role === "admin" || a.permission === "edit");
  const canTag = me.role === "admin" || (me.role === "editor" && (!t.appId || editable.some((a) => a.id === t.appId)));
  // category alone is usually too broad ("Software"), so it is only offered when there is no subcategory / item
  const ruleFields = (["subcategory", "item", "category"] as const).filter((f) => t[f] && (f !== "category" || (!t.subcategory && !t.item)));
  const detail: [string, string][] = [
    ["Category", [t.category, t.subcategory, t.item].filter(Boolean).join(" › ") || "—"], ["Status", t.status], ["Priority", t.priority || "—"],
    ["Technician", t.technician || "Unassigned"], ["Group", t.group || "—"], ["Requester", [t.requester, t.requesterDept].filter(Boolean).join(" · ") || "—"],
    ["Site", t.site || "—"], ["Raised", fmtDateTime(t.createdAt)], ["Due by", fmtDateTime(t.dueAt) || "—"], ["Closed", fmtDateTime(t.closedAt) || "—"],
  ];
  return (
    <motion.div layout className={cn("rounded-2xl border border-border transition-colors", open ? "bg-muted/40" : "hover:bg-muted/30")}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className="mt-0.5 font-mono text-[11px] text-muted-foreground">#{t.displayId}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{t.subject}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <StatusPill t={t} /><PriorityPill p={t.priority} />
            {t.appId ? <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: toneHex(t.appTone) }} />{t.appName}</span> : <span className="rounded-full bg-muted px-1.5">Unmatched</span>}
            <span>· {timeAgo(t.createdAt)}</span>{t.technician && <span>· {t.technician}</span>}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="mt-1 text-muted-foreground">›</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-3 px-4 pb-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                {detail.map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                {t.url && <a href={t.url} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><ExternalLink />Open in ServiceDesk</Button></a>}
                {canTag && (
                  <Select className="h-8 w-60 text-xs" value={t.matchedBy === "manual" ? t.appId ?? "" : ""} onChange={(e) => void run("tickets.assign", { ids: [t.id], appId: e.target.value || null }, { success: e.target.value ? "Ticket tagged" : "Back to automatic matching" })}>
                    <option value="">{t.appId ? `Tagged: ${t.appName} (${t.matchedBy === "manual" ? "by hand" : t.matchedBy})` : "Tag to an application…"}</option>
                    {t.matchedBy === "manual" && <option value="">↺ Automatic matching</option>}
                    {editable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                )}
                <span className="text-[11px] text-muted-foreground">{MATCH_LABEL[t.matchedBy]}</span>
              </div>
              {me.role === "admin" && t.appId && ruleFields.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Wand2 className="size-3.5 text-primary" /><span className="text-muted-foreground">Always tag similar tickets to <b className="text-foreground">{t.appName}</b>:</span>
                  {ruleFields.map((f) => (
                    <button key={f} onClick={() => void run("tickets.rules.save", { field: f, contains: t[f], appId: t.appId }, { success: `Rule added — ${RULE_LABEL[f]} “${t[f]}” → ${t.appName}` })}
                      className="rounded-full border border-border px-2 py-0.5 hover:border-primary hover:text-primary">{RULE_LABEL[f]} = “{t[f]}”</button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Right-hand drawer: tickets for one app, a group of apps, or the unmatched ones. */
export function TicketDrawer({ target, onClose }: { target: { title: string; appIds: (string | null)[] } | null; onClose: () => void }) {
  const { data: all } = useTickets();
  const { data: apps } = useApps();
  const [state, setState] = React.useState<"open" | "closed" | "all">("open");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(60);
  React.useEffect(() => { setState("open"); setQ(""); setLimit(60); }, [target?.title]);
  const rows = (all ?? []).filter((t) => target?.appIds.includes(t.appId));
  const list = rows.filter((t) => (state === "all" || (state === "open" ? t.open : !t.open)) && (!q || `${t.displayId} ${t.subject} ${t.requester} ${t.category} ${t.subcategory}`.toLowerCase().includes(q.toLowerCase())));
  const single = target && target.appIds.length === 1 && target.appIds[0];
  const per = React.useMemo(() => {
    const m = new Map<string, { name: string; tone: number; open: number }>();
    for (const t of rows) if (t.open && t.appId) { const e = m.get(t.appId) ?? { name: t.appName, tone: t.appTone, open: 0 }; e.open++; m.set(t.appId, e); }
    return [...m.values()].sort((a, b) => b.open - a.open);
  }, [rows]);
  return (
    <Drawer open={!!target} onClose={onClose} title={target ? `Tickets · ${target.title}` : "Tickets"} wide
      footer={single ? <Link to={`/apps/${single}/tickets`} onClick={onClose}><Button variant="secondary">Open the app's Tickets tab</Button></Link> : <Link to="/tickets" onClick={onClose}><Button variant="secondary">All tickets</Button></Link>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-2">
          {[["Open", rows.filter((t) => t.open).length, "#f59e0b"], ["High / urgent", rows.filter((t) => t.open && isHigh(t.priority)).length, "#f43f5e"], ["Raised 30d", rows.filter((t) => t.createdAt >= new Date(Date.now() - 30 * 864e5).toISOString()).length, "#3b82f6"], ["Total", rows.length, "var(--foreground)"]].map(([l, v, c]) => (
            <div key={l as string} className="deboss rounded-2xl p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div><div className="text-xl font-bold" style={{ color: c as string }}><AnimatedNumber value={v as number} /></div></div>
          ))}
        </div>
        {per.length > 1 && (
          <div className="flex flex-wrap gap-1.5">{per.map((p) => <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs"><span className="size-1.5 rounded-full" style={{ background: toneHex(p.tone) }} />{p.name} <b>{p.open}</b></span>)}</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs id="tk-drawer" value={state} onChange={setState} tabs={[{ value: "open", label: "Open", count: rows.filter((t) => t.open).length }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />
          <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" /></div>
          <Button size="sm" variant="ghost" onClick={() => exportTickets(list, "tickets")} disabled={!list.length}><Download />Export</Button>
        </div>
        <div className="flex flex-col gap-2">
          {list.slice(0, limit).map((t) => <TicketCard key={t.id} t={t} apps={apps ?? []} />)}
          {!list.length && <p className="py-10 text-center text-sm text-muted-foreground">{rows.length ? "Nothing here — try Closed or All." : "No tickets linked yet."}</p>}
          {list.length > limit && <Button variant="ghost" onClick={() => setLimit((l) => l + 100)}>Show more ({list.length - limit})</Button>}
        </div>
        <p className="text-[11px] text-muted-foreground">Click a ticket to see its details, tag it to the right application, or turn it into a rule so similar tickets are tagged automatically.</p>
      </div>
    </Drawer>
  );
}

/** Top of the Applications page: which apps have tickets right now. Click to drill down. */
export function TicketsOverview({ apps }: { apps: AppSummary[] }) {
  const { data: all } = useTickets();
  const { data: status } = useTicketStatus();
  const [target, setTarget] = React.useState<{ title: string; appIds: (string | null)[] } | null>(null);
  if (!all || (!all.length && !status?.sync.error)) return null;
  const visible = new Set(apps.map((a) => a.id));
  const per = new Map<string | null, { open: number; high: number; total: number }>();
  for (const t of all) {
    if (t.appId && !visible.has(t.appId)) continue;
    const e = per.get(t.appId) ?? { open: 0, high: 0, total: 0 };
    e.total++; if (t.open) { e.open++; if (isHigh(t.priority)) e.high++; }
    per.set(t.appId, e);
  }
  const cards = apps.filter((a) => per.get(a.id)?.total).sort((a, b) => per.get(b.id)!.open - per.get(a.id)!.open || per.get(b.id)!.total - per.get(a.id)!.total);
  const un = per.get(null);
  const openAll = [...per.values()].reduce((s, e) => s + e.open, 0);
  const highAll = [...per.values()].reduce((s, e) => s + e.high, 0);
  return (
    <section className="glass rounded-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="emboss grid size-9 place-items-center rounded-xl text-amber-500"><TicketIcon className="size-4" /></span>
        <div className="mr-auto">
          <div className="font-semibold">Helpdesk tickets by application</div>
          <div className="text-xs text-muted-foreground"><b className="text-foreground">{fmtNumber(openAll)}</b> open{highAll ? <> · <b className="text-rose-500">{highAll}</b> high / urgent</> : null} · click an app to drill down{status?.sync.error ? <span className="text-rose-500"> · last sync failed</span> : status?.sync.lastOk ? ` · synced ${timeAgo(status.sync.lastOk)}` : ""}</div>
        </div>
        <Link to="/tickets"><Button size="sm" variant="secondary">All tickets</Button></Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {cards.map((a, i) => {
          const e = per.get(a.id)!;
          const c = e.high ? "#f43f5e" : e.open ? "#f59e0b" : "#10b981";
          return (
            <motion.button key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
              onClick={() => setTarget({ title: a.name, appIds: [a.id] })} className="emboss flex w-44 shrink-0 flex-col gap-1 rounded-2xl p-3 text-left">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold"><span className="size-2 shrink-0 rounded-full" style={{ background: toneHex(a.tone) }} />{a.name}</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: c }}>{e.open}<span className="ml-1 text-xs font-medium text-muted-foreground">open</span></span>
              <span className="text-[11px] text-muted-foreground">{e.high ? <span className="font-semibold text-rose-500">{e.high} high · </span> : null}{e.total} total</span>
            </motion.button>
          );
        })}
        {un && un.total > 0 && (
          <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => setTarget({ title: "Unmatched — tag these", appIds: [null] })} className="flex w-44 shrink-0 flex-col gap-1 rounded-2xl border border-dashed border-border p-3 text-left">
            <span className="text-sm font-semibold text-muted-foreground">Unmatched</span>
            <span className="text-2xl font-bold tabular-nums text-muted-foreground">{un.open}<span className="ml-1 text-xs font-medium">open</span></span>
            <span className="text-[11px] text-muted-foreground">{un.total} total · click to tag</span>
          </motion.button>
        )}
        {!cards.length && !un && <p className="py-3 text-sm text-muted-foreground">No tickets yet — once ServiceDesk Plus syncs, they appear here.</p>}
      </div>
      <TicketDrawer target={target} onClose={() => setTarget(null)} />
    </section>
  );
}

/** Admin/editor: the most common words in unmatched ticket subjects — pick an app and every ticket with that word is tagged (as a rule). */
export function SuggestPanel({ apps }: { apps: AppSummary[] }) {
  const me = useMe();
  const run = useRun();
  const { data, isLoading } = useQuery({ queryKey: ["tickets-suggest"], queryFn: () => call<{ unmatched: number; terms: { term: string; n: number; open: number; examples: string[] }[] }>("tickets.suggest") });
  const [show, setShow] = React.useState(24);
  if (me.role !== "admin" || isLoading || !data || !data.terms.length) return null;
  async function tag(term: string, appId: string) {
    if (!appId) return;
    await run("tickets.rules.save", { field: "subject", contains: term, appId }, { success: `Tickets mentioning “${term}” → ${apps.find((a) => a.id === appId)?.name}` });
  }
  return (
    <div className="glass flex flex-col gap-3 rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Wand2 className="size-4 text-primary" /><h3 className="font-semibold">Tag unmatched tickets fast</h3>
        <span className="text-xs text-muted-foreground">{fmtNumber(data.unmatched)} unmatched · the words that come up most in their subjects. Pick an app next to a word and every ticket with that word (now and later) is tagged to it.</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {data.terms.slice(0, show).map((t) => (
          <div key={t.term} className="deboss flex items-center gap-2 rounded-xl px-3 py-2" title={t.examples.join("\n")}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">“{t.term}”</span>
              <span className="block truncate text-[11px] text-muted-foreground">{fmtNumber(t.n)} tickets{t.open ? ` · ${t.open} open` : ""} · e.g. {t.examples[0]}</span>
            </span>
            <Select className="h-8 w-40 shrink-0 text-xs" value="" onChange={(e) => void tag(t.term, e.target.value)}>
              <option value="">Tag to…</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        ))}
      </div>
      {data.terms.length > show && <Button variant="ghost" size="sm" onClick={() => setShow((n) => n + 24)}>Show more words</Button>}
    </div>
  );
}

/** "🎫 34 open tickets" — hover (or tap) shows a popup with the latest open tickets; click opens the full list. */
export function TicketHoverChip({ app, onOpen }: { app: AppSummary; onOpen: () => void }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number; up: boolean } | null>(null);
  const timer = React.useRef<number>(0);
  const { data: all } = useTickets();
  const t = app.tickets;
  const c = t.high ? "#f43f5e" : t.open ? "#f59e0b" : "#10b981";
  const list = (all ?? []).filter((x) => x.appId === app.id && x.open).slice(0, 8);
  function show() {
    window.clearTimeout(timer.current);
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 340 > window.innerHeight;
    setPos({ x: Math.min(r.left, window.innerWidth - 400), y: up ? r.top - 8 : r.bottom + 8, up });
  }
  const hide = () => { timer.current = window.setTimeout(() => setPos(null), 150); };
  return (
    <>
      <button ref={ref} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPos(null); onOpen(); }}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums" style={{ color: c, background: `color-mix(in oklab, ${c} 13%, transparent)` }}>
        <TicketIcon className="size-3.5" />{t.open} open ticket{t.open === 1 ? "" : "s"}{t.high ? ` · ${t.high} high` : ""}
      </button>
      {pos && createPortal(
        <motion.div initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={hide}
          className="fixed z-[60] w-96 rounded-2xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-2xl" style={{ left: pos.x, top: pos.up ? undefined : pos.y, bottom: pos.up ? window.innerHeight - pos.y : undefined }}>
          <div className="mb-2 flex items-center gap-2">
            <TicketIcon className="size-4" style={{ color: c }} /><b>{app.name}</b>
            <span className="ml-auto text-xs text-muted-foreground">{t.open} open · {t.created30} raised in 30 days · {t.total} total</span>
          </div>
          {list.length ? (
            <ul className="flex flex-col gap-1">
              {list.map((x) => (
                <li key={x.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                  <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">#{x.displayId}</span>
                  <span className="min-w-0 flex-1"><span className="line-clamp-1 font-medium">{x.subject}</span><span className="block truncate text-[11px] text-muted-foreground">{[x.priority, x.technician || "Unassigned", timeAgo(x.createdAt)].filter(Boolean).join(" · ")}</span></span>
                  {x.url && <a href={x.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-foreground" aria-label="Open in ServiceDesk"><ExternalLink className="size-3.5" /></a>}
                </li>
              ))}
            </ul>
          ) : <p className="py-3 text-center text-xs text-muted-foreground">No open tickets — {t.total} closed.</p>}
          <button onClick={() => { setPos(null); onOpen(); }} className="mt-2 w-full rounded-xl bg-primary/10 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">See all {t.total} tickets →</button>
        </motion.div>, document.body)}
    </>
  );
}
