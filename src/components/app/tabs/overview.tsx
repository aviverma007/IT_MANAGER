import { motion } from "motion/react";
import { ArrowRight, BookOpen, Calendar, Clock, Rocket, User, Users } from "lucide-react";
import type { AppDetail } from "@/core/types";
import { AnimatedNumber, GlassCard, PriorityDot, ProgressBar, SectionTitle, Sparkline } from "@/components/ui/bits";
import { ActivityFeed } from "@/components/app/activity";
import { Button } from "@/components/ui/button";
import { cn, fmtDate, fmtNumber, timeAgo, toneHex } from "@/lib/utils";
import { shotSrc } from "@/api/client";
import { Camera } from "lucide-react";

type TabName = "screens" | "tasks" | "usage" | "docs" | "releases" | "activity";

export function OverviewTab({ app, onTab }: { app: AppDetail; onTab: (t: TabName) => void }) {
  const color = toneHex(app.tone);
  const facts = [
    { icon: User, label: "Owner", value: app.ownerName || "—" },
    { icon: Users, label: "Department", value: app.department || "—" },
    { icon: Calendar, label: "Started", value: fmtDate(app.startDate) },
    { icon: Rocket, label: "Go-live", value: fmtDate(app.goLiveDate) },
    { icon: Clock, label: "Last updated", value: timeAgo(app.updatedAt) },
    { icon: BookOpen, label: "Category", value: app.category || "—" },
  ];
  const groups = app.groups.map((g) => {
    const tasks = app.tasks.filter((t) => t.groupId === g.id);
    const done = tasks.filter((t) => t.done).length;
    return { ...g, done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
  });
  const next = app.tasks.filter((t) => !t.done).sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).slice(0, 5);
  const manual = app.docs.find((d) => d.kind === "manual");
  const latest = app.releases[0];

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="flex flex-col gap-5 xl:col-span-2">
        <GlassCard className="p-6">
          <SectionTitle title="About" />
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{app.description || "No description yet — add one with Edit."}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {facts.map((f, i) => (
              <motion.div key={f.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="deboss rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><f.icon className="size-3.5" />{f.label}</div>
                <div className="mt-1 truncate text-sm font-medium">{f.value}</div>
              </motion.div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Screens" sub={app.screenshots.length ? `${app.screenshots.length} real screenshot${app.screenshots.length > 1 ? "s" : ""}` : "No screenshots yet"} icon={<Camera />} action={<Button size="sm" variant="ghost" onClick={() => onTab("screens")}>{app.screenshots.length ? "Gallery" : "Add"} <ArrowRight /></Button>} />
          {app.screenshots.length ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {app.screenshots.slice(0, 6).map((s, i) => (
                <motion.button key={s.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -4, scale: 1.02 }} onClick={() => onTab("screens")}
                  className="w-56 shrink-0 overflow-hidden rounded-xl border border-border text-left shadow-lg">
                  <img src={shotSrc(s.id)} alt={s.caption} className="aspect-[16/10] w-full object-cover object-top" />
                  <div className="truncate px-2.5 py-1.5 text-xs text-muted-foreground">{s.caption || "Screen"}</div>
                </motion.button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Upload, paste or capture the real screens of {app.name} in the Screens tab.</p>}
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Progress by heading" sub={`${app.tasksDone} of ${app.tasksTotal} tasks complete`} action={<Button size="sm" variant="ghost" onClick={() => onTab("tasks")}>Open checklist <ArrowRight /></Button>} />
          <div className="flex flex-col gap-4">
            {groups.length === 0 && <p className="text-sm text-muted-foreground">No headings yet.</p>}
            {groups.map((g) => (
              <div key={g.id}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{g.title}</span><span className="tabular-nums text-muted-foreground">{g.done}/{g.total} · {g.pct}%</span></div>
                <ProgressBar value={g.pct} color={g.pct === 100 ? "var(--chart-3)" : color} />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Up next" sub="Open tasks, earliest due first" />
          {next.length === 0 ? <p className="text-sm text-muted-foreground">All tasks are done. 🎉</p> : (
            <ul className="divide-y divide-border">
              {next.map((t) => {
                const overdue = t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <PriorityDot priority={t.priority} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {t.assignee && <span className="text-xs text-muted-foreground">{t.assignee}</span>}
                    <span className={cn("text-xs", overdue ? "text-rose-400" : "text-muted-foreground")}>{t.dueDate ? fmtDate(t.dueDate, { day: "numeric", month: "short" }) : "No date"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>

      <div className="flex flex-col gap-5">
        <GlassCard className="p-6">
          <SectionTitle title="Usage · 30 days" action={<Button size="sm" variant="ghost" onClick={() => onTab("usage")}>Details <ArrowRight /></Button>} />
          <div className="grid grid-cols-2 gap-3">
            {[["Sessions", app.usage.sessions30], ["Active users", app.usage.activeUsers], ["Transactions", app.usage.transactions30], ["Launches", app.usage.launches30]].map(([l, v]) => (
              <div key={l as string} className="deboss rounded-2xl p-3"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div><div className="text-2xl font-bold"><AnimatedNumber value={v as number} format={(n) => fmtNumber(Math.round(n))} /></div></div>
            ))}
          </div>
          <Sparkline data={app.usage.spark} color={color} width={320} height={60} className="mt-4 w-full" />
          <p className={cn("mt-1 text-xs", app.usage.trend >= 0 ? "text-emerald-500" : "text-rose-400")}>{app.usage.trend >= 0 ? "▲" : "▼"} {Math.abs(app.usage.trend)}% vs previous 30 days</p>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Documentation" action={<Button size="sm" variant="ghost" onClick={() => onTab("docs")}>Open <ArrowRight /></Button>} />
          {manual ? (
            <button onClick={() => onTab("docs")} className="emboss w-full rounded-2xl border border-border p-4 text-left">
              <div className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-primary" />{manual.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">Updated {timeAgo(manual.updatedAt)} by {manual.updatedBy}</div>
            </button>
          ) : <p className="text-sm text-muted-foreground">No user manual yet.</p>}
          <p className="mt-3 text-xs text-muted-foreground">{app.docs.length} document{app.docs.length === 1 ? "" : "s"} · {app.attachments.length} file{app.attachments.length === 1 ? "" : "s"}</p>
        </GlassCard>

        {latest && (
          <GlassCard className="p-6">
            <SectionTitle title="Latest release" action={<Button size="sm" variant="ghost" onClick={() => onTab("releases")}>All <ArrowRight /></Button>} />
            <div className="text-2xl font-bold" style={{ color }}>v{latest.version}</div>
            <div className="text-sm">{latest.title}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(latest.date)}</div>
          </GlassCard>
        )}

        <GlassCard className="p-6">
          <SectionTitle title="Recent activity" action={<Button size="sm" variant="ghost" onClick={() => onTab("activity")}>All <ArrowRight /></Button>} />
          <ActivityFeed items={app.activity.slice(0, 6)} showApp={false} />
        </GlassCard>
      </div>
    </div>
  );
}
