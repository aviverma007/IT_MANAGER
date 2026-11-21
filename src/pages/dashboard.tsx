import * as React from "react";
import { useOpenPeople } from "@/components/app/people";
import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlarmClock, AlertTriangle, AppWindow, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CheckSquare, ExternalLink, Gauge, Radio, Rocket, Ticket as TicketIcon, Users } from "lucide-react";
import { useApps, useDashboard } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import PictureRailGallery, { type PictureRailItem } from "@/components/ui/picture-rail-gallery";
import { AnimatedNumber, GlassCard, PriorityDot, ProgressRing, SectionTitle, Skeleton, StatusBadge, Tabs } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/app/activity";
import { coverFor } from "@/lib/covers";
import { cn, fmtDate, fmtNumber, STATUS_HEX, STATUS_META, timeAgo, toneHex } from "@/lib/utils";
import { openApp } from "@/lib/launch";

import type { AppSummary, DashboardStats } from "@/core/types";


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

  // Every application on one rail, grouped by category (real screenshots first inside each category).
  const wallApps = React.useMemo(() => {
    const groups = new Map<string, AppSummary[]>();
    for (const a of apps ?? []) groups.set(a.category || "Other", [...(groups.get(a.category || "Other") ?? []), a]);
    const ordered = [...groups.entries()].sort((x, y) => Number(y[1].some((a) => a.favorite)) - Number(x[1].some((a) => a.favorite)) || y[1].length - x[1].length || x[0].localeCompare(y[0]));
    return ordered.flatMap(([, list]) => [...list].sort((a, b) => Number(!!b.coverShot || !!b.cover) - Number(!!a.coverShot || !!a.cover) || Number(b.favorite) - Number(a.favorite) || b.usage.sessions30 - a.usage.sessions30 || a.name.localeCompare(b.name)));
  }, [apps]);

  const t = stats?.totals;
  return (
    <div className="flex flex-col gap-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}, {me.name.split(" ")[0]} 👋</p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Portfolio <span className="text-gradient">overview</span></h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/apps")}><AppWindow />All applications</Button>
          <Button variant="secondary" onClick={() => navigate("/tickets")}><TicketIcon />Tickets</Button>
        </div>
      </motion.div>

      {isLoading || !stats || !t ? (
        <div className="grid gap-4 xl:grid-cols-12">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={cn("h-48 rounded-3xl", i < 4 ? "xl:col-span-2" : "xl:col-span-4")} />)}</div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-4">
          {/* Row 1 — KPIs + live app ticker */}
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="grid gap-4 sm:grid-cols-2 xl:col-span-8">
              <KpiApps t={t} stats={stats} />
              <KpiUsers stats={stats} />
              <KpiTickets stats={stats} />
              <KpiSeats stats={stats} />
            </div>
            <motion.div variants={item} className="xl:col-span-4"><AppTicker apps={apps ?? []} /></motion.div>
          </div>

          {/* Row 2 — usage by application + issues */}
          <div className="grid gap-4 xl:grid-cols-12">
            <motion.div variants={item} className="xl:col-span-8"><UsageByApp stats={stats} /></motion.div>
            <motion.div variants={item} className="xl:col-span-4"><IssuesCard stats={stats} /></motion.div>
          </div>

          {/* Row 3 — seats, calendar, workload */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <motion.div variants={item}><SeatsCard stats={stats} /></motion.div>
            <motion.div variants={item}><CalendarCard stats={stats} /></motion.div>
            <motion.div variants={item}><WorkloadCard stats={stats} /></motion.div>
          </div>

          {/* Row 4 — mix, due soon, activity */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <motion.div variants={item}><MixCard stats={stats} /></motion.div>
            <motion.div variants={item}><DueSoonCard stats={stats} /></motion.div>
            <motion.div variants={item}>
              <Bento className="h-full">
                <BentoHead icon={<Activity />} title="Recent activity" action={<Link to="/logs" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>} />
                <div className="max-h-80 overflow-y-auto pr-1"><ActivityFeed items={stats.recent} /></div>
              </Bento>
            </motion.div>
          </div>
        </motion.div>
      )}

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

      {/* App wall — every application on one rail */}
      {wallApps.length > 0 && <WallRail list={wallApps} />}
    </div>
  );
}

