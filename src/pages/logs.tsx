import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import * as XLSX from "xlsx";
import { ChevronDown, Download, Filter, Search, X } from "lucide-react";
import { useApps, useLogs, useUsers } from "@/api/hooks";
import { call } from "@/api/client";
import type { LogEntry, Paged } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, GlassCard, Skeleton } from "@/components/ui/bits";
import { ACTION_META, ActionIcon } from "@/components/app/activity";
import { cn, fmtDateTime } from "@/lib/utils";

const ENTITIES = ["app", "task", "group", "usage", "doc", "release", "file", "screenshot", "user", "session", "backup"];
const PAGE = 40;

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Row({ log }: { log: LogEntry }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <tr onClick={() => log.changes.length && setOpen((o) => !o)} className={cn("border-t border-border transition-colors hover:bg-muted/30", log.changes.length && "cursor-pointer")}>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtDateTime(log.at)}</td>
        <td className="px-4 py-3"><div className="flex items-center gap-2"><ActionIcon action={log.action} className="size-7" /><span className="text-xs font-medium">{ACTION_META[log.action]?.label ?? log.action}</span></div></td>
        <td className="px-4 py-3 text-sm">{log.summary}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">{log.userName}</td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">{log.appId ? <Link to={`/apps/${log.appId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{log.appName}</Link> : <span className="text-muted-foreground">—</span>}</td>
        <td className="px-4 py-3 text-right">{log.changes.length > 0 && <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-block"><ChevronDown className="size-4 text-muted-foreground" /></motion.span>}</td>
      </tr>
      <AnimatePresence>
        {open && (
          <tr>
            <td colSpan={6} className="p-0">
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="deboss mx-4 mb-3 rounded-2xl p-3">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-4 font-medium">Field</th><th className="py-1 pr-4 font-medium">Before</th><th className="py-1 font-medium">After</th></tr></thead>
                    <tbody>{log.changes.map((c, i) => (
                      <tr key={i} className="align-top"><td className="py-1 pr-4 font-medium">{c.field}</td><td className="max-w-xs break-words py-1 pr-4 text-rose-400 line-through decoration-rose-400/40">{show(c.from)}</td><td className="max-w-xs break-words py-1 text-emerald-500">{show(c.to)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

export default function LogsPage() {
  const [params] = useSearchParams();
  const { data: users } = useUsers();
  const { data: apps } = useApps();
  const [f, setF] = React.useState({ q: "", userId: "", appId: params.get("appId") ?? "", action: "", entity: "", from: "", to: "" });
  const [page, setPage] = React.useState(0);
  const [q, setQ] = React.useState("");
  React.useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q })), 300); return () => clearTimeout(t); }, [q]);
  React.useEffect(() => setPage(0), [f]);
  const filters = { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), limit: PAGE, offset: page * PAGE };
  const { data, isLoading, isFetching } = useLogs(filters);
  const active = Object.entries(f).filter(([, v]) => v).length;

  async function exportLogs() {
    const all = await call<Paged<LogEntry>>("logs.list", { ...filters, limit: 1000, offset: 0 });
    const rows = all.items.map((l) => ({ When: new Date(l.at).toLocaleString(), User: l.userName, Action: l.action, Entity: l.entity, Application: l.appName ?? "", Summary: l.summary, Changes: l.changes.map((c) => `${c.field}: ${show(c.from)} → ${show(c.to)}`).join("; ") }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Audit log");
    XLSX.writeFile(wb, `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight">Audit logs</h1><p className="text-sm text-muted-foreground">Who changed what, and when. Click a row to see before → after values.</p></div>
        <Button variant="secondary" onClick={exportLogs}><Download />Export to Excel</Button>
      </div>

      <GlassCard className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search summary, user, app…" className="pl-9" />
        </div>
        <Select value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })}><option value="">All users</option>{(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <Select value={f.appId} onChange={(e) => setF({ ...f, appId: e.target.value })}><option value="">All applications</option>{(apps ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}><option value="">All actions</option>{Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label} ({k})</option>)}</Select>
        <Select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })}><option value="">All types</option>{ENTITIES.map((e) => <option key={e}>{e}</option>)}</Select>
        <div className="flex items-center gap-2 md:col-span-2">
          <span className="text-xs text-muted-foreground">From</span>
          <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title="To" />
        </div>
        {active > 0 && <Button size="sm" variant="ghost" className="w-fit" onClick={() => { setQ(""); setF({ q: "", userId: "", appId: "", action: "", entity: "", from: "", to: "" }); }}><X />Clear {active} filter{active > 1 ? "s" : ""}</Button>}
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {isLoading ? <div className="grid gap-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
          : !data?.items.length ? <div className="p-6"><EmptyState icon={<Filter />} title="No log entries" text="Nothing matches these filters." /></div> : (
            <div className={cn("overflow-x-auto transition-opacity", isFetching && "opacity-60")}>
              <table className="w-full min-w-[900px]">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["When", "Action", "Summary", "User", "Application", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>{data.items.map((l) => <Row key={l.id} log={l} />)}</tbody>
              </table>
            </div>
          )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{data ? `${Math.min(data.total, page * PAGE + 1)}–${Math.min(data.total, (page + 1) * PAGE)} of ${data.total}` : ""}</span>
          <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button size="sm" variant="ghost" disabled={!data || (page + 1) * PAGE >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
        </div>
      </GlassCard>
    </div>
  );
}
