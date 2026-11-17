import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import * as XLSX from "xlsx";
import {
  AppWindow, ArrowDownWideNarrow, Columns3, Download, ExternalLink, FileSpreadsheet, GitBranch, LayoutGrid, Lock, Plus, Rows3, Search, Star, Users2,
} from "lucide-react";
import { useApps, useRun } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { APP_STATUSES, type AppStatus, type AppSummary } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Chip, EmptyState, ProgressBar, ProgressRing, Skeleton, Sparkline, StatusBadge, Tabs, TiltCard } from "@/components/ui/bits";
import { AppFormModal } from "@/components/app/app-form";
import { ImportWizard } from "@/components/app/import-wizard";
import { coverFor } from "@/lib/covers";
import { cn, fmtDate, fmtNumber, STATUS_HEX, STATUS_META, toneHex } from "@/lib/utils";
import { openApp } from "@/lib/launch";

type View = "grid" | "list" | "board";
type Sort = "updated" | "name" | "progress" | "usage" | "golive";

function FavoriteButton({ app }: { app: AppSummary }) {
  const run = useRun();
  return (
    <motion.button whileTap={{ scale: 0.7, rotate: -20 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void run("apps.favorite", { id: app.id }); }}
      className={cn("grid size-8 place-items-center rounded-full backdrop-blur-md transition-colors", app.favorite ? "bg-amber-400/25 text-amber-300" : "bg-black/30 text-white/70 hover:text-white")}
      aria-label={app.favorite ? "Unpin" : "Pin"} title={app.favorite ? "Unpin" : "Pin to sidebar"}>
      <Star className={cn("size-4", app.favorite && "fill-current")} />
    </motion.button>
  );
}

function AppCard({ app, index }: { app: AppSummary; index: number }) {
  const navigate = useNavigate();
  return (
    <motion.div layout layoutId={`card-${app.id}`} initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index, 12) * 0.035 }}>
      <TiltCard intensity={6} className="flex h-full cursor-pointer flex-col overflow-hidden" onClick={() => navigate(`/apps/${app.id}`)}>
        <div className="relative h-40 overflow-hidden">
          <motion.img layoutId={`cover-${app.id}`} src={coverFor(app, 640, 360)} alt="" className="size-full object-cover transition-transform duration-700 group-hover/tilt:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-black/20" />
          <div className="absolute left-3 top-3 flex gap-1.5"><StatusBadge status={app.status} className="backdrop-blur-md" />{app.visibility === "restricted" && <span className="grid size-6 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md" title="Restricted"><Lock className="size-3" /></span>}</div>
          <div className="absolute right-3 top-3"><FavoriteButton app={app} /></div>
          <div className="absolute -bottom-6 right-4 rounded-full bg-[var(--card)] p-1 shadow-xl"><ProgressRing value={app.progress} size={52} stroke={5} color={toneHex(app.tone)} /></div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5 pt-3">
          <div className="pr-14">
            <h3 className="truncate text-lg font-semibold tracking-tight">{app.name}</h3>
            <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">{app.tagline || app.description || "No description yet."}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">{app.techStack.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}{app.techStack.length > 3 && <Chip>+{app.techStack.length - 3}</Chip>}</div>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{fmtNumber(app.usage.sessions30)} <span className="font-normal text-muted-foreground">sessions · 30d</span></div>
              <div>{app.tasksDone}/{app.tasksTotal} tasks{app.overdue > 0 && <span className="text-rose-400"> · {app.overdue} overdue</span>}</div>
            </div>
            <Sparkline data={app.usage.spark} color={toneHex(app.tone)} width={84} height={28} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={app.url ? "primary" : "secondary"} className="flex-1" disabled={!app.url} onClick={(e) => { e.stopPropagation(); openApp(app); }} title={app.url || "No link set yet"}>
              <ExternalLink />{app.url ? "Open app" : "No link yet"}
            </Button>
            {app.repoUrl && <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); window.open(app.repoUrl, "_blank", "noopener"); }} aria-label="Repository" title="Repository"><GitBranch /></Button>}
          </div>
        </div>
      </TiltCard>
    </motion.div>
  );
}

