import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Pencil, Plus, Radio, Search, Trash2, UserPlus, Users } from "lucide-react";
import { call } from "@/api/client";
import { useRun } from "@/api/hooks";
import type { AppSummary, AppUserRow } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AnimatedNumber, Tabs } from "@/components/ui/bits";
import { Drawer, Modal, useConfirm } from "@/components/ui/modal";
import { ImportWizard } from "@/components/app/import-wizard";
import { cn, fmtNumber, initials, timeAgo, toneHex } from "@/lib/utils";

export const useAppUsers = (appId: string | null | undefined) =>
  useQuery({ queryKey: ["appusers", appId], queryFn: () => call<AppUserRow[]>("appusers.list", { appId }), enabled: !!appId });

const DAY30 = () => new Date(Date.now() - 30 * 864e5).toISOString();
type Filter = "all" | "active" | "inactive" | "unlisted";

function exportUsers(app: AppSummary, rows: AppUserRow[]) {
  const data = rows.map((r) => ({ Application: app.name, Name: r.name, Email: r.email, Department: r.department, Licence: r.licence, "On the list": r.listedId ? "Yes" : "No", "Last seen": r.lastSeen ? new Date(r.lastSeen).toLocaleString() : "", "Active days (30d)": r.activeDays30, Sessions: r.sessions, Notes: r.notes }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Users");
  XLSX.writeFile(wb, `${app.code || app.name}-users-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function UserForm({ app, row, onClose }: { app: AppSummary; row: AppUserRow | "new" | null; onClose: () => void }) {
  const run = useRun();
  const blank = { name: "", email: "", department: "", licence: "", notes: "" };
  const [f, setF] = React.useState(blank);
  React.useEffect(() => { setF(row && row !== "new" ? { name: row.name, email: row.email, department: row.department, licence: row.licence, notes: row.notes } : blank); }, [row]); // eslint-disable-line
  async function save() {
    const r = await run("appusers.save", { appId: app.id, id: row && row !== "new" ? row.listedId : undefined, ...f }, { success: row === "new" ? `${f.name} added` : "Saved" });
    if (r) onClose();
  }
  return (
    <Modal open={!!row} onClose={onClose} title={row === "new" ? `Add a user of ${app.name}` : `Edit ${f.name}`} icon={<UserPlus />}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={!f.name.trim()}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Full name" /></Field>
        <Field label="Email / login" hint="Used to match the tracking script"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.com" /></Field>
        <Field label="Department"><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} placeholder="Finance & Accounts" /></Field>
        <Field label="Licence / role"><Input value={f.licence} onChange={(e) => setF({ ...f, licence: e.target.value })} placeholder="Full, Read-only, Admin…" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/** The list of people using one app: listed (licence register) + seen by the tracker. */
export function PeopleList({ app }: { app: AppSummary }) {
  const { data: rows, isLoading } = useAppUsers(app.id);
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [dept, setDept] = React.useState("");
  const [edit, setEdit] = React.useState<AppUserRow | "new" | null>(null);
  const [importing, setImporting] = React.useState(false);
  const since = DAY30();
  const all = rows ?? [];
  const active = all.filter((r) => r.lastSeen && r.lastSeen >= since);
  const listed = all.filter((r) => r.listedId);
  const inactive = listed.filter((r) => !r.lastSeen || r.lastSeen < since);
  const unlisted = all.filter((r) => !r.listedId);
  const depts = [...new Set(all.map((r) => r.department).filter(Boolean))].sort();
  const list = (filter === "active" ? active : filter === "inactive" ? inactive : filter === "unlisted" ? unlisted : all)
    .filter((r) => (!dept || r.department === dept) && (!q || `${r.name} ${r.email} ${r.department} ${r.licence}`.toLowerCase().includes(q.toLowerCase())));
  const anyTracked = all.some((r) => r.tracked);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([["On the list", listed.length, "var(--foreground)", app.seats ? `of ${fmtNumber(app.seats)} seats` : "names entered"], ["Active · 30 days", active.length, "#10b981", anyTracked ? "seen by tracking" : "needs tracking"], ["Listed, not seen", inactive.length, "#f59e0b", anyTracked ? "possible spare licences" : "—"], ["Seen, not listed", unlisted.length, "#3b82f6", "add them to the list?"]] as const).map(([l, v, c, sub]) => (
          <div key={l} className="deboss rounded-2xl p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div><div className="text-2xl font-bold" style={{ color: c }}><AnimatedNumber value={v} /></div><div className="text-[10px] text-muted-foreground">{sub}</div></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs id={`people-${app.id}`} value={filter} onChange={setFilter} tabs={[{ value: "all", label: "Everyone", count: all.length }, { value: "active", label: "Active" }, { value: "inactive", label: "Not seen" }, { value: "unlisted", label: "Not listed" }]} />
        <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, department…" className="pl-9" /></div>
        {depts.length > 1 && <select className="deboss h-10 rounded-2xl bg-transparent px-3 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <Button size="sm" variant="primary" onClick={() => setEdit("new")}><Plus />Add user</Button>}
        {canEdit && <Button size="sm" variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import list</Button>}
        <Button size="sm" variant="ghost" onClick={() => exportUsers(app, list)} disabled={!list.length}><Download />Export</Button>
      </div>

      {isLoading ? <div className="h-40 animate-pulse rounded-2xl bg-muted/40" /> : !list.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {all.length ? "Nobody matches this filter." : <>No names yet. <b className="text-foreground">Add users</b> one by one, or <b className="text-foreground">Import list</b> from the licence register (Excel/CSV with Name, Email, Department, Licence). People the tracking script sees appear here automatically.</>}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((r, i) => {
            const isActive = !!r.lastSeen && r.lastSeen >= since;
            return (
              <motion.li key={r.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 25) * 0.015 }}
                className="group flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5 hover:bg-muted/40">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: toneHex((r.name.length % 5) + 1) }}>
                  {initials(r.name)}
                  {isActive && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--background)] bg-emerald-500" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate font-medium">{r.name}{!r.listedId && <span className="rounded bg-blue-500/12 px-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">not on list</span>}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[r.email, r.department, r.licence].filter(Boolean).join(" · ") || "—"}</span>
                </span>
                <span className="hidden w-36 text-right text-xs sm:block">
                  {r.lastSeen ? <><span className={cn("font-medium", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{timeAgo(r.lastSeen)}</span><span className="block text-[10px] text-muted-foreground">{r.activeDays30} day{r.activeDays30 === 1 ? "" : "s"} active in 30</span></> : <span className="text-muted-foreground">{anyTracked ? "not seen yet" : "—"}</span>}
                </span>
                {canEdit && (
                  <span className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                    <Button size="icon-sm" variant="ghost" aria-label={r.listedId ? "Edit" : "Add to list"} onClick={() => setEdit(r.listedId ? r : { ...r, listedId: null })}>{r.listedId ? <Pencil /> : <UserPlus />}</Button>
                    {r.listedId && <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={async () => { if (await confirm({ title: `Remove ${r.name}?`, message: `${r.name} is taken off the ${app.name} user list.`, confirm: "Remove", danger: true })) await run("appusers.delete", { appId: app.id, ids: [r.listedId] }, { success: "Removed" }); }}><Trash2 /></Button>}
                  </span>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Radio className="mt-0.5 size-3 shrink-0" />The green dot means the tracking script saw this person in the last 30 days. Matching is by email (or name) — keep emails on the list the same as the app's login.</p>
      <UserForm app={app} row={edit} onClose={() => setEdit(null)} />
      <ImportWizard open={importing} onClose={() => setImporting(false)} kind="appusers" appId={app.id} appName={app.name} />
    </div>
  );
}

export function PeopleDrawer({ app, onClose }: { app: AppSummary | null; onClose: () => void }) {
  return (
    <Drawer open={!!app} onClose={onClose} title={app ? `Users · ${app.name}` : "Users"} wide>
      {app && <PeopleList app={app} />}
    </Drawer>
  );
}

/** "👥 96 / 120 users" — click to drill into the list of names. Hover shows the first few. */
export function PeopleChip({ app, onOpen, big }: { app: AppSummary; onOpen: () => void; big?: boolean }) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const timer = React.useRef<number>(0);
  const { data: rows } = useAppUsers(pos ? app.id : null);
  const since = DAY30();
  function show() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ x: Math.min(r.left, window.innerWidth - 340), y: r.bottom + 6 }); }, 250);
  }
  const hide = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPos(null), 150); };
  return (
    <>
      <button ref={ref} onMouseEnter={show} onMouseLeave={hide} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPos(null); onOpen(); }}
        className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full tabular-nums hover:bg-primary/10 hover:text-primary", big ? "px-1.5 py-0.5 text-sm" : "px-1 text-xs")}
        title="See the list of users">
        <Users className={big ? "size-3.5 text-muted-foreground" : "size-3 text-muted-foreground"} />
        <b>{fmtNumber(app.landscape.activeUsers)}</b><span className="text-muted-foreground">{app.seats ? ` / ${fmtNumber(app.seats)} users` : " users"}</span>
        {app.landscape.activeSource === "tracked" && <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">live</span>}
      </button>
      {pos && createPortal(
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onMouseEnter={() => window.clearTimeout(timer.current)} onMouseLeave={hide}
          className="fixed z-[60] w-80 rounded-2xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-2xl" style={{ left: pos.x, top: pos.y }}>
          <div className="mb-2 flex items-center gap-2"><Users className="size-4 text-primary" /><b>{app.name}</b><span className="ml-auto text-xs text-muted-foreground">{app.people.listed} listed · {app.people.seen30} seen</span></div>
          {!rows ? <div className="h-16 animate-pulse rounded-xl bg-muted/50" /> : rows.length ? (
            <ul className="flex flex-col gap-0.5">
              {rows.slice(0, 8).map((r) => (
                <li key={r.key} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
                  <span className={cn("size-2 shrink-0 rounded-full", r.lastSeen && r.lastSeen >= since ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="min-w-0 flex-1 truncate">{r.name}<span className="text-xs text-muted-foreground">{r.department ? ` · ${r.department}` : ""}</span></span>
                  <span className="text-[11px] text-muted-foreground">{r.lastSeen ? timeAgo(r.lastSeen) : ""}</span>
                </li>
              ))}
            </ul>
          ) : <p className="py-2 text-xs text-muted-foreground">No names yet — click to add or import the user list.</p>}
          <button onClick={() => { setPos(null); onOpen(); }} className="mt-2 w-full rounded-xl bg-primary/10 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15">{rows && rows.length > 8 ? `See all ${rows.length} users →` : "Open the user list →"}</button>
        </motion.div>, document.body)}
    </>
  );
}

/* One shared drawer for the whole app, so any users count anywhere can open the list. */
const PeopleCtx = React.createContext<(app: AppSummary) => void>(() => undefined);
export function PeopleDrawerProvider({ children }: { children: React.ReactNode }) {
  const [app, setApp] = React.useState<AppSummary | null>(null);
  return <PeopleCtx.Provider value={setApp}>{children}<PeopleDrawer app={app} onClose={() => setApp(null)} /></PeopleCtx.Provider>;
}
export const useOpenPeople = () => React.useContext(PeopleCtx);
