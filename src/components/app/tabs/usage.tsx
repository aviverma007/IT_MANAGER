import * as React from "react";
import { motion } from "motion/react";
import * as XLSX from "xlsx";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, Download, Edit3, FileSpreadsheet, MousePointerClick, Plus, Receipt, Timer, Trash2, Users } from "lucide-react";
import type { AppDetail, UsageEntry } from "@/core/types";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { AnimatedNumber, EmptyState, GlassCard, SectionTitle, Tabs } from "@/components/ui/bits";
import { Modal, useConfirm } from "@/components/ui/modal";
import { ImportWizard } from "@/components/app/import-wizard";
import { cn, fmtDate, fmtNumber, toneHex } from "@/lib/utils";
import { TrackingCard } from "./tracking";

type Range = "30" | "90" | "365" | "all";

function UsageForm({ app, entry, open, onClose }: { app: AppDetail; entry: UsageEntry | null; open: boolean; onClose: () => void }) {
  const run = useRun();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({ date: today, activeUsers: "", sessions: "", transactions: "", avgMinutes: "", notes: "" });
  React.useEffect(() => {
    if (!open) return;
    setF(entry ? { date: entry.date, activeUsers: String(entry.activeUsers), sessions: String(entry.sessions), transactions: String(entry.transactions), avgMinutes: String(entry.avgMinutes), notes: entry.notes }
      : { date: today, activeUsers: "", sessions: "", transactions: "", avgMinutes: "", notes: "" });
  }, [open, entry, today]);
  const existing = !entry && app.usageEntries.find((u) => u.date === f.date);
  async function save() {
    const res = await run("usage.save", { appId: app.id, ...f }, { success: "Usage saved" });
    if (res) onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={entry ? `Usage for ${fmtDate(entry.date)}` : "Log usage"} description="One entry per day. Saving a date that already exists updates it." icon={<Activity />}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" className="sm:col-span-2" hint={existing ? "An entry for this date exists — it will be updated." : undefined}><Input type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Active users"><Input type="number" min={0} value={f.activeUsers} onChange={(e) => setF({ ...f, activeUsers: e.target.value })} placeholder="0" /></Field>
        <Field label="Sessions / logins"><Input type="number" min={0} value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} placeholder="0" /></Field>
        <Field label="Transactions / entries"><Input type="number" min={0} value={f.transactions} onChange={(e) => setF({ ...f, transactions: e.target.value })} placeholder="0" /></Field>
        <Field label="Avg minutes per session"><Input type="number" min={0} step="0.1" value={f.avgMinutes} onChange={(e) => setF({ ...f, avgMinutes: e.target.value })} placeholder="0" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Month-end peak, outage, training day…" className="min-h-16" /></Field>
      </div>
    </Modal>
  );
}