function AppRow({ app, index }: { app: AppSummary; index: number }) {
  return (
    <motion.tr layout initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: Math.min(index, 15) * 0.025 }} className="group border-t border-border hover:bg-muted/30">
      <td className="px-4 py-3">
        <Link to={`/apps/${app.id}`} className="flex items-center gap-3">
          <motion.img layoutId={`cover-${app.id}`} src={coverFor(app, 120, 120)} alt="" className="size-10 rounded-xl object-cover" />
          <div className="min-w-0"><div className="truncate font-semibold group-hover:underline">{app.name}</div><div className="truncate text-xs text-muted-foreground">{app.code} · {app.category}</div></div>
        </Link>
      </td>
      <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
      <td className="w-48 px-4 py-3"><div className="flex items-center gap-2"><ProgressBar value={app.progress} color={toneHex(app.tone)} /><span className="w-9 text-right text-xs tabular-nums">{app.progress}%</span></div></td>
      <td className="px-4 py-3 text-sm tabular-nums">{fmtNumber(app.usage.sessions30)}</td>
      <td className="px-4 py-3 text-sm">{app.ownerName || "—"}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{fmtDate(app.goLiveDate)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <FavoriteButton app={app} />
          <Button size="icon-sm" variant="ghost" disabled={!app.url} onClick={() => openApp(app)} aria-label="Open app"><ExternalLink /></Button>
        </div>
      </td>
    </motion.tr>
  );
}