/* ================================================================ bento pieces ================================================================ */

const TINT = { lime: "#a3e635", pink: "#f472b6", yellow: "#facc15", sky: "#38bdf8", violet: "#a78bfa", mint: "#34d399", rose: "#fb7185" } as const;
const tint = (c: string, strong = 32, soft = 10) => ({ background: `linear-gradient(140deg, color-mix(in oklab, ${c} ${strong}%, var(--card)), color-mix(in oklab, ${c} ${soft}%, var(--card)) 70%)` });
const TT = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12 } as const;

function Bento({ className, style, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn("relative flex flex-col overflow-hidden rounded-3xl border border-white/40 p-5 shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_18px_40px_-24px_rgb(0_0_0/0.35)] backdrop-blur-xl dark:border-white/10 bg-card/70", className)}
      style={style} {...(rest as object)}>{children}</motion.div>
  );
}
function BentoHead({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-background/70 text-foreground shadow-sm [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold leading-tight">{title}</span>{sub && <span className="block text-xs text-muted-foreground">{sub}</span>}</span>
      {action}
    </div>
  );
}
function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-medium shadow-sm", className)}>{children}</span>;
}
function Big({ value, suffix = "" }: { value: number; suffix?: string }) {
  return <div className="text-4xl font-bold tracking-tight tabular-nums"><AnimatedNumber value={value} format={(n) => fmtNumber(Math.round(n)) + suffix} /></div>;
}

