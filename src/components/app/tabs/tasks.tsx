import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, ChevronDown, Download, Edit3, FileSpreadsheet, FolderPlus, ListChecks, MessageSquareText, Plus, Search, Trash2, X } from "lucide-react";
import type { AppDetail, Task, TaskGroup } from "@/core/types";
import { PRIORITIES } from "@/core/types";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Burst, Checkbox, EmptyState, PriorityDot, ProgressBar, Tabs } from "@/components/ui/bits";
import { Drawer, useConfirm } from "@/components/ui/modal";
import { ImportWizard } from "@/components/app/import-wizard";
import { AssigneeSelect } from "@/components/app/assignee";
import { cn, fmtDate, toneHex } from "@/lib/utils";

type Filter = "all" | "open" | "done";

function TaskRow({ task, canEdit, done, onToggle, onEdit, first, last }: {
  task: Task; canEdit: boolean; done: boolean; onToggle: (v: boolean) => void; onEdit: () => void; first: boolean; last: boolean;
}) {
  const run = useRun();
  const confirm = useConfirm();
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !done && task.dueDate && task.dueDate < today;
  return (
    <motion.li layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, x: 40 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="group/task">
      <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/40", done && "opacity-70")}>
        <Checkbox checked={done} onChange={onToggle} disabled={!canEdit} label={`Mark "${task.title}" ${done ? "not done" : "done"}`} />
        <button onClick={canEdit ? onEdit : undefined} className="relative min-w-0 flex-1 text-left">
          <span className={cn("relative text-sm transition-colors", done && "text-muted-foreground")}>
            {task.title}
            <motion.span aria-hidden className="absolute left-0 top-1/2 h-px bg-muted-foreground" initial={false} animate={{ width: done ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
          </span>
          {task.notes && <MessageSquareText className="ml-2 inline size-3.5 text-muted-foreground" />}
          {done && task.doneBy && <span className="ml-2 text-[11px] text-muted-foreground">✓ {task.doneBy}</span>}
        </button>
        {task.assignee && <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">{task.assignee}</span>}
        {task.dueDate && <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-medium", overdue ? "bg-rose-500/15 text-rose-400" : "text-muted-foreground")}>{fmtDate(task.dueDate, { day: "numeric", month: "short" })}</span>}
        <PriorityDot priority={task.priority} />
        {canEdit && (
          <div className="flex opacity-0 transition-opacity group-hover/task:opacity-100 focus-within:opacity-100">
            <Button size="icon-sm" variant="ghost" disabled={first} onClick={() => run("tasks.move", { id: task.id, dir: -1 })} aria-label="Move up"><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" disabled={last} onClick={() => run("tasks.move", { id: task.id, dir: 1 })} aria-label="Move down"><ArrowDown /></Button>
            <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edit task"><Edit3 /></Button>
            <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Delete task?", message: task.title, confirm: "Delete", danger: true })) void run("tasks.delete", { id: task.id }); }} aria-label="Delete task"><Trash2 /></Button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

function GroupCard({ app, group, index, total, filter, query, onEditTask, pending, setPending }: {
  app: AppDetail; group: TaskGroup; index: number; total: number; filter: Filter; query: string; onEditTask: (t: Task) => void;
  pending: Record<string, boolean>; setPending: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const [open, setOpen] = React.useState(true);
  const [renaming, setRenaming] = React.useState(false);
  const [title, setTitle] = React.useState(group.title);
  const [draft, setDraft] = React.useState("");
  const [burst, setBurst] = React.useState(0);
  const all = app.tasks.filter((t) => t.groupId === group.id);
  const isDone = (t: Task) => pending[t.id] ?? t.done;
  const done = all.filter(isDone).length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const q = query.toLowerCase();
  const visible = all.filter((t) => (filter === "all" || (filter === "done") === isDone(t)) && (!q || `${t.title} ${t.assignee} ${t.notes}`.toLowerCase().includes(q)));

  async function toggle(task: Task, value: boolean) {
    setPending((p) => ({ ...p, [task.id]: value }));
    const remaining = all.filter((t) => t.id !== task.id && !isDone(t)).length;
    if (value && remaining === 0) setBurst((b) => b + 1);
    await run("tasks.update", { id: task.id, done: value }, { success: value && remaining === 0 ? `“${group.title}” is complete! 🎉` : undefined });
    setPending((p) => { const { [task.id]: _, ...rest } = p; return rest; });
  }

  async function add() {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    await run("tasks.create", { groupId: group.id, title: t });
  }

  if (query && !visible.length) return null;

  return (
    <motion.section layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: "spring", stiffness: 260, damping: 28, delay: index * 0.04 }}
      className="glass relative overflow-hidden rounded-3xl">
      <Burst fire={burst} />
      <header className="flex flex-wrap items-center gap-3 p-4 pb-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen((o) => !o)} className="emboss grid size-9 shrink-0 place-items-center rounded-xl" aria-label={open ? "Collapse" : "Expand"}>
          <motion.span animate={{ rotate: open ? 0 : -90 }}><ChevronDown className="size-4" /></motion.span>
        </motion.button>
        {renaming ? (
          <form className="flex flex-1 gap-2" onSubmit={async (e) => { e.preventDefault(); setRenaming(false); if (title.trim() && title !== group.title) await run("groups.update", { id: group.id, title }); }}>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setRenaming(false)} className="h-9" />
          </form>
        ) : (
          <h3 onDoubleClick={() => canEdit && setRenaming(true)} className="min-w-0 flex-1 truncate text-base font-semibold">{group.title}</h3>
        )}
        <div className="flex w-full items-center gap-3 sm:w-64">
          <ProgressBar value={pct} color={pct === 100 ? "var(--chart-3)" : toneHex(app.tone)} />
          <span className={cn("w-16 shrink-0 text-right text-xs font-semibold tabular-nums", pct === 100 && "text-emerald-500")}>{done}/{all.length}</span>
        </div>
        {canEdit && (
          <div className="flex">
            <Button size="icon-sm" variant="ghost" disabled={index === 0} onClick={() => run("groups.move", { id: group.id, dir: -1 })} aria-label="Move heading up"><ArrowUp /></Button>
            <Button size="icon-sm" variant="ghost" disabled={index === total - 1} onClick={() => run("groups.move", { id: group.id, dir: 1 })} aria-label="Move heading down"><ArrowDown /></Button>
            <Button size="icon-sm" variant="ghost" onClick={() => { setTitle(group.title); setRenaming(true); }} aria-label="Rename heading"><Edit3 /></Button>
            <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Delete “${group.title}”?`, message: `Its ${all.length} task(s) will be deleted too.`, confirm: "Delete heading", danger: true })) void run("groups.delete", { id: group.id }); }} aria-label="Delete heading"><Trash2 /></Button>
          </div>
        )}
      </header>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 34 }} className="overflow-hidden">
            <ul className="px-2 pb-2">
              <AnimatePresence initial={false}>
                {visible.map((t, i) => <TaskRow key={t.id} task={t} canEdit={canEdit} done={isDone(t)} onToggle={(v) => toggle(t, v)} onEdit={() => onEditTask(t)} first={i === 0} last={i === visible.length - 1} />)}
              </AnimatePresence>
              {!visible.length && <li className="px-4 py-3 text-sm text-muted-foreground">{all.length ? "No tasks match this filter." : "No tasks under this heading yet."}</li>}
            </ul>
            {canEdit && (
              <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="flex gap-2 border-t border-border p-3">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add a task to “${group.title}” and press Enter`} className="h-9" />
                <Button type="submit" size="sm" variant="primary" disabled={!draft.trim()} className="h-9"><Plus />Add</Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function TaskDrawer({ app, task, onClose }: { app: AppDetail; task: Task | null; onClose: () => void }) {
  const run = useRun();
  const [form, setForm] = React.useState<Partial<Task>>({});
  React.useEffect(() => { if (task) setForm(task); }, [task]);
  const set = (k: keyof Task, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    if (!task) return;
    const res = await run("tasks.update", { id: task.id, title: form.title, notes: form.notes, assignee: form.assignee, dueDate: form.dueDate, priority: form.priority, groupId: form.groupId, done: form.done }, { success: "Task saved" });
    if (res) onClose();
  }
  return (
    <Drawer open={!!task} onClose={onClose} title="Edit task" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save task</Button></>}>
      <div className="grid gap-4">
        <Field label="Task"><Textarea value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className="min-h-16" /></Field>
        <Field label="Heading"><Select value={form.groupId} onChange={(e) => set("groupId", e.target.value)}>{app.groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee"><AssigneeSelect value={form.assignee ?? ""} onChange={(v) => set("assignee", v)} /></Field>
          <Field label="Due date"><Input type="date" value={form.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        </div>
        <Field label="Priority">
          <div className="grid grid-cols-4 gap-2">
            {PRIORITIES.map((p) => (
              <button key={p} onClick={() => set("priority", p)} className={cn("rounded-xl border px-2 py-2 text-xs capitalize transition-all", form.priority === p ? "emboss border-ring" : "border-border text-muted-foreground hover:border-ring")}>
                <PriorityDot priority={p} withLabel />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notes"><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Details, links, decisions…" className="min-h-32" /></Field>
        <label className="deboss flex items-center gap-3 rounded-xl p-3 text-sm"><Checkbox checked={!!form.done} onChange={(v) => set("done", v)} label="Done" />Mark as done</label>
        {task?.doneAt && <p className="text-xs text-muted-foreground">Completed {fmtDate(task.doneAt)} by {task.doneBy}</p>}
      </div>
    </Drawer>
  );
}

export function TasksTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const canEdit = app.permission === "edit";
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [newHeading, setNewHeading] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const open = app.tasks.filter((t) => !(pending[t.id] ?? t.done)).length;

  function exportTasks() {
    const rows = app.tasks.map((t) => ({ Heading: app.groups.find((g) => g.id === t.groupId)?.title ?? "", Task: t.title, Done: t.done ? "Yes" : "No", Assignee: t.assignee, "Due date": t.dueDate, Priority: t.priority, Notes: t.notes, "Completed by": t.doneBy ?? "", "Completed on": t.doneAt?.slice(0, 10) ?? "" }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Tasks");
    XLSX.writeFile(wb, `${app.code || app.name}-tasks.xlsx`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-3">
        <Tabs id="task-filter" value={filter} onChange={setFilter} tabs={[{ value: "all", label: "All", count: app.tasks.length }, { value: "open", label: "Open", count: open }, { value: "done", label: "Done", count: app.tasks.length - open }]} />
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="pl-9" />
          {query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear"><X className="size-4" /></button>}
        </div>
        <Button variant="secondary" onClick={exportTasks} disabled={!app.tasks.length}><Download />Export</Button>
        {canEdit && <Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import</Button>}
        {canEdit && <Button variant="primary" onClick={() => setNewHeading("")}><FolderPlus />Add heading</Button>}
      </div>

      <AnimatePresence>
        {newHeading !== null && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
            onSubmit={async (e) => { e.preventDefault(); if (!newHeading.trim()) return; await run("groups.create", { appId: app.id, title: newHeading }, { success: "Heading added" }); setNewHeading(null); }}>
            <div className="glass flex gap-2 rounded-3xl p-3">
              <Input autoFocus value={newHeading} onChange={(e) => setNewHeading(e.target.value)} placeholder="Heading name, e.g. “Phase 2 — Reports”" />
              <Button type="submit" variant="primary" disabled={!newHeading.trim()}>Create</Button>
              <Button variant="ghost" onClick={() => setNewHeading(null)}>Cancel</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {app.groups.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No checklist yet" text="Create headings (phases, modules, milestones) and add tasks under each. Ticking tasks updates the app's progress." action={canEdit ? <Button variant="primary" onClick={() => setNewHeading("")}><FolderPlus />Add the first heading</Button> : undefined} />
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {app.groups.map((g, i) => <GroupCard key={g.id} app={app} group={g} index={i} total={app.groups.length} filter={filter} query={query} onEditTask={setEditing} pending={pending} setPending={setPending} />)}
          </AnimatePresence>
        </div>
      )}

      <TaskDrawer app={app} task={editing} onClose={() => setEditing(null)} />
      <ImportWizard open={importing} onClose={() => setImporting(false)} kind="tasks" appId={app.id} appName={app.name} />
    </div>
  );
}