function Board({ apps }: { apps: AppSummary[] }) {
  const run = useRun();
  const [over, setOver] = React.useState<AppStatus | null>(null);
  const columns = APP_STATUSES.filter((s) => s !== "retired" || apps.some((a) => a.status === "retired"));
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((status) => {
        const list = apps.filter((a) => a.status === status);
        return (
          <div key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const id = e.dataTransfer.getData("text/app");
              const app = apps.find((a) => a.id === id);
              if (app && app.status !== status) void run("apps.update", { id, status }, { success: `${app.name} → ${STATUS_META[status].label}` });
            }}
            className={cn("glass flex w-72 shrink-0 flex-col rounded-3xl p-3 transition-all", over === status && "scale-[1.02] ring-2 ring-primary")}>
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: STATUS_HEX[status], boxShadow: `0 0 10px ${STATUS_HEX[status]}` }} />{STATUS_META[status].label}</span>
              <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{list.length}</span>
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              <AnimatePresence>
                {list.map((a) => (
                  <motion.div key={a.id} layout layoutId={`board-${a.id}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <Link to={`/apps/${a.id}`} draggable={a.permission === "edit"} onDragStart={(e) => e.dataTransfer.setData("text/app", a.id)}
                      className="emboss block cursor-grab rounded-2xl border border-border p-3 active:cursor-grabbing">
                      <div className="flex items-center gap-2.5">
                        <img src={coverFor(a, 80, 80)} alt="" className="size-8 rounded-lg" />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{a.name}</div><div className="truncate text-[11px] text-muted-foreground">{a.ownerName || a.department}</div></div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2"><ProgressBar value={a.progress} color={toneHex(a.tone)} className="h-1.5" /><span className="text-[11px] tabular-nums text-muted-foreground">{a.progress}%</span></div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
              {list.length === 0 && <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border py-6 text-xs text-muted-foreground">Drop here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AppsPage() {
  const me = useMe();
  const { data: apps, isLoading } = useApps();
  const [params, setParams] = useSearchParams();
  const [view, setView] = React.useState<View>(() => (localStorage.getItem("itm.view") as View) || "grid");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("updated");
  const [category, setCategory] = React.useState("");
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const status = (params.get("status") as AppStatus | null) ?? "";
  const navigate = useNavigate();

  React.useEffect(() => { try { localStorage.setItem("itm.view", view); } catch { /* ignore */ } }, [view]);

  const categories = [...new Set((apps ?? []).map((a) => a.category).filter(Boolean))].sort();
  const list = React.useMemo(() => {
    const s = q.toLowerCase().trim();
    const filtered = (apps ?? []).filter((a) =>
      (!status || view === "board" || a.status === status) && (!category || a.category === category) && (!onlyMine || a.ownerId === me.id || a.favorite) &&
      (!s || `${a.name} ${a.code} ${a.tagline} ${a.category} ${a.department} ${a.techStack.join(" ")} ${a.ownerName}`.toLowerCase().includes(s)));
    const sorters: Record<Sort, (a: AppSummary, b: AppSummary) => number> = {
      updated: (a, b) => (a.updatedAt < b.updatedAt ? 1 : -1),
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.progress - a.progress,
      usage: (a, b) => b.usage.sessions30 - a.usage.sessions30,
      golive: (a, b) => (a.goLiveDate || "9999").localeCompare(b.goLiveDate || "9999"),
    };
    return filtered.sort((a, b) => Number(b.favorite) - Number(a.favorite) || sorters[sort](a, b));
  }, [apps, q, status, category, onlyMine, sort, view, me.id]);

  const counts = Object.fromEntries(APP_STATUSES.map((s) => [s, (apps ?? []).filter((a) => a.status === s).length]));

  function exportExcel() {
    const rows = list.map((a) => ({
      Name: a.name, Code: a.code, Status: STATUS_META[a.status].label, Progress: `${a.progress}%`, "Tasks done": a.tasksDone, "Tasks total": a.tasksTotal, Category: a.category, Department: a.department,
      Owner: a.ownerName, Version: a.version, Link: a.url, Repository: a.repoUrl, "Tech stack": a.techStack.join(", "), "Sessions (30d)": a.usage.sessions30, "Active users": a.usage.activeUsers,
      "Launches (30d)": a.usage.launches30, "Start date": a.startDate, "Go-live date": a.goLiveDate, Priority: a.priority, Visibility: a.visibility,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Applications");
    XLSX.writeFile(wb, `applications-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">{apps?.length ?? 0} applications · {list.length} shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportExcel} disabled={!list.length}><Download />Export</Button>
          {me.role !== "viewer" && <Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import</Button>}
          {me.role !== "viewer" && <Button variant="primary" onClick={() => setCreating(true)}><Plus />New</Button>}
        </div>
      </div>

      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, stack, owner…" className="pl-9" />
        </div>
        <div className="w-44"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select></div>
        <div className="flex w-52 items-center gap-2"><ArrowDownWideNarrow className="size-4 shrink-0 text-muted-foreground" />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="updated">Recently updated</option><option value="name">Name</option><option value="progress">Progress</option><option value="usage">Most used</option><option value="golive">Go-live date</option>
          </Select>
        </div>
        <Button variant={onlyMine ? "primary" : "secondary"} onClick={() => setOnlyMine((v) => !v)}><Users2 />Mine & pinned</Button>
        <Tabs id="view" value={view} onChange={setView} tabs={[{ value: "grid", label: "Grid", icon: <LayoutGrid /> }, { value: "list", label: "List", icon: <Rows3 /> }, { value: "board", label: "Board", icon: <Columns3 /> }]} />
      </div>

      {view !== "board" && (
        <div className="flex flex-wrap gap-2">
          {[["", "All", apps?.length ?? 0] as const, ...APP_STATUSES.filter((s) => counts[s]).map((s) => [s, STATUS_META[s].label, counts[s]] as const)].map(([value, label, n]) => (
            <button key={value || "all"} onClick={() => setParams(value ? { status: value } : {})}
              className={cn("relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors", status === value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {status === value && <motion.span layoutId="status-chip" className="emboss absolute inset-0 -z-10 rounded-full border border-border" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              {value && <span className="mr-1.5 inline-block size-2 rounded-full" style={{ background: STATUS_HEX[value as AppStatus] }} />}{label} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div>
      ) : !list.length ? (
        <EmptyState icon={<AppWindow />} title={apps?.length ? "No applications match" : "No applications yet"} text={apps?.length ? "Try a different search or filter." : "Add your first application or import a list from Excel."}
          action={me.role !== "viewer" && !apps?.length ? <div className="flex gap-2"><Button variant="primary" onClick={() => setCreating(true)}><Plus />New application</Button><Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import</Button></div> : undefined} />
      ) : (
        <LayoutGroup>
          <AnimatePresence mode="popLayout">
            {view === "grid" && (
              <motion.div key="grid" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AnimatePresence>{list.map((a, i) => <AppCard key={a.id} app={a} index={i} />)}</AnimatePresence>
              </motion.div>
            )}
            {view === "list" && (
              <motion.div key="list" className="glass overflow-x-auto rounded-3xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <table className="w-full min-w-[860px]">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["Application", "Status", "Progress", "Sessions 30d", "Owner", "Go-live", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
                  <tbody><AnimatePresence>{list.map((a, i) => <AppRow key={a.id} app={a} index={i} />)}</AnimatePresence></tbody>
                </table>
              </motion.div>
            )}
            {view === "board" && <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Board apps={list} /></motion.div>}
          </AnimatePresence>
        </LayoutGroup>
      )}

      <AppFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/apps/${id}`)} />
      <ImportWizard open={importing} onClose={() => setImporting(false)} kind="apps" />
    </div>
  );
}
