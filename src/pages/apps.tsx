import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import * as XLSX from "xlsx";
import {
  Camera, AppWindow, ArrowDownWideNarrow, Columns3, Download, ExternalLink, FileSpreadsheet, LayoutGrid, Lock, Plus, Rows3, Search, Star, Users, Users2,
} from "lucide-react";
import { useApps, useRun } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { APP_STATUSES, type AppStatus, type AppSummary } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { MultiSelect } from "@/components/ui/multi-select";
import { Chip, EmptyState, ProgressBar, ProgressRing, Skeleton, Sparkline, StatusBadge, Tabs, TiltCard } from "@/components/ui/bits";
import { AppFormModal } from "@/components/app/app-form";
import { ImportWizard } from "@/components/app/import-wizard";
import { coverFor, hasRealCover } from "@/lib/covers";
import { call, CAN_CAPTURE } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn, fmtDate, fmtNumber, STATUS_HEX, STATUS_META, toneHex } from "@/lib/utils";
import { openApp } from "@/lib/launch";
import { Landscape, utilColor } from "@/components/app/landscape";
import { TicketBadge } from "@/components/app/tickets";

type View = "grid" | "list" | "board";
type Sort = "updated" | "name" | "progress" | "usage" | "users" | "utilization" | "golive";

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

/** Users (active / seats) + usage % pill, used on cards, rows and board. */
function UsersUsage({ app, compact }: { app: AppSummary; compact?: boolean }) {
  const { activeUsers, utilization: u } = app.landscape;
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", compact ? "text-[11px]" : "text-xs")} title={u === null ? "Set licensed seats on the app to see usage %" : "Active users ÷ licensed seats"}>
      <Users className={compact ? "size-3" : "size-3.5"} style={{ color: utilColor(u) }} />
      <span className="font-semibold text-foreground">{fmtNumber(activeUsers)}</span>
      <span className="text-muted-foreground">{app.seats ? `/ ${fmtNumber(app.seats)} users` : "users"}</span>
      <span className="rounded-full px-1.5 py-px font-bold" style={{ color: utilColor(u), background: `color-mix(in oklab, ${utilColor(u)} 14%, transparent)` }}>{u === null ? "—" : `${u}%`}</span>
    </span>
  );
}

