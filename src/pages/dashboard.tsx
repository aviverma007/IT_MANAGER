import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlarmClock, AppWindow, ArrowDownRight, ArrowRight, ArrowUpRight, CheckSquare, ExternalLink, Gauge, Rocket, Users } from "lucide-react";
import { useApps, useDashboard } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import PictureRailGallery, { type PictureRailItem } from "@/components/ui/picture-rail-gallery";
import { AnimatedNumber, GlassCard, PriorityDot, ProgressRing, SectionTitle, Skeleton, Sparkline, StatusBadge, TiltCard } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/app/activity";
import { coverFor } from "@/lib/covers";
import { cn, fmtDate, fmtNumber, STATUS_HEX, STATUS_META, toneHex } from "@/lib/utils";
import { openApp } from "@/lib/launch";

const FRAMES = ["black", "oak", "white"] as const;


function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 24, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 220, damping: 22 } } };

export default function DashboardPage() {
  const me = useMe();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboard();
  const { data: apps } = useApps();
  const [active, setActive] = React.useState<number | null>(null);

  const wall = React.useMemo(() => {
    const list = [...(apps ?? [])].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.usage.sessions30 - a.usage.sessions30 || b.progress - a.progress).slice(0, 8);
    const prints: PictureRailItem[] = list.map((a, i) => ({
      id: a.id, title: a.name, artist: a.ownerName || a.department, year: a.version ? `v${a.version}` : STATUS_META[a.status].label,
      image: coverFor(a, 800, 1000), aspect: a.coverShot ? Math.min(1.9, Math.max(0.55, a.coverShot.width / a.coverShot.height)) : i % 3 === 1 ? 1 : 0.8, frame: FRAMES[i % 3], mat: i % 2 === 0, drop: [0.04, 0.12, -0.02, 0.16, 0.06, 0, 0.1, 0.03][i] ?? 0,
      tag: `${a.progress}%`, details: [STATUS_META[a.status].label, a.category, `${a.tasksDone}/${a.tasksTotal} tasks done`, `${fmtNumber(a.usage.sessions30)} sessions · 30 days`],
    }));
    return { list, prints };
  }, [apps]);

  const t = stats?.totals;
  const trendUp = (t?.trend ?? 0) >= 0;
  const spark = stats?.usageSeries.map((s) => s.sessions) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}, {me.name.split(" ")[0]} 👋</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Portfolio <span className="text-gradient">overview</span></h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/apps")}><AppWindow />All applications</Button>
          <Button variant="secondary" onClick={() => navigate("/logs")}><Activity />Audit log</Button>
        </div>
      </motion.div>

      {/* KPI cards */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !t ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36 rounded-3xl" />) : (
          <>
            <motion.div variants={item}>
              <TiltCard className="h-full p-5">
                <div className="flex items-start justify-between"><span className="text-sm text-muted-foreground">Applications</span><span className="emboss grid size-9 place-items-center rounded-xl text-chart-1"><AppWindow className="size-4" /></span></div>
                <div className="mt-3 text-4xl font-bold tracking-tight"><AnimatedNumber value={t.apps} /></div>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground"><span><b className="text-emerald-500">{t.live}</b> live</span><span><b className="text-violet-400">{t.inProgress}</b> in progress</span></div>
              </TiltCard>
            </motion.div>
            <motion.div variants={item}>
              <TiltCard className="h-full p-5">
                <div className="flex items-start justify-between"><span className="text-sm text-muted-foreground">Average progress</span><span className="emboss grid size-9 place-items-center rounded-xl text-chart-3"><Gauge className="size-4" /></span></div>
                <div className="mt-2 flex items-center gap-4">
                  <ProgressRing value={t.avgProgress} size={72} stroke={7} color="var(--chart-3)" />
                  <div className="text-xs text-muted-foreground"><div><b className="text-foreground">{t.tasksOpen}</b> open tasks</div><div className={cn(t.overdue && "text-rose-400")}><b>{t.overdue}</b> overdue</div></div>
                </div>
              </TiltCard>
            </motion.div>
            <motion.div variants={item}>
              <TiltCard className="h-full p-5">
                <div className="flex items-start justify-between"><span className="text-sm text-muted-foreground">Sessions · 30 days</span><span className="emboss grid size-9 place-items-center rounded-xl text-chart-2"><Activity className="size-4" /></span></div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="text-4xl font-bold tracking-tight"><AnimatedNumber value={t.sessions30} /></div>
                  <Sparkline data={spark.slice(-14)} width={90} height={36} />
                </div>
                <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-500" : "text-rose-400")}>
                  {trendUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(t.trend)}% vs previous 30 days
                </div>
              </TiltCard>
            </motion.div>
            <motion.div variants={item}>
              <TiltCard className="h-full p-5">
                <div className="flex items-start justify-between"><span className="text-sm text-muted-foreground">Team</span><span className="emboss grid size-9 place-items-center rounded-xl text-chart-4"><Users className="size-4" /></span></div>
                <div className="mt-3 text-4xl font-bold tracking-tight"><AnimatedNumber value={t.users} /></div>
                <Link to="/team" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Meet the team <ArrowRight className="size-3" /></Link>
              </TiltCard>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* App wall */}
      {wall.prints.length > 0 && (
        <GlassCard className="overflow-hidden">
          <PictureRailGallery
            items={wall.prints}
            eyebrow="App wall · your top applications"
            heading="Brush the rail to light an app, click to lift it."
            caption="Pinned and most-used applications hang here. Drag a frame to slide it along the rail."
            autoplay
            interval={3200}
            onActiveChange={setActive}
            className="!bg-transparent"
            labels={{ front: "Front", back: "Back", close: "Close", open: "Click to lift" }}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" disabled={active === null} onClick={() => active !== null && navigate(`/apps/${wall.list[active]!.id}`)}><ArrowRight />Open app page</Button>
                <Button variant="secondary" size="sm" disabled={active === null || !wall.list[active]?.url} onClick={() => active !== null && openApp(wall.list[active]!)}><ExternalLink />Launch</Button>
              </div>
            }
          />
        </GlassCard>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-5 xl:col-span-2">
          <SectionTitle title="Usage trend" sub="Sessions logged across all applications, plus launches from IT Manager" icon={<Activity />} />
          <div className="h-72">
            {stats ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.usageSeries} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.5} /><stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gU" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--chart-2)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 }} labelFormatter={(d) => fmtDate(String(d))} />
                  <Area type="monotone" dataKey="sessions" name="Sessions" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#gS)" animationDuration={1400} />
                  <Area type="monotone" dataKey="activeUsers" name="Active users" stroke="var(--chart-2)" strokeWidth={2} fill="url(#gU)" animationDuration={1600} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Skeleton className="h-full" />}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="By status" sub="Where every application stands" icon={<Rocket />} />
          {stats && (
            <div className="flex flex-col items-center">
              <div className="relative h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.byStatus} dataKey="count" nameKey="status" innerRadius={58} outerRadius={84} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1200}>
                      {stats.byStatus.map((s) => <Cell key={s.status} fill={STATUS_HEX[s.status]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 }} formatter={(v, n) => [v, STATUS_META[n as keyof typeof STATUS_META]?.label ?? n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-3xl font-bold">{t?.apps}</div><div className="text-[11px] text-muted-foreground">apps</div></div></div>
              </div>
              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                {stats.byStatus.map((s) => (
                  <Link key={s.status} to={`/apps?status=${s.status}`} className="flex items-center justify-between rounded-xl px-2 py-1 text-xs hover:bg-muted/60">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: STATUS_HEX[s.status] }} />{STATUS_META[s.status].label}</span><b>{s.count}</b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard className="p-5">
          <SectionTitle title="Most used" sub="Sessions in the last 30 days" icon={<Activity />} />
          <div className="flex flex-col gap-3">
            {stats?.topApps.map((a, i) => {
              const max = Math.max(1, stats.topApps[0]?.sessions ?? 1);
              return (
                <Link key={a.id} to={`/apps/${a.id}/usage`} className="group">
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium group-hover:underline">{a.name}</span><span className="tabular-nums text-muted-foreground">{fmtNumber(a.sessions)}</span></div>
                  <div className="deboss h-2.5 overflow-hidden rounded-full">
                    <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${toneHex(a.tone)}aa, ${toneHex(a.tone)})`, boxShadow: `0 0 10px ${toneHex(a.tone)}` }}
                      initial={{ width: 0 }} animate={{ width: `${(a.sessions / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.08, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </Link>
              );
            })}
            {stats && !stats.topApps.some((a) => a.sessions) && <p className="text-sm text-muted-foreground">No usage logged yet. Add entries in an app's Usage tab.</p>}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Due in the next 2 weeks" sub="Open tasks with a due date" icon={<AlarmClock />} />
          <div className="flex flex-col gap-1">
            {stats?.dueSoon.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing due. 🎉</p>}
            {stats?.dueSoon.map((task, i) => {
              const overdue = task.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <motion.div key={task.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/apps/${task.appId}/tasks`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                    <CheckSquare className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{task.title}</div><div className="truncate text-xs text-muted-foreground">{task.appName}{task.assignee && ` · ${task.assignee}`}</div></div>
                    <PriorityDot priority={task.priority} />
                    <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium", overdue ? "bg-rose-500/15 text-rose-400" : "bg-muted text-muted-foreground")}>{fmtDate(task.dueDate, { day: "numeric", month: "short" })}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Recent activity" action={<Link to="/logs" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>} icon={<Activity />} />
          <div className="max-h-80 overflow-y-auto pr-1"><ActivityFeed items={stats?.recent ?? []} /></div>
        </GlassCard>
      </div>

      {apps && apps.some((a) => a.favorite) && (
        <div>
          <SectionTitle title="Quick launch" sub="Your pinned applications" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {apps.filter((a) => a.favorite).map((a) => (
              <motion.button key={a.id} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => (a.url ? openApp(a) : navigate(`/apps/${a.id}`))} className="glass flex items-center gap-3 rounded-2xl p-3 text-left">
                <img src={coverFor(a, 120, 120)} alt="" className="h-11 w-16 rounded-xl border border-border object-cover object-top" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{a.name}</div><StatusBadge status={a.status} className="mt-1" /></div>
                {a.url ? <ExternalLink className="size-4 text-muted-foreground" /> : <ArrowRight className="size-4 text-muted-foreground" />}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
