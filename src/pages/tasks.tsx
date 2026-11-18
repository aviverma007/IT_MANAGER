import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import * as XLSX from "xlsx";
import { AlarmClock, CalendarClock, CheckCircle2, Columns3, Download, ListChecks, Plus, Rows3, Search, User, X } from "lucide-react";
import { useAllTasks, useApp, useApps, useRun } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { PRIORITIES, type Priority, type TaskRow } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { AnimatedNumber, Checkbox, EmptyState, GlassCard, PriorityDot, Skeleton, Tabs } from "@/components/ui/bits";
import { Modal } from "@/components/ui/modal";
import { AssigneeSelect, splitAssignees, useAssigneeNames } from "@/components/app/assignee";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn, fmtDate, PRIORITY_META, toneHex } from "@/lib/utils";

type Status = "open" | "overdue" | "week" | "done" | "all";
type View = "list" | "board";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function bucket(t: TaskRow, done: boolean) {
  if (done) return "done";
  if (!t.dueDate) return "nodate";
  if (t.dueDate < today()) return "overdue";
  if (t.dueDate === today()) return "today";
  if (t.dueDate <= plusDays(7)) return "week";
  return "later";
}

const BUCKETS = [
  { key: "overdue", label: "Overdue", color: "#f43f5e" },
  { key: "today", label: "Due today", color: "#f59e0b" },
  { key: "week", label: "Next 7 days", color: "#8b5cf6" },
  { key: "later", label: "Later", color: "#06b6d4" },
  { key: "nodate", label: "No due date", color: "#a1a1aa" },
  { key: "done", label: "Done", color: "#10b981" },
] as const;

function TaskLine({ t, done, onToggle, showApp = true }: { t: TaskRow; done: boolean; onToggle: (v: boolean) => void; showApp?: boolean }) {
  const b = bucket(t, done);
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30, height: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn("group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/40", done && "opacity-60")}>
      <Checkbox checked={done} onChange={onToggle} disabled={!t.canEdit} label={`Mark "${t.title}" ${done ? "not done" : "done"}`} />
      <Link to={`/apps/${t.appId}/tasks`} className="min-w-0 flex-1">
        <div className={cn("truncate text-sm", done && "text-muted-foreground line-through")}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {showApp && <span className="inline-flex items-center gap-1 font-medium" style={{ color: toneHex(t.appTone) }}><span className="size-1.5 rounded-full" style={{ background: toneHex(t.appTone) }} />{t.appName}</span>}
          <span className="truncate">{t.groupTitle}</span>
          {t.notes && <span className="truncate italic">· {t.notes.slice(0, 60)}</span>}
        </div>
      </Link>
      {t.assignee && <span className="hidden max-w-48 items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline-flex" title={t.assignee}><User className="size-3 shrink-0" /><span className="truncate">{splitAssignees(t.assignee).map((n) => n.split(" ")[0]).join(", ")}</span></span>}
      {t.dueDate && !done && <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium", b === "overdue" ? "bg-rose-500/15 text-rose-500" : b === "today" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{fmtDate(t.dueDate, { day: "numeric", month: "short" })}</span>}
      <PriorityDot priority={t.priority} />
    </motion.li>
  );
}

function NewTaskModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const run = useRun();
  const { data: apps } = useApps();
  const editable = (apps ?? []).filter((a) => a.permission === "edit");
  const [appId, setAppId] = React.useState("");
  const { data: app } = useApp(appId || undefined);
  const [f, setF] = React.useState({ groupId: "", title: "", assignee: "", dueDate: "", priority: "medium", notes: "" });
  React.useEffect(() => { if (open) { setAppId(editable[0]?.id ?? ""); setF({ groupId: "", title: "", assignee: "", dueDate: "", priority: "medium", notes: "" }); } }, [open]); // eslint-disable-line
  React.useEffect(() => { if (app) setF((x) => ({ ...x, groupId: app.groups[0]?.id ?? "" })); }, [app?.id]); // eslint-disable-line

  async function save() {
    let groupId = f.groupId;
    if (!groupId && appId) {
      const g = await run<{ id: string }>("groups.create", { appId, title: "General" });
      groupId = g?.id ?? "";
    }
    if (!groupId) return;
    const res = await run("tasks.create", { groupId, title: f.title, assignee: f.assignee, dueDate: f.dueDate, priority: f.priority, notes: f.notes }, { success: "Task added" });
    if (res) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New task" icon={<Plus />} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!f.title.trim() || !appId} onClick={save}>Add task</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Application"><Select value={appId} onChange={(e) => setAppId(e.target.value)}>{editable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Heading"><Select value={f.groupId} onChange={(e) => setF({ ...f, groupId: e.target.value })}>{(app?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}{!app?.groups.length && <option value="">General (new)</option>}</Select></Field>
        <Field label="Task" className="sm:col-span-2"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What needs to be done?" /></Field>
        <Field label="Assignee"><AssigneeSelect value={f.assignee} onChange={(v) => setF({ ...f, assignee: v })} /></Field>
        <Field label="Due date"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="Priority" className="sm:col-span-2">
          <div className="grid grid-cols-4 gap-2">{PRIORITIES.map((p) => <button key={p} onClick={() => setF({ ...f, priority: p })} className={cn("rounded-xl border px-2 py-2 text-xs", f.priority === p ? "emboss border-ring" : "border-border text-muted-foreground hover:border-ring")}><PriorityDot priority={p} withLabel /></button>)}</div>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="min-h-16" /></Field>
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const me = useMe();
  const run = useRun();
  const { data: tasks, isLoading } = useAllTasks();
  const { data: apps } = useApps();
  const [params, setParams] = useSearchParams();
  const status = (params.get("s") as Status) || "open";
  const [view, setView] = React.useState<View>(() => (localStorage.getItem("itm.tasksView") as View) || "list");
  const [q, setQ] = React.useState("");
  const [appIds, setAppIds] = React.useState<string[]>(() => (params.get("app") ? [params.get("app")!] : []));
  const [assigneesSel, setAssigneesSel] = React.useState<string[]>([]);
  const [priorities, setPriorities] = React.useState<string[]>([]);
  const [mine, setMine] = React.useState(false);
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);
  React.useEffect(() => { try { localStorage.setItem("itm.tasksView", view); } catch { /* ignore */ } }, [view]);

  const isDone = (t: TaskRow) => pending[t.id] ?? t.done;
  const myNames = [me.name.toLowerCase(), me.name.split(" ")[0]!.toLowerCase(), me.username.toLowerCase()];
  const all = tasks ?? [];
  const assignees = useAssigneeNames();

  const base = all.filter((t) => {
    const s = q.toLowerCase().trim();
    const people = splitAssignees(t.assignee);
    return (!appIds.length || appIds.includes(t.appId)) && (!assigneesSel.length || assigneesSel.some((a) => (a === "__none" ? !people.length : people.includes(a)))) && (!priorities.length || priorities.includes(t.priority)) &&
      (!mine || people.includes(me.name) || people.some((n) => myNames.includes(n.toLowerCase()))) &&
      (!s || `${t.title} ${t.notes} ${t.appName} ${t.groupTitle} ${t.assignee}`.toLowerCase().includes(s));
  });
  const counts = {
    open: base.filter((t) => !isDone(t)).length,
    overdue: base.filter((t) => bucket(t, isDone(t)) === "overdue").length,
    week: base.filter((t) => ["today", "week"].includes(bucket(t, isDone(t)))).length,
    done: base.filter((t) => isDone(t)).length,
    all: base.length,
  };
  const list = base.filter((t) => {
    const b = bucket(t, isDone(t));
    return status === "all" || (status === "open" && b !== "done") || (status === "done" && b === "done") || (status === "overdue" && b === "overdue") || (status === "week" && (b === "today" || b === "week"));
  }).sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  async function toggle(t: TaskRow, v: boolean) {
    setPending((p) => ({ ...p, [t.id]: v }));
    await run("tasks.update", { id: t.id, done: v });
    setPending((p) => { const { [t.id]: _, ...rest } = p; return rest; });
  }

  function exportExcel() {
    const rows = list.map((t) => ({ Application: t.appName, Heading: t.groupTitle, Task: t.title, Done: isDone(t) ? "Yes" : "No", Assignee: t.assignee, "Due date": t.dueDate, Priority: PRIORITY_META[t.priority].label, Notes: t.notes, "Completed by": t.doneBy ?? "", "Completed on": t.doneAt?.slice(0, 10) ?? "" }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Tasks");
    XLSX.writeFile(wb, `all-tasks-${today()}.xlsx`);
  }

  const byApp = new Map<string, TaskRow[]>();
  for (const t of list) byApp.set(t.appId, [...(byApp.get(t.appId) ?? []), t]);
  const filters = appIds.length + assigneesSel.length + priorities.length + (q ? 1 : 0) + (mine ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight">All tasks</h1><p className="text-sm text-muted-foreground">Every task from every application in one place.</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportExcel} disabled={!list.length}><Download />Export</Button>
          {me.role !== "viewer" && <Button variant="primary" onClick={() => setAdding(true)}><Plus />New task</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ["open", "Open", ListChecks, "var(--chart-1)"],
          ["overdue", "Overdue", AlarmClock, "#f43f5e"],
          ["week", "Due in 7 days", CalendarClock, "#f59e0b"],
          ["done", "Done", CheckCircle2, "#10b981"],
        ] as const).map(([key, label, Icon, color], i) => (
          <motion.button key={key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -3 }} onClick={() => setParams({ s: key })}
            className={cn("glass flex items-center gap-4 rounded-3xl p-4 text-left transition-shadow", status === key && "ring-2 ring-ring")}>
            <span className="emboss grid size-11 place-items-center rounded-2xl" style={{ color }}><Icon className="size-5" /></span>
            <span><span className="block text-xs text-muted-foreground">{label}</span><span className="text-2xl font-bold"><AnimatedNumber value={counts[key]} /></span></span>
          </motion.button>
        ))}
      </div>

      <GlassCard className="flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, notes, apps, people…" className="pl-9" />
        </div>
        <MultiSelect className="w-52" label="Applications" placeholder="All applications" value={appIds} onChange={setAppIds} options={(apps ?? []).map((a) => ({ value: a.id, label: a.name, color: toneHex(a.tone) }))} />
        <MultiSelect className="w-48" label="Assignees" placeholder="Anyone" value={assigneesSel} onChange={setAssigneesSel} options={[{ value: "__none", label: "Unassigned" }, ...assignees.map((a) => ({ value: a, label: a }))]} />
        <MultiSelect className="w-44" label="Priority" placeholder="Any priority" value={priorities} onChange={setPriorities} searchable={false} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, color: { low: "#a1a1aa", medium: "#38bdf8", high: "#fbbf24", critical: "#f43f5e" }[p] }))} />
        <Button variant={mine ? "primary" : "secondary"} onClick={() => setMine((v) => !v)}><User />Assigned to me</Button>
        {filters > 0 && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setAppIds([]); setAssigneesSel([]); setPriorities([]); setMine(false); }}><X />Clear</Button>}
        <Tabs id="tasks-view" value={view} onChange={setView} tabs={[{ value: "list", label: "By app", icon: <Rows3 /> }, { value: "board", label: "By due date", icon: <Columns3 /> }]} />
      </GlassCard>

      <Tabs id="tasks-status" value={status} onChange={(s) => setParams({ s })} tabs={[
        { value: "open", label: "Open", count: counts.open }, { value: "overdue", label: "Overdue", count: counts.overdue },
        { value: "week", label: "Due in 7 days", count: counts.week }, { value: "done", label: "Done", count: counts.done }, { value: "all", label: "All", count: counts.all },
      ]} />

      {isLoading ? <div className="grid gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}</div>
        : !list.length ? <EmptyState icon={<ListChecks />} title={all.length ? "Nothing here" : "No tasks yet"} text={all.length ? "No tasks match this view and these filters." : "Add tasks inside an application, import them from Excel, or use New task."} />
          : view === "list" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <AnimatePresence>
                {[...byApp.entries()].map(([id, items], gi) => {
                  const first = items[0]!;
                  const appTasks = all.filter((t) => t.appId === id);
                  const pct = appTasks.length ? Math.round((appTasks.filter(isDone).length / appTasks.length) * 100) : 0;
                  return (
                    <motion.section key={id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(gi, 8) * 0.04 }} className="glass rounded-3xl p-3">
                      <header className="mb-1 flex items-center gap-3 px-2 py-1">
                        <span className="size-3 rounded-full" style={{ background: toneHex(first.appTone), boxShadow: `0 0 10px ${toneHex(first.appTone)}` }} />
                        <Link to={`/apps/${id}/tasks`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{first.appName}</Link>
                        <span className="text-xs tabular-nums text-muted-foreground">{items.length} shown · {pct}% done</span>
                      </header>
                      <ul><AnimatePresence initial={false}>{items.map((t) => <TaskLine key={t.id} t={t} done={isDone(t)} onToggle={(v) => toggle(t, v)} showApp={false} />)}</AnimatePresence></ul>
                    </motion.section>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {BUCKETS.filter((b) => status === "all" || status === "done" ? true : b.key !== "done").map((b) => {
                const items = list.filter((t) => bucket(t, isDone(t)) === b.key);
                if (!items.length && (status === "overdue" || status === "week")) return null;
                return (
                  <div key={b.key} className="glass flex w-80 shrink-0 flex-col rounded-3xl p-3">
                    <div className="mb-2 flex items-center justify-between px-2">
                      <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: b.color, boxShadow: `0 0 10px ${b.color}` }} />{b.label}</span>
                      <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{items.length}</span>
                    </div>
                    <ul className="flex min-h-20 flex-col"><AnimatePresence initial={false}>{items.map((t) => <TaskLine key={t.id} t={t} done={isDone(t)} onToggle={(v) => toggle(t, v)} />)}</AnimatePresence></ul>
                    {!items.length && <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border py-6 text-xs text-muted-foreground">Nothing</div>}
                  </div>
                );
              })}
            </div>
          )}

      <NewTaskModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