function AppCard({ app, index }: { app: AppSummary; index: number }) {
  const navigate = useNavigate();
  return (
    <motion.div layout layoutId={`card-${app.id}`} initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(index, 12) * 0.035 }}>
      <TiltCard intensity={6} className="flex h-full cursor-pointer flex-col overflow-hidden" onClick={() => navigate(`/apps/${app.id}`)}>
        <div className="relative h-40 overflow-hidden">
          <motion.img layoutId={`cover-${app.id}`} src={coverFor(app, 640, 360)} alt="" className="size-full object-cover object-top transition-transform duration-700 group-hover/tilt:scale-110" />
          {!hasRealCover(app) && app.permission === "edit" && (
            <button onClick={(e) => { e.stopPropagation(); navigate(`/apps/${app.id}/screens`); }} className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md hover:bg-black/60">
              <Camera className="size-3" />Add real screenshot
            </button>
          )}
          {app.shotCount > 1 && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white backdrop-blur-md"><Camera className="size-3" />{app.shotCount}</span>}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)] via-transparent to-black/20" />
          <div className="absolute left-3 top-3 flex gap-1.5"><StatusBadge status={app.status} className="!bg-background/85 backdrop-blur-md" />{app.visibility === "restricted" && <span className="grid size-6 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md" title="Restricted"><Lock className="size-3" /></span>}</div>
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
              <div className="mb-1 flex flex-wrap items-center gap-1.5"><UsersUsage app={app} /><TicketBadge app={app} /></div>
              <div className="font-medium text-foreground">{fmtNumber(app.usage.sessions30)} <span className="font-normal text-muted-foreground">sessions · 30d</span></div>
              <div>{app.tasksDone}/{app.tasksTotal} tasks{app.overdue > 0 && <span className="text-rose-400"> · {app.overdue} overdue</span>}</div>
            </div>
            <Sparkline data={app.usage.spark} color={toneHex(app.tone)} width={84} height={28} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={app.url ? "primary" : "secondary"} className="flex-1" disabled={!app.url} onClick={(e) => { e.stopPropagation(); openApp(app); }} title={app.url || "No link set yet"}>
              <ExternalLink />{app.url ? "Open app" : "No link yet"}
            </Button>
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
          <motion.img layoutId={`cover-${app.id}`} src={coverFor(app, 120, 120)} alt="" className="h-10 w-16 rounded-lg border border-border object-cover object-top" />
          <div className="min-w-0"><div className="truncate font-semibold group-hover:underline">{app.name}</div><div className="truncate text-xs text-muted-foreground">{app.code} · {app.category}</div></div>
        </Link>
      </td>
      <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
      <td className="w-48 px-4 py-3"><div className="flex items-center gap-2"><ProgressBar value={app.progress} color={toneHex(app.tone)} /><span className="w-9 text-right text-xs tabular-nums">{app.progress}%</span></div></td>
      <td className="px-4 py-3"><UsersUsage app={app} /></td>
      <td className="px-4 py-3">{app.tickets?.total ? <TicketBadge app={app} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
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
                        <img src={coverFor(a, 80, 80)} alt="" className="h-8 w-12 rounded-md border border-border object-cover object-top" />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{a.name}</div><div className="truncate text-[11px] text-muted-foreground">{a.ownerName || a.department}</div></div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2"><ProgressBar value={a.progress} color={toneHex(a.tone)} className="h-1.5" /><span className="text-[11px] tabular-nums text-muted-foreground">{a.progress}%</span></div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5"><UsersUsage app={a} compact /><TicketBadge app={a} compact /></div>
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
  const [categoriesSel, setCategoriesSel] = React.useState<string[]>([]);
  const [onlyMine, setOnlyMine] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const statuses = (params.get("status") ?? "").split(",").filter(Boolean) as AppStatus[];
  const toggleStatus = (v: AppStatus | "") => {
    const next = !v ? [] : statuses.includes(v) ? statuses.filter((x) => x !== v) : [...statuses, v];
    setParams(next.length ? { status: next.join(",") } : {});
  };
  const qc = useQueryClient();
  const [capturingAll, setCapturingAll] = React.useState(false);
  async function captureAll() {
    const withLinks = (apps ?? []).filter((a) => a.url && !a.shotCount);
    if (!withLinks.length) { toast.info("Every app with a link already has a screenshot. Use an app's Screens tab to add more, or set links first."); return; }
    setCapturingAll(true);
    const id = toast.loading(`Capturing ${withLinks.length} application${withLinks.length > 1 ? "s" : ""}…`);
    try {
      const r = await call<{ captured: number; failed: string[] }>("apps.captureAll", { onlyMissing: true });
      await qc.invalidateQueries();
      toast.success(`Captured ${r.captured} screenshot${r.captured === 1 ? "" : "s"}${r.failed.length ? ` · ${r.failed.length} failed` : ""}`, { id, description: r.failed.slice(0, 3).join("\n") || undefined });
    } catch (e) { toast.error((e as Error).message, { id }); }
    setCapturingAll(false);
  }
  const navigate = useNavigate();

  React.useEffect(() => { try { localStorage.setItem("itm.view", view); } catch { /* ignore */ } }, [view]);

  const categories = [...new Set((apps ?? []).map((a) => a.category).filter(Boolean))].sort();
  const list = React.useMemo(() => {
    const s = q.toLowerCase().trim();
    const filtered = (apps ?? []).filter((a) =>
      (!statuses.length || view === "board" || statuses.includes(a.status)) && (!categoriesSel.length || categoriesSel.includes(a.category)) && (!onlyMine || a.ownerId === me.id || a.favorite) &&
      (!s || `${a.name} ${a.code} ${a.tagline} ${a.category} ${a.department} ${a.techStack.join(" ")} ${a.ownerName}`.toLowerCase().includes(s)));
    const sorters: Record<Sort, (a: AppSummary, b: AppSummary) => number> = {
      updated: (a, b) => (a.updatedAt < b.updatedAt ? 1 : -1),
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.progress - a.progress,
      usage: (a, b) => b.usage.sessions30 - a.usage.sessions30,
      users: (a, b) => b.landscape.activeUsers - a.landscape.activeUsers,
      utilization: (a, b) => (b.landscape.utilization ?? -1) - (a.landscape.utilization ?? -1),
      golive: (a, b) => (a.goLiveDate || "9999").localeCompare(b.goLiveDate || "9999"),
    };
    return filtered.sort((a, b) => Number(b.favorite) - Number(a.favorite) || sorters[sort](a, b));
  }, [apps, q, statuses.join(","), categoriesSel, onlyMine, sort, view, me.id]); // eslint-disable-line

  const counts = Object.fromEntries(APP_STATUSES.map((s) => [s, (apps ?? []).filter((a) => a.status === s).length]));

  function exportExcel() {
    const rows = list.map((a) => ({
      Name: a.name, Code: a.code, Status: STATUS_META[a.status].label, Progress: `${a.progress}%`, "Tasks done": a.tasksDone, "Tasks total": a.tasksTotal, Category: a.category, Department: a.department,
      Owner: a.ownerName, Version: a.version, Link: a.url, "Tech stack": a.techStack.join(", "), "Sessions (30d)": a.usage.sessions30, "Active users": a.usage.activeUsers,
      "Launches (30d)": a.usage.launches30, Hosting: a.hosting, Source: a.source, Vendor: a.vendor, "Licensed seats": a.seats, "Active users (landscape)": a.landscape.activeUsers, "Utilization": a.landscape.utilization === null ? "" : `${a.landscape.utilization}%`, "Open tickets": a.tickets?.open ?? 0, "Ticket keywords": a.ticketKeywords.join(", "), "Start date": a.startDate, "Go-live date": a.goLiveDate, Priority: a.priority, Visibility: a.visibility,
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
          {CAN_CAPTURE && me.role !== "viewer" && <Button variant="secondary" loading={capturingAll} onClick={captureAll} title="Open every app's link on the server and save a screenshot for apps that don't have one"><Camera />Capture screenshots</Button>}
          <Button variant="secondary" onClick={exportExcel} disabled={!list.length}><Download />Export</Button>
          {me.role !== "viewer" && <Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet />Import</Button>}
          {me.role !== "viewer" && <Button variant="primary" onClick={() => setCreating(true)}><Plus />New</Button>}
        </div>
      </div>

      <Landscape apps={list} allApps={apps ?? []} />

      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, stack, owner…" className="pl-9" />
        </div>
        <MultiSelect className="w-52" label="Categories" placeholder="All categories" value={categoriesSel} onChange={setCategoriesSel} options={categories.map((c) => ({ value: c, label: c, hint: String((apps ?? []).filter((a) => a.category === c).length) }))} />
        <MultiSelect className="w-48" label="Status" placeholder="All statuses" value={statuses} onChange={(v) => setParams(v.length ? { status: v.join(",") } : {})} searchable={false} options={APP_STATUSES.filter((s) => counts[s]).map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_HEX[s], hint: String(counts[s]) }))} />
        <div className="flex w-52 items-center gap-2"><ArrowDownWideNarrow className="size-4 shrink-0 text-muted-foreground" />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="updated">Recently updated</option><option value="name">Name</option><option value="progress">Progress</option><option value="usage">Most sessions</option><option value="users">Most users</option><option value="utilization">Usage %</option><option value="golive">Go-live date</option>
          </Select>
        </div>
        <Button variant={onlyMine ? "primary" : "secondary"} onClick={() => setOnlyMine((v) => !v)}><Users2 />Mine & pinned</Button>
        <Tabs id="view" value={view} onChange={setView} tabs={[{ value: "grid", label: "Grid", icon: <LayoutGrid /> }, { value: "list", label: "List", icon: <Rows3 /> }, { value: "board", label: "Board", icon: <Columns3 /> }]} />
      </div>

      {view !== "board" && (
        <div className="flex flex-wrap gap-2">
          {[["", "All", apps?.length ?? 0] as const, ...APP_STATUSES.filter((s) => counts[s]).map((s) => [s, STATUS_META[s].label, counts[s]] as const)].map(([value, label, n]) => (
            <button key={value || "all"} onClick={() => toggleStatus(value as AppStatus | "")} aria-pressed={value ? statuses.includes(value as AppStatus) : !statuses.length}
              className={cn("relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors", (value ? statuses.includes(value as AppStatus) : !statuses.length) ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {(value ? statuses.includes(value as AppStatus) : !statuses.length) && <motion.span layout className="emboss absolute inset-0 -z-10 rounded-full border border-border" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
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
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["Application", "Status", "Progress", "Users / usage", "Tickets", "Sessions 30d", "Owner", "Go-live", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
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