function KpiApps({ t, stats }: { t: DashboardStats["totals"]; stats: DashboardStats }) {
  const total = Math.max(1, t.apps);
  return (
    <motion.div variants={item}>
      <Bento className="h-full" style={tint(TINT.lime, 40, 14)}>
        <BentoHead icon={<AppWindow />} title="Applications" action={<Link to="/apps"><Pill>View all <ArrowUpRight className="size-3" /></Pill></Link>} />
        <div className="flex items-end justify-between gap-3">
          <Big value={t.apps} />
          <div className="flex gap-1.5 pb-1"><Pill><span className="size-1.5 rounded-full bg-emerald-500" />{t.live} live</Pill><Pill><span className="size-1.5 rounded-full bg-violet-500" />{t.inProgress} in progress</Pill></div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>In-house <b className="text-foreground">{stats.mix.inHouse}</b></span><span>Vendor <b className="text-foreground">{stats.mix.vendor}</b></span></div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-background/60">
            <motion.span className="h-full bg-gradient-to-r from-violet-500 to-indigo-500" initial={{ width: 0 }} animate={{ width: `${(stats.mix.inHouse / total) * 100}%` }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
            <motion.span className="h-full bg-gradient-to-r from-sky-400 to-cyan-500" initial={{ width: 0 }} animate={{ width: `${(stats.mix.vendor / total) * 100}%` }} transition={{ duration: 1.1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </div>
      </Bento>
    </motion.div>
  );
}

function KpiUsers({ stats }: { stats: DashboardStats }) {
  const series = stats.usageSeries.map((d) => d.activeUsers);
  const trendUp = stats.totals.trend >= 0;
  return (
    <motion.div variants={item}>
      <Bento className="h-full" style={tint(TINT.sky, 26, 8)}>
        <BentoHead icon={<Users />} title="Active users" sub="Across all applications" action={<Pill className={trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}>{trendUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(stats.totals.trend)}% sessions</Pill>} />
        <div className="flex items-end justify-between gap-3">
          <Big value={stats.seats.active} />
          <div className="h-14 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs><linearGradient id="kU" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" stopOpacity={0.45} /><stop offset="1" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient></defs>
                <Area type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={2} fill="url(#kU)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Pill><b>{fmtNumber(stats.totals.sessions30)}</b> sessions · 30d</Pill>
          {stats.people.seen30 > 0 && <Pill><span className="size-1.5 rounded-full bg-emerald-500" /><b>{fmtNumber(stats.people.seen30)}</b> people seen by tracking</Pill>}
        </div>
      </Bento>
    </motion.div>
  );
}

function KpiTickets({ stats }: { stats: DashboardStats }) {
  const tk = stats.tickets;
  const max = Math.max(1, ...tk.perDay.map((d) => Math.max(d.created, d.closed)));
  const diff = tk.prevCreated30 ? Math.round(((tk.created30 - tk.prevCreated30) / tk.prevCreated30) * 100) : 0;
  return (
    <motion.div variants={item}>
      <Bento className="h-full" style={tint(TINT.pink, 30, 9)}>
        <BentoHead icon={<TicketIcon />} title="Open tickets" sub={tk.lastSync ? `ServiceDesk synced ${timeAgo(tk.lastSync)}` : "Helpdesk"} action={<Link to="/tickets"><Pill>Open <ArrowUpRight className="size-3" /></Pill></Link>} />
        <div className="flex items-end justify-between gap-3">
          <div><Big value={tk.open} />{tk.high > 0 && <div className="text-xs font-semibold text-rose-500">{tk.high} high / urgent</div>}</div>
          <div className="flex h-14 items-end gap-[3px]" title="Raised (pink) vs closed (green), last 14 days">
            {tk.perDay.map((d, i) => (
              <span key={d.date} className="flex flex-col justify-end gap-[2px]">
                <motion.span className="w-[7px] rounded-full bg-pink-500/80" initial={{ height: 0 }} animate={{ height: `${Math.max(2, (d.created / max) * 50)}px` }} transition={{ delay: 0.2 + i * 0.03, duration: 0.6 }} />
                <motion.span className="w-[7px] rounded-full bg-emerald-500/70" initial={{ height: 0 }} animate={{ height: `${Math.max(2, (d.closed / max) * 50) * 0.5}px` }} transition={{ delay: 0.3 + i * 0.03, duration: 0.6 }} />
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Pill><b>{fmtNumber(tk.created30)}</b> raised · 30d {diff !== 0 && <span className={diff > 0 ? "text-rose-500" : "text-emerald-600"}>{diff > 0 ? "↑" : "↓"}{Math.abs(diff)}%</span>}</Pill>
          <Pill><b>{fmtNumber(tk.closed30)}</b> closed</Pill>
          {tk.unmatched > 0 && <Pill className="text-muted-foreground">{tk.unmatched} untagged</Pill>}
        </div>
      </Bento>
    </motion.div>
  );
}

function KpiSeats({ stats }: { stats: DashboardStats }) {
  const u = stats.seats.util;
  const color = u === null ? "#a1a1aa" : u >= 85 ? "#10b981" : u >= 60 ? "#3b82f6" : u >= 45 ? "#f59e0b" : "#f43f5e";
  return (
    <motion.div variants={item}>
      <Bento className="h-full" style={tint(TINT.yellow, 34, 10)}>
        <BentoHead icon={<Gauge />} title="Licence seats used" sub="Active users ÷ licensed seats" />
        <div className="flex items-center justify-between gap-3">
          <div><Big value={u ?? 0} suffix="%" /><div className="text-xs text-muted-foreground">{fmtNumber(stats.seats.active)} of {fmtNumber(stats.seats.seats)} seats</div></div>
          <ProgressRing value={Math.min(100, u ?? 0)} size={76} stroke={8} color={color} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          <Pill className={stats.seats.under.length ? "text-amber-700 dark:text-amber-300" : ""}><b>{stats.seats.under.length}</b> under-used apps</Pill>
          <Pill><b>{fmtNumber(Math.max(0, stats.seats.seats - stats.seats.active))}</b> spare seats</Pill>
        </div>
      </Bento>
    </motion.div>
  );
}

/** Top-right: applications scrolling past forever (pauses on hover). */
function AppTicker({ apps }: { apps: AppSummary[] }) {
  const navigate = useNavigate();
  const list = React.useMemo(() => [...apps].sort((a, b) => b.landscape.activeUsers - a.landscape.activeUsers), [apps]);
  if (!list.length) return null;
  const loop = [...list, ...list];
  const seconds = Math.max(20, list.length * 2.6);
  return (
    <Bento className="h-[26rem] !p-0 xl:h-full xl:min-h-[24rem]" style={tint(TINT.violet, 22, 6)}>
      <div className="p-5 pb-2"><BentoHead icon={<Radio />} title="Live applications" sub={`${list.length} apps · busiest first · hover to pause`} action={<Link to="/apps"><Pill>All <ArrowUpRight className="size-3" /></Pill></Link>} /></div>
      <div className="group/ticker relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
        <div className="absolute inset-x-0 top-0 flex flex-col gap-2 px-4 pb-2 group-hover/ticker:[animation-play-state:paused]" style={{ animation: `itm-ticker ${seconds}s linear infinite` }}>
          {loop.map((a, i) => {
            const u = a.landscape.utilization;
            return (
              <button key={`${a.id}-${i}`} onClick={() => navigate(`/apps/${a.id}`)} className="flex items-center gap-3 rounded-2xl bg-background/70 p-2.5 text-left shadow-sm transition-transform hover:scale-[1.02]">
                <img src={coverFor(a, 120, 120)} alt="" className="size-10 shrink-0 rounded-xl border border-border object-cover object-top" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-sm font-semibold"><span className="size-1.5 shrink-0 rounded-full" style={{ background: STATUS_HEX[a.status] }} />{a.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{fmtNumber(a.landscape.activeUsers)}{a.seats ? ` / ${fmtNumber(a.seats)}` : ""} users{a.tickets?.open ? ` · ${a.tickets.open} open tickets` : ""}</span>
                </span>
                <span className="text-right text-xs font-bold tabular-nums" style={{ color: u === null ? "var(--muted-foreground)" : u >= 85 ? "#10b981" : u >= 60 ? "#3b82f6" : u >= 45 ? "#f59e0b" : "#f43f5e" }}>{u === null ? "—" : `${u}%`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Bento>
  );
}

function UsageByApp({ stats }: { stats: DashboardStats }) {
  const [metric, setMetric] = React.useState<"sessions" | "users">("sessions");
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const series = stats.appSeries.filter((s) => s.sessions.some(Boolean) || s.users.some(Boolean));
  const data = stats.usageSeries.map((d, i) => ({ date: d.date, ...Object.fromEntries(series.map((s) => [s.id, (metric === "sessions" ? s.sessions : s.users)[i] ?? 0])) }));
  const total = series.reduce((n, s) => n + (metric === "sessions" ? s.sessions : s.users).reduce((a, b) => a + b, 0), 0);
  return (
    <Bento className="h-full">
      <BentoHead icon={<Activity />} title="Usage by application" sub={`${metric === "sessions" ? "Sessions" : "Active users"} per day · last 30 days · busiest ${series.length} apps`}
        action={<Tabs id="dash-usage-metric" value={metric} onChange={setMetric} tabs={[{ value: "sessions", label: "Sessions" }, { value: "users", label: "Users" }]} />} />
      <div className="mb-2 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.id);
          const sum = (metric === "sessions" ? s.sessions : s.users).reduce((a, b) => a + b, 0);
          return (
            <button key={s.id} onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-opacity", off ? "border-dashed opacity-40" : "border-transparent bg-muted/70")}>
              <span className="size-2 rounded-full" style={{ background: toneHex(s.tone) }} />{s.name}<b className="tabular-nums">{fmtNumber(sum)}</b>
            </button>
          );
        })}
        {!series.length && <p className="text-sm text-muted-foreground">No usage yet — install the tracking script or add usage entries in an app's Usage tab.</p>}
      </div>
      <div className="h-72 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
            <defs>{series.map((s) => <linearGradient key={s.id} id={`ua-${s.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={toneHex(s.tone)} stopOpacity={0.45} /><stop offset="1" stopColor={toneHex(s.tone)} stopOpacity={0.02} /></linearGradient>)}</defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TT} labelFormatter={(d) => fmtDate(String(d))} formatter={(v, id) => [fmtNumber(Number(v)), series.find((s) => s.id === id)?.name ?? id]} />
            {series.filter((s) => !hidden.has(s.id)).map((s, i) => (
              <Area key={s.id} type="monotone" dataKey={s.id} stackId="1" stroke={toneHex(s.tone)} strokeWidth={2} fill={`url(#ua-${s.id})`} animationDuration={1200 + i * 150} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{fmtNumber(total)} {metric === "sessions" ? "sessions" : "user-days"} in 30 days · click a name to hide / show it</p>
    </Bento>
  );
}

function IssuesCard({ stats }: { stats: DashboardStats }) {
  const tk = stats.tickets;
  const max = Math.max(1, ...tk.byApp.map((a) => a.open));
  const pc = (p: string) => (/urgent|critical|p1/i.test(p) ? "#f43f5e" : /high|p2/i.test(p) ? "#f97316" : /medium|normal/i.test(p) ? "#3b82f6" : "#a1a1aa");
  return (
    <Bento className="h-full" style={tint(TINT.rose, 16, 4)}>
      <BentoHead icon={<AlertTriangle />} title="Issues in applications" sub={`${tk.open} open helpdesk tickets${tk.high ? ` · ${tk.high} high / urgent` : ""}`} action={<Link to="/tickets"><Pill>All <ArrowUpRight className="size-3" /></Pill></Link>} />
      {tk.byApp.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {tk.byApp.slice(0, 5).map((a, i) => (
            <Link key={a.id} to={`/apps/${a.id}/tickets`} className="group grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs">
              <span className="truncate font-medium group-hover:underline">{a.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-background/60"><motion.span className="block h-full rounded-full" style={{ background: a.high ? "linear-gradient(90deg,#fb7185,#f43f5e)" : `linear-gradient(90deg, ${toneHex(a.tone)}99, ${toneHex(a.tone)})` }} initial={{ width: 0 }} animate={{ width: `${(a.open / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.06, duration: 0.8 }} /></span>
              <span className="tabular-nums"><b>{a.open}</b>{a.high ? <span className="text-rose-500"> · {a.high}↑</span> : null}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {tk.latest.map((x, i) => (
          <motion.a key={x.id} href={x.url || undefined} target="_blank" rel="noreferrer" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
            className="flex items-start gap-2 rounded-xl bg-background/60 px-2.5 py-2 text-sm hover:bg-background/90">
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: pc(x.priority), boxShadow: `0 0 8px ${pc(x.priority)}` }} />
            <span className="min-w-0 flex-1"><span className="line-clamp-1 font-medium">{x.subject}</span><span className="block truncate text-[11px] text-muted-foreground">#{x.displayId} · {x.appName || "untagged"} · {timeAgo(x.createdAt)}{x.technician ? ` · ${x.technician}` : ""}</span></span>
          </motion.a>
        ))}
        {!tk.latest.length && <p className="py-6 text-center text-sm text-muted-foreground">No open issues 🎉</p>}
      </div>
    </Bento>
  );
}

function SeatsCard({ stats }: { stats: DashboardStats }) {
  return (
    <Bento className="h-full" style={tint(TINT.yellow, 18, 5)}>
      <BentoHead icon={<Gauge />} title="Licences to review" sub="Apps using less than 60% of their seats" action={<Link to="/apps"><Pill>Landscape <ArrowUpRight className="size-3" /></Pill></Link>} />
      <div className="flex flex-col gap-2.5">
        {stats.seats.under.map((a, i) => (
          <Link key={a.id} to={`/apps/${a.id}`} className="group">
            <div className="mb-1 flex justify-between text-sm"><span className="font-medium group-hover:underline">{a.name}</span><span className="tabular-nums text-muted-foreground">{a.active} / {a.seats} · <b style={{ color: a.util < 45 ? "#f43f5e" : "#f59e0b" }}>{a.util}%</b></span></div>
            <div className="h-2 overflow-hidden rounded-full bg-background/60"><motion.div className="h-full rounded-full" style={{ background: a.util < 45 ? "#f43f5e" : "#f59e0b" }} initial={{ width: 0 }} animate={{ width: `${a.util}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.8 }} /></div>
          </Link>
        ))}
        {!stats.seats.under.length && <p className="py-6 text-center text-sm text-muted-foreground">{stats.seats.seats ? "Every app uses 60% or more of its seats. 👍" : "Set licensed seats on your apps to see this."}</p>}
      </div>
    </Bento>
  );
}

function CalendarCard({ stats }: { stats: DashboardStats }) {
  const [offset, setOffset] = React.useState(0);
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const key = (d: number) => `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayKey = today.toISOString().slice(0, 10);
  const navigate = useNavigate();
  const monthTotal = Array.from({ length: days }, (_, i) => stats.calendar[key(i + 1)] ?? 0).reduce((a, b) => a + b, 0);
  return (
    <Bento className="h-full" style={tint(TINT.lime, 16, 4)}>
      <BentoHead icon={<CalendarDays />} title="Task calendar" sub={`${monthTotal} open task${monthTotal === 1 ? "" : "s"} due in ${first.toLocaleString(undefined, { month: "long" })}`}
        action={<span className="flex gap-1"><button onClick={() => setOffset((o) => o - 1)} className="grid size-7 place-items-center rounded-full bg-background/70 hover:bg-background" aria-label="Previous month"><ChevronLeft className="size-4" /></button><button onClick={() => setOffset((o) => o + 1)} className="grid size-7 place-items-center rounded-full bg-background/70 hover:bg-background" aria-label="Next month"><ChevronRight className="size-4" /></button></span>} />
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}</div>
      <motion.div key={offset} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const k = key(i + 1);
          const n = stats.calendar[k] ?? 0;
          const isToday = k === todayKey;
          const past = k < todayKey;
          return (
            <button key={k} onClick={() => n && navigate(`/tasks?s=${past ? "overdue" : "open"}`)} title={n ? `${n} task${n === 1 ? "" : "s"} due` : undefined}
              className={cn("relative grid aspect-square place-items-center rounded-xl text-xs tabular-nums transition-colors", isToday ? "bg-foreground font-bold text-background" : n ? "bg-background/80 font-semibold hover:bg-background" : "text-muted-foreground")}>
              {i + 1}
              {n > 0 && <span className={cn("absolute bottom-1 flex gap-0.5")}>{Array.from({ length: Math.min(3, n) }, (_, j) => <span key={j} className={cn("size-1 rounded-full", past && !isToday ? "bg-rose-500" : isToday ? "bg-lime-400" : "bg-violet-500")} />)}</span>}
            </button>
          );
        })}
      </motion.div>
    </Bento>
  );
}

function WorkloadCard({ stats }: { stats: DashboardStats }) {
  const max = Math.max(1, ...stats.workload.map((w) => w.open));
  return (
    <Bento className="h-full" style={tint(TINT.sky, 14, 4)}>
      <BentoHead icon={<UsersRound />} title="Team workload" sub="Open tasks per person" action={<Link to="/tasks"><Pill>Tasks <ArrowUpRight className="size-3" /></Pill></Link>} />
      <div className="flex flex-col gap-3">
        {stats.workload.map((w, i) => (
          <div key={w.name} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: toneHex((i % 5) + 1) }}>{w.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0 flex-1">
              <span className="flex justify-between text-sm"><span className="truncate font-medium">{w.name}</span><span className="tabular-nums text-muted-foreground"><b className="text-foreground">{w.open}</b> open{w.overdue ? <span className="text-rose-500"> · {w.overdue} late</span> : ""}</span></span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-background/60"><motion.span className="block h-full rounded-full" style={{ background: `linear-gradient(90deg, ${toneHex((i % 5) + 1)}88, ${toneHex((i % 5) + 1)})` }} initial={{ width: 0 }} animate={{ width: `${(w.open / max) * 100}%` }} transition={{ delay: 0.2 + i * 0.07, duration: 0.8 }} /></span>
            </span>
          </div>
        ))}
        {!stats.workload.length && <p className="py-6 text-center text-sm text-muted-foreground">No assigned open tasks.</p>}
      </div>
    </Bento>
  );
}

const HOST_LABEL: Record<string, string> = { "on-prem": "On-prem", cloud: "Cloud", saas: "SaaS", desktop: "Desktop", "": "Not set" };
const HOST_COLOR: Record<string, string> = { "on-prem": "#8b5cf6", cloud: "#06b6d4", saas: "#38bdf8", desktop: "#f59e0b", "": "#a1a1aa" };
function MixCard({ stats }: { stats: DashboardStats }) {
  const t = stats.totals;
  return (
    <Bento className="h-full">
      <BentoHead icon={<Rocket />} title="Portfolio mix" sub="Status and where apps run" />
      <div className="grid grid-cols-2 gap-3">
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.byStatus} dataKey="count" nameKey="status" innerRadius={44} outerRadius={66} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1200}>
                {stats.byStatus.map((s) => <Cell key={s.status} fill={STATUS_HEX[s.status]} />)}
              </Pie>
              <Tooltip contentStyle={TT} formatter={(v, n) => [v, STATUS_META[n as keyof typeof STATUS_META]?.label ?? n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-bold">{t.apps}</div><div className="text-[10px] text-muted-foreground">apps</div></div></div>
        </div>
        <div className="relative h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.mix.hosting} dataKey="count" nameKey="key" innerRadius={44} outerRadius={66} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={1400}>
                {stats.mix.hosting.map((h) => <Cell key={h.key} fill={HOST_COLOR[h.key] ?? "#a1a1aa"} />)}
              </Pie>
              <Tooltip contentStyle={TT} formatter={(v, n) => [v, HOST_LABEL[String(n)] ?? n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><div className="text-xs font-semibold">Hosting</div></div></div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {stats.byStatus.map((s) => <Link key={s.status} to={`/apps?status=${s.status}`} className="flex items-center justify-between rounded-lg px-1.5 py-0.5 hover:bg-muted/60"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: STATUS_HEX[s.status] }} />{STATUS_META[s.status].label}</span><b>{s.count}</b></Link>)}
        {stats.mix.hosting.map((h) => <span key={h.key} className="flex items-center justify-between px-1.5 py-0.5"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: HOST_COLOR[h.key] ?? "#a1a1aa" }} />{HOST_LABEL[h.key] ?? h.key}</span><b>{h.count}</b></span>)}
      </div>
    </Bento>
  );
}

function DueSoonCard({ stats }: { stats: DashboardStats }) {
  return (
    <Bento className="h-full" style={tint(TINT.violet, 14, 4)}>
      <BentoHead icon={<AlarmClock />} title="Due in the next 2 weeks" sub={`${stats.totals.tasksOpen} open tasks · ${stats.totals.overdue} overdue`} action={<Link to="/tasks?s=week"><Pill>All <ArrowUpRight className="size-3" /></Pill></Link>} />
      <div className="flex flex-col gap-1">
        {stats.dueSoon.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nothing due. 🎉</p>}
        {stats.dueSoon.map((task, i) => {
          const overdue = task.dueDate < new Date().toISOString().slice(0, 10);
          return (
            <motion.div key={task.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/apps/${task.appId}/tasks`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-background/70">
                <CheckSquare className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{task.title}</div><div className="truncate text-xs text-muted-foreground">{task.appName}{task.assignee && ` · ${task.assignee}`}</div></div>
                <PriorityDot priority={task.priority} />
                <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-medium", overdue ? "bg-rose-500/15 text-rose-400" : "bg-background/70 text-muted-foreground")}>{fmtDate(task.dueDate, { day: "numeric", month: "short" })}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Bento>
  );
}

const FRAME_CYCLE: PictureRailItem["frame"][] = ["black", "oak", "white"];
const SLOT = 168; // px of rail per frame

function WallRail({ list }: { list: AppSummary[] }) {
  const navigate = useNavigate();
  const openPeople = useOpenPeople();
  const scroller = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<number | null>(null);
  const prints: PictureRailItem[] = React.useMemo(() => list.map((a, i) => ({
    id: a.id, title: a.name, artist: a.vendor || a.ownerName || a.department, year: a.version ? `v${a.version}` : STATUS_META[a.status].label,
    image: coverFor(a, 800, 1000), aspect: a.coverShot ? Math.min(1.9, Math.max(0.55, a.coverShot.width / a.coverShot.height)) : a.cover ? 1.6 : i % 3 === 1 ? 1 : 0.8,
    frame: FRAME_CYCLE[i % 3], mat: i % 2 === 0, drop: [0.04, 0.12, -0.02, 0.16, 0.06, 0, 0.1, 0.03][i % 8] ?? 0,
    tag: a.landscape.utilization !== null ? `${a.landscape.utilization}% seats` : a.tasksTotal ? `${a.progress}%` : STATUS_META[a.status].label,
    details: [STATUS_META[a.status].label, a.category, `${fmtNumber(a.landscape.activeUsers)}${a.seats ? ` / ${fmtNumber(a.seats)}` : ""} users`, a.tickets?.open ? `${a.tickets.open} open tickets` : `${a.tasksDone}/${a.tasksTotal} tasks done`],
  })), [list]);
  const cur = active === null ? null : list[active];
  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });
  // vertical wheel over the rail slides it sideways
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { const max = el.scrollWidth - el.clientWidth; if ((e.deltaY > 0 && el.scrollLeft < max) || (e.deltaY < 0 && el.scrollLeft > 0)) { e.preventDefault(); el.scrollLeft += e.deltaY; } } };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-col items-center gap-1 px-6 pt-7 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">App wall · all {list.length} applications</p>
        <h2 className="text-balance text-2xl font-medium tracking-tight sm:text-3xl">Brush the rail to light an app, click to lift it.</h2>
      </div>
      <div className="relative">
        <button onClick={() => scroll(-1)} aria-label="Slide left" className="emboss absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full"><ChevronLeft className="size-5" /></button>
        <button onClick={() => scroll(1)} aria-label="Slide right" className="emboss absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full"><ChevronRight className="size-5" /></button>
        <div ref={scroller} className="overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:thin]">
          <div style={{ width: Math.max(list.length * SLOT, 900) }}>
            <PictureRailGallery items={prints} onActiveChange={setActive} hideFooter className="!bg-transparent" labels={{ front: "Front", back: "Back", close: "Close", open: "Click to lift" }} />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 px-6 pb-7 pt-2 text-center">
        <div className="min-h-[2.75rem]">
          <p className="text-sm font-medium">{cur ? cur.name : "Slide along the rail — scroll, drag the bar or use the arrows."}</p>
          {cur && <p className="mt-0.5 text-[13px] text-muted-foreground">{[cur.category, cur.vendor || cur.ownerName, `${fmtNumber(cur.landscape.activeUsers)}${cur.seats ? ` / ${fmtNumber(cur.seats)}` : ""} users`, cur.tickets?.open ? `${cur.tickets.open} open tickets` : ""].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="sm" disabled={!cur} onClick={() => cur && navigate(`/apps/${cur.id}`)}><ArrowRight />Open app page</Button>
          <Button variant="secondary" size="sm" disabled={!cur} onClick={() => cur && openPeople(cur)}><UsersRound />Users</Button>
          <Button variant="secondary" size="sm" disabled={!cur?.url} onClick={() => cur && openApp(cur)}><ExternalLink />Launch</Button>
        </div>
      </div>
    </GlassCard>
  );
}
