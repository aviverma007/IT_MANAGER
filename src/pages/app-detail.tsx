import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppLogo } from "@/components/app/app-logo";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import {
  Camera, Activity, ArrowLeft, BookOpen, CheckSquare, Edit3, ExternalLink, FileBox, Globe, LayoutDashboard, Lock, Rocket, Shield, Star, Tag, Trash2, Wifi, WifiOff, Ticket } from "lucide-react";
import { useApp, useRun } from "@/api/hooks";
import { pingUrl } from "@/api/client";
import { useMe } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, ProgressRing, Skeleton, StatusBadge, Tabs } from "@/components/ui/bits";
import { useConfirm } from "@/components/ui/modal";
import { AppFormModal } from "@/components/app/app-form";
import { coverFor } from "@/lib/covers";
import { cn, fmtNumber, toneHex } from "@/lib/utils";
import { openApp } from "@/lib/launch";
import { OverviewTab } from "@/components/app/tabs/overview";
import { TasksTab } from "@/components/app/tabs/tasks";
import { UsageTab } from "@/components/app/tabs/usage";
import { DocsTab } from "@/components/app/tabs/docs";
import { ReleasesTab } from "@/components/app/tabs/releases";
import { FilesTab } from "@/components/app/tabs/files";
import { AccessTab } from "@/components/app/tabs/access";
import { ActivityTab } from "@/components/app/tabs/activity";
import { TicketsTab } from "@/components/app/tickets";
import { PeopleList } from "@/components/app/people";
import { Users as UsersIcon } from "lucide-react";
import { BrowserFrame, ScreensTab } from "@/components/app/tabs/screens";
import { shotSrc } from "@/api/client";

const TABS = ["overview", "screens", "tasks", "usage", "users", "tickets", "docs", "releases", "files", "access", "activity"] as const;
type Tab = (typeof TABS)[number];