export function UsageTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const color = toneHex(app.tone);
  const [range, setRange] = React.useState<Range>("90");
  const [form, setForm] = React.useState<{ open: boolean; entry: UsageEntry | null }>({ open: false, entry: null });
  const [importing, setImporting] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const series = React.useMemo(() => {
    const sorted = [...app.usageEntries].sort((a, b) => a.date.localeCompare(b.date));
    if (range === "all") return sorted;
    const from = new Date(Date.now() - Number(range) * 864e5).toISOString().slice(0, 10);
    return sorted.filter((u) => u.date >= from);
  }, [app.usageEntries, range]);

  const totals = series.reduce((s, u) => ({ sessions: s.sessions + u.sessions, transactions: s.transactions + u.transactions, minutes: s.minutes + u.avgMinutes * u.sessions, peak: Math.max(s.peak, u.activeUsers) }), { sessions: 0, transactions: 0, minutes: 0, peak: 0 });
  const avgMin = totals.sessions ? totals.minutes / totals.sessions : 0;
  const pageSize = 15;
  const rows = app.usageEntries.slice(page * pageSize, page * pageSize + pageSize);

  function exportUsage() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(app.usageEntries.map((u) => ({ Application: app.code, Date: u.date, "Active users": u.activeUsers, Sessions: u.sessions, Transactions: u.transactions, "Avg minutes": u.avgMinutes, Notes: u.notes, Source: u.source }))), "Usage");
    XLSX.writeFile(wb, `${app.code || app.name}-usage.xlsx`);
  }

  const kpis = [
    { label: "Sessions · 30d", value: app.usage.sessions30, icon: Activity, extra: <span className={cn("inline-flex items-center text-xs", app.usage.trend >= 0 ? "text-emerald-500" : "text-rose-400")}>{app.usage.trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(app.usage.trend)}%</span> },
    { label: "Active users (latest)", value: app.usage.activeUsers, icon: Users },
    { label: "Transactions · 30d", value: app.usage.transactions30, icon: Receipt },
    { label: "Launches via IT Manager · 30d", value: app.usage.launches30, icon: MousePointerClick },
    { label: "Avg minutes / session", value: avgMin, icon: Timer, decimals: true },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass rounded-3xl p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">{k.label}<k.icon className="size-4" style={{ color }} /></div>
            <div className="mt-2 flex items-end gap-2 text-2xl font-bold"><AnimatedNumber value={k.value} format={(n) => (k.decimals ? n.toFixed(1) : fmtNumber(Math.round(n)))} />{k.extra}</div>
          </motion.div>
        ))}
      </div>

      <TrackingCard app={app} />

      <GlassCard className="p-5">
        <SectionTitle title="Usage over time" sub={`${series.length} day(s) · ${fmtNumber(totals.sessions)} sessions · peak ${fmtNumber(totals.peak)} users`}
          action={<div className="flex flex-wrap gap-2">
            <Tabs id="range" value={range} onChange={setRange} tabs={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "365", label: "1y" }, { value: "all", label: "All" }]} />
          </div>} />
        {series.length ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ left: -10, right: 8, top: 8 }}>
                <defs><linearGradient id="ub" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.95} /><stop offset="1" stopColor={color} stopOpacity={0.35} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 }} labelFormatter={(d) => fmtDate(String(d))} />
                <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill="url(#ub)" radius={[6, 6, 0, 0]} animationDuration={1200} />
                <Line yAxisId="left" type="monotone" dataKey="activeUsers" name="Active users" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} animationDuration={1500} />
                <Line yAxisId="right" type="monotone" dataKey="transactions" name="Transactions" stroke="var(--chart-4)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationDuration={1700} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-10 text-center text-sm text-muted-foreground">No usage in this range.</p>}
      </GlassCard>

      <GlassCard className="p-5">
        <SectionTitle title="Entries" sub="Logged manually or imported from Excel / CSV"
          action={<div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={exportUsage} disabled={!app.usageEntries.length}><Download />Export</Button>
            {canEdit && <Button size="sm" variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import</Button>}
            {canEdit && <Button size="sm" variant="primary" onClick={() => setForm({ open: true, entry: null })}><Plus />Log usage</Button>}
          </div>} />
        {!app.usageEntries.length ? (
          <EmptyState icon={<Activity />} title="No usage logged yet" text="Log daily active users, sessions and transactions with the form, or import a whole export from Excel, CSV or JSON." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["Date", "Active users", "Sessions", "Transactions", "Avg min", "Notes", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((u, i) => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="group border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{fmtDate(u.date)}</td>
                      <td className="px-3 py-2 tabular-nums">{u.activeUsers}</td>
                      <td className="px-3 py-2 tabular-nums">{u.sessions}</td>
                      <td className="px-3 py-2 tabular-nums">{u.transactions}</td>
                      <td className="px-3 py-2 tabular-nums">{u.avgMinutes}</td>
                      <td className="max-w-56 truncate px-3 py-2 text-muted-foreground">{u.source === "auto" && <span className="mr-1.5 rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">AUTO</span>}{u.notes}</td>
                      <td className="px-3 py-2 text-right">
                        {canEdit && <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          <Button size="icon-sm" variant="ghost" onClick={() => setForm({ open: true, entry: u })} aria-label="Edit"><Edit3 /></Button>
                          <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Delete this entry?", message: fmtDate(u.date), confirm: "Delete", danger: true })) void run("usage.delete", { id: u.id }); }} aria-label="Delete"><Trash2 /></Button>
                        </div>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{app.usageEntries.length} entries</span>
              <div className="flex gap-2"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button><Button size="sm" variant="ghost" disabled={(page + 1) * pageSize >= app.usageEntries.length} onClick={() => setPage((p) => p + 1)}>Older</Button></div>
            </div>
          </>
        )}
      </GlassCard>

      <UsageForm app={app} entry={form.entry} open={form.open} onClose={() => setForm({ open: false, entry: null })} />
      <ImportWizard open={importing} onClose={() => setImporting(false)} kind="usage" appId={app.id} appName={app.name} />
    </div>
  );
}