function Health({ appId, url }: { appId: string; url: string }) {
  const [state, setState] = React.useState<{ ok: boolean; ms: number; status: number; error?: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const check = React.useCallback(async () => { if (!url) return; setBusy(true); setState(await pingUrl(appId, url)); setBusy(false); }, [appId, url]);
  React.useEffect(() => { void check(); }, [check]);
  if (!url) return null;
  return (
    <button onClick={check} title={state?.error ?? "Check the link again"}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md transition-colors",
        busy ? "border-white/20 bg-black/30 text-white/80" : state?.ok ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-200" : "border-rose-400/30 bg-rose-500/20 text-rose-200")}>
      {busy ? <span className="size-2 animate-ping rounded-full bg-white" /> : state?.ok ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      {busy ? "Checking link…" : state?.ok ? `Reachable${state.ms ? ` · ${state.ms} ms` : ""}` : "Unreachable"}
    </button>
  );
}

export default function AppDetailPage() {
  const { id, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const run = useRun();
  const confirm = useConfirm();
  const { data: app, isLoading, error } = useApp(id);
  const [editing, setEditing] = React.useState(false);
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "overview";
  const setTab = (t: Tab) => navigate(`/apps/${id}${t === "overview" ? "" : `/${t}`}`, { replace: true });
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 300], [0, 90]);
  const heroScale = useTransform(scrollY, [0, 300], [1, 1.12]);

  if (isLoading) return <div className="grid gap-4"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-12 w-2/3 rounded-2xl" /><Skeleton className="h-96 rounded-3xl" /></div>;
  if (error || !app) return <EmptyState icon={<Lock />} title="Can't open this application" text={(error as Error)?.message ?? "It may have been deleted, or you don't have access."} action={<Button variant="secondary" onClick={() => navigate("/apps")}><ArrowLeft />Back to applications</Button>} />;

  const canEdit = app.permission === "edit";
  const color = toneHex(app.tone);

  async function remove() {
    if (!app) return;
    if (!(await confirm({ title: `Delete ${app.name}?`, message: "This removes the application with all its tasks, usage, documents, releases and files. The audit log keeps a record.", confirm: "Delete application", danger: true }))) return;
    if (await run("apps.delete", { id: app.id }, { success: `${app.name} deleted` })) navigate("/apps");
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to="/apps" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Applications</Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-border shadow-2xl">
        <motion.img layoutId={`cover-${app.id}`} src={coverFor(app, 1600, 700)} alt="" style={{ y: heroY, scale: heroScale }} className={cn("absolute inset-0 size-full object-cover object-top", app.coverShot && "scale-110 blur-md")} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent,rgb(0_0_0/0.4))]" />
        {app.coverShot && (
          <motion.button onClick={() => setTab("screens")} aria-label="Open screenshots"
            initial={{ opacity: 0, x: 60, rotateY: -25 }} animate={{ opacity: 1, x: 0, rotateY: -14 }} whileHover={{ rotateY: -4, scale: 1.03 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}
            style={{ transformPerspective: 1400 }} className="absolute right-8 top-8 hidden w-[38%] max-w-xl origin-right xl:block">
            <BrowserFrame src={shotSrc(app.coverShot.id)} url={app.url} />
            {app.screenshots.length > 1 && <span className="absolute -bottom-3 left-4 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-[11px] text-white backdrop-blur-md">+{app.screenshots.length - 1} more screens</span>}
          </motion.button>
        )}
        <div className={cn("relative flex flex-col gap-6 p-6 pt-24 text-white md:flex-row md:items-end md:p-8 md:pt-32", app.coverShot && "xl:pt-[22rem]")}>
          <div className="min-w-0 flex-1">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="dark mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={app.status} className="backdrop-blur-md" />
              {app.version && <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md"><Tag className="size-3" />v{app.version}</span>}
              {app.visibility === "restricted" && <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] backdrop-blur-md"><Lock className="size-3" />Restricted</span>}
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] backdrop-blur-md">{canEdit ? "You can edit" : "View only"}</span>
              <Health appId={app.id} url={app.url} />
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-4 text-4xl font-bold tracking-tight md:text-5xl">{app.logo && <AppLogo app={app} className="size-14 rounded-2xl md:size-16" />}{app.name}</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-2 max-w-2xl text-white/75">{app.tagline || app.description}</motion.p>
            <div className="mt-4 flex flex-wrap gap-1.5">{app.techStack.map((t) => <Chip key={t} className="border-white/15 bg-white/10 text-white/80 backdrop-blur-md">{t}</Chip>)}</div>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <div className="flex items-center gap-5 rounded-3xl border border-white/15 bg-white/10 px-5 py-3 backdrop-blur-xl">
              <ProgressRing value={app.progress} size={64} stroke={6} color={color} />
              <div className="text-sm"><div className="font-semibold">{app.tasksDone}/{app.tasksTotal} tasks</div><div className="text-white/65">{fmtNumber(app.usage.sessions30)} sessions · 30d</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="lg" disabled={!app.url} onClick={() => openApp(app)} title={app.url || "Set a link in Edit"}><ExternalLink />{app.url ? "Open app" : "No link yet"}</Button>
              {app.environments.map((e) => <Button key={e.url} variant="overlay" size="lg" onClick={() => openApp(app, e.url)}><Globe />{e.label || "Link"}</Button>)}
              <Button variant="overlay" size="lg" onClick={() => run("apps.favorite", { id: app.id })} className={cn(app.favorite && "!text-amber-300")} title={app.favorite ? "Unpin" : "Pin to sidebar"} aria-label="Pin"><Star className={cn(app.favorite && "fill-current")} /></Button>
              {canEdit && <Button variant="overlay" size="lg" onClick={() => setEditing(true)}><Edit3 />Edit</Button>}
              {canEdit && me.role !== "viewer" && <Button variant="overlay" size="lg" onClick={remove} className="!text-rose-300 hover:!bg-rose-500/30" title="Delete application" aria-label="Delete"><Trash2 /></Button>}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-[5.5rem] z-20">
        <Tabs id="app-tabs" value={tab} onChange={setTab} className="glass max-w-full !bg-[color-mix(in_oklab,var(--background)_85%,transparent)]" tabs={[
          { value: "overview", label: "Overview", icon: <LayoutDashboard /> },
          { value: "screens", label: "Screens", icon: <Camera />, count: app.screenshots.length },
          { value: "tasks", label: "Tasks", icon: <CheckSquare />, count: app.tasksTotal - app.tasksDone },
          { value: "usage", label: "Usage", icon: <Activity /> },
          { value: "users", label: "Users", icon: <UsersIcon />, count: app.people?.listed || undefined },
          { value: "tickets", label: "Tickets", icon: <Ticket />, count: app.tickets?.open },
          { value: "docs", label: "Docs & manual", icon: <BookOpen />, count: app.docs.length + (app.attachments.some((f) => / – User manual\.pdf$/.test(f.name)) ? 1 : 0) },
          { value: "releases", label: "Releases", icon: <Rocket />, count: app.releases.length },
          { value: "files", label: "Files", icon: <FileBox />, count: app.attachments.length },
          { value: "access", label: "Access", icon: <Shield /> },
          { value: "activity", label: "Activity", icon: <Activity /> },
        ]} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: 24, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -24, filter: "blur(4px)" }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          {tab === "overview" && <OverviewTab app={app} onTab={setTab} />}
          {tab === "screens" && <ScreensTab app={app} />}
          {tab === "tasks" && <TasksTab app={app} />}
          {tab === "usage" && <UsageTab app={app} />}
          {tab === "users" && <PeopleList app={app} />}
          {tab === "tickets" && <TicketsTab app={app} />}
          {tab === "docs" && <DocsTab app={app} />}
          {tab === "releases" && <ReleasesTab app={app} />}
          {tab === "files" && <FilesTab app={app} />}
          {tab === "access" && <AccessTab app={app} />}
          {tab === "activity" && <ActivityTab app={app} />}
        </motion.div>
      </AnimatePresence>

      <AppFormModal open={editing} onClose={() => setEditing(false)} app={app} />
    </div>
  );
}
