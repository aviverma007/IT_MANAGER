import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote, Bot, Boxes, Briefcase, Building2, ChevronDown, Cloud, Code2, Gauge, HardDrive, Headphones, LayoutGrid, Megaphone, Monitor, PieChart, Server, ShieldCheck, Users, Wrench,
} from "lucide-react";
import type { AppSummary } from "@/core/types";
import { useMe } from "@/lib/auth";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, ProgressRing, Tabs } from "@/components/ui/bits";
import { useConfirm } from "@/components/ui/modal";
import { coverFor } from "@/lib/covers";
import { cn, fmtNumber } from "@/lib/utils";

type GroupBy = "category" | "hosting" | "source";

export const utilColor = (u: number | null) => (u === null ? "var(--muted-foreground)" : u >= 85 ? "#10b981" : u >= 60 ? "#3b82f6" : u >= 45 ? "#f59e0b" : "#f43f5e");

export function UsageTag({ app }: { app: AppSummary }) {
  const { utilization: u, activeUsers } = app.landscape;
  const [label, cls] =
    u === null ? (activeUsers ? ["In use", "bg-sky-500/12 text-sky-600 dark:text-sky-300"] : ["No data", "bg-muted text-muted-foreground"])
      : u >= 85 ? ["Healthy", "bg-emerald-500/14 text-emerald-600 dark:text-emerald-300"]
        : u >= 60 ? ["OK", "bg-blue-500/12 text-blue-600 dark:text-blue-300"]
          : u >= 45 ? ["Under-used", "bg-amber-500/16 text-amber-700 dark:text-amber-300"]
            : ["Review seats", "bg-rose-500/14 text-rose-600 dark:text-rose-300"];
  return <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", cls)}>{label}</span>;
}

const CATEGORY_ICON: [RegExp, typeof Server][] = [
  [/erp|financ|fi\b|account/i, Banknote], [/crm|sales/i, Briefcase], [/market/i, Megaphone], [/construct|design|project/i, Building2],
  [/productiv|office/i, LayoutGrid], [/\bai\b|assistant/i, Bot], [/hr|people|compliance/i, ShieldCheck], [/it ops|analytic|bi\b|report/i, PieChart],
  [/in-house|internal/i, Code2], [/support|helpdesk/i, Headphones], [/integration|api|sap/i, Wrench],
];
const HOSTING_META: Record<string, { label: string; icon: typeof Server; hint: string }> = {
  "on-prem": { label: "On-premises", icon: Server, hint: "Runs on company servers" },
  cloud: { label: "Cloud", icon: Cloud, hint: "Hosted on Azure / AWS etc." },
  saas: { label: "SaaS", icon: Cloud, hint: "Vendor-hosted subscription" },
  desktop: { label: "Desktop", icon: Monitor, hint: "Installed on PCs" },
  "": { label: "Hosting not set", icon: HardDrive, hint: "Set it in Edit → Basics" },
};
const GROUP_TONES = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#ec4899", "#14b8a6", "#a855f7", "#64748b"];

function groupKey(a: AppSummary, by: GroupBy) {
  if (by === "hosting") return a.hosting || "";
  if (by === "source") return a.source === "vendor" ? "vendor" : "in-house";
  return a.category || "Uncategorised";
}
function groupLabel(key: string, by: GroupBy) {
  if (by === "hosting") return HOSTING_META[key]?.label ?? key;
  if (by === "source") return key === "vendor" ? "Vendor / licensed" : "Built in-house";
  return key;
}
function groupIcon(key: string, by: GroupBy) {
  if (by === "hosting") return HOSTING_META[key]?.icon ?? Server;
  if (by === "source") return key === "vendor" ? Boxes : Code2;
  return CATEGORY_ICON.find(([re]) => re.test(key))?.[1] ?? Boxes;
}

function totals(apps: AppSummary[]) {
  const withSeats = apps.filter((a) => a.seats > 0);
  const seats = withSeats.reduce((s, a) => s + a.seats, 0);
  const activeOnSeats = withSeats.reduce((s, a) => s + Math.min(a.landscape.activeUsers, a.seats * 5), 0);
  const active = apps.reduce((s, a) => s + a.landscape.activeUsers, 0);
  return { seats, active, util: seats ? Math.round((activeOnSeats / seats) * 100) : null, under: withSeats.filter((a) => (a.landscape.utilization ?? 100) < 60).length };
}

function GroupCard({ title, Icon, tone, apps, index }: { title: string; Icon: typeof Server; tone: string; apps: AppSummary[]; index: number }) {
  const [all, setAll] = React.useState(false);
  const t = totals(apps);
  const sorted = [...apps].sort((a, b) => b.landscape.activeUsers - a.landscape.activeUsers || a.name.localeCompare(b.name));
  const shown = all ? sorted : sorted.slice(0, 6);
  return (
    <motion.section layout initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 240, damping: 26, delay: Math.min(index, 10) * 0.04 }}
      className="glass relative overflow-hidden rounded-3xl">
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full opacity-25 blur-2xl" style={{ background: tone }} />
      <header className="relative flex items-center gap-3 p-5 pb-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.2)]" style={{ background: `linear-gradient(135deg, ${tone}, color-mix(in oklab, ${tone} 70%, black))`, boxShadow: `0 10px 24px -10px ${tone}` }}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold tracking-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{apps.length} app{apps.length === 1 ? "" : "s"} · {fmtNumber(t.active)} active{t.seats ? ` / ${fmtNumber(t.seats)} seats` : ""}</p>
        </div>
        {t.util !== null ? <ProgressRing value={Math.min(100, t.util)} size={52} stroke={5} color={utilColor(t.util)} /> : <span className="text-[11px] text-muted-foreground">no seats</span>}
      </header>
      <ul className="relative px-3 pb-3">
        <AnimatePresence initial={false}>
          {shown.map((a) => {
            const u = a.landscape.utilization;
            return (
              <motion.li key={a.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <Link to={`/apps/${a.id}`} className="grid grid-cols-[28px_minmax(0,1fr)_96px_92px] items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
                  <img src={coverFor(a, 80, 80)} alt="" className="size-7 rounded-lg border border-border object-cover object-top" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm font-medium">{a.name}{a.source === "in-house" && <span className="rounded bg-primary/12 px-1 text-[9px] font-bold uppercase text-primary">IT</span>}</span>
                    <span className="block truncate text-[11px] text-muted-foreground" title={a.landscape.activeSource === "tracked" ? "From usage tracking (peak day, 30 days)" : a.landscape.activeSource === "manual" ? "Entered on the app" : a.landscape.activeSource === "logged" ? "From usage entries (peak day, 30 days)" : ""}>
                      {fmtNumber(a.landscape.activeUsers)}{a.seats ? ` / ${fmtNumber(a.seats)}` : ""} users{a.landscape.activeSource === "tracked" ? " · tracked" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="deboss h-1.5 flex-1 overflow-hidden rounded-full">
                      <motion.span className="block h-full rounded-full" style={{ background: utilColor(u) }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, u ?? 0)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="w-8 text-right text-[11px] font-semibold tabular-nums">{u === null ? "—" : `${u}%`}</span>
                  </span>
                  <span className="flex justify-end"><UsageTag app={a} /></span>
                </Link>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {sorted.length > 6 && (
          <li><button onClick={() => setAll((v) => !v)} className="mt-1 w-full rounded-xl py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground">{all ? "Show less" : `Show all ${sorted.length}`}</button></li>
        )}
      </ul>
    </motion.section>
  );
}

/** Top-of-page landscape: KPI strip + one big card per category / hosting / source. */
export function Landscape({ apps, allApps }: { apps: AppSummary[]; allApps: AppSummary[] }) {
  const me = useMe();
  const run = useRun();
  const confirm = useConfirm();
  const [open, setOpen] = React.useState(() => { try { return localStorage.getItem("itm.landscape") !== "0"; } catch { return true; } });
  const [by, setBy] = React.useState<GroupBy>(() => { try { return (localStorage.getItem("itm.landscapeBy") as GroupBy) || "category"; } catch { return "category"; } });
  React.useEffect(() => { try { localStorage.setItem("itm.landscape", open ? "1" : "0"); localStorage.setItem("itm.landscapeBy", by); } catch { /* ignore */ } }, [open, by]);

  const t = totals(apps);
  const groups = React.useMemo(() => {
    const m = new Map<string, AppSummary[]>();
    for (const a of apps) { const k = groupKey(a, by); m.set(k, [...(m.get(k) ?? []), a]); }
    return [...m.entries()].sort((x, y) => (x[0] === "In-house" || x[0] === "in-house" ? 1 : 0) - (y[0] === "In-house" || y[0] === "in-house" ? 1 : 0) || y[1].length - x[1].length);
  }, [apps, by]);
  const noSeats = !allApps.some((a) => a.seats > 0);

  async function loadLandscape() {
    if (!(await confirm({ title: "Load the Smartworld app landscape?", message: "Adds SAP, Salesforce, Microsoft 365 and the other vendor apps from the landscape sheet, and fills licensed seats for your in-house apps (matched by name). Seat and user figures are the sheet's illustrative numbers — correct them on each app.", confirm: "Load landscape" }))) return;
    await run<{ created: number; updated: number }>("admin.loadLandscape", {}, { success: "Landscape loaded" });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          <motion.span animate={{ rotate: open ? 0 : -90 }} className="emboss grid size-8 place-items-center rounded-xl"><ChevronDown className="size-4" /></motion.span>
          <span><span className="block text-lg font-semibold tracking-tight">Application landscape</span><span className="block text-xs text-muted-foreground">Licensed seats, active users and utilization by group</span></span>
        </button>
        {open && <Tabs id="landscape-by" className="ml-auto" value={by} onChange={setBy} tabs={[{ value: "category", label: "By category", icon: <LayoutGrid /> }, { value: "hosting", label: "On-prem / Cloud", icon: <Server /> }, { value: "source", label: "In-house / Vendor", icon: <Code2 /> }]} />}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }} className="overflow-hidden">
            <div className="flex flex-col gap-4 pb-2">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {([
                  ["Applications", apps.length, Boxes, "var(--chart-1)", ""],
                  ["Licensed seats", t.seats, Users, "#3b82f6", ""],
                  ["Active users", t.active, Gauge, "#10b981", ""],
                  ["Avg utilization", t.util ?? 0, PieChart, utilColor(t.util), "%"],
                  ["Under-used (<60%)", t.under, Wrench, "#f59e0b", ""],
                ] as const).map(([label, value, Icon, color, suffix], i) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass flex items-center gap-3 rounded-3xl p-4">
                    <span className="emboss grid size-10 shrink-0 place-items-center rounded-2xl" style={{ color }}><Icon className="size-5" /></span>
                    <span><span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span><span className="text-2xl font-bold" style={label.startsWith("Avg") ? { color } : undefined}><AnimatedNumber value={value} format={(n) => fmtNumber(Math.round(n)) + suffix} /></span></span>
                  </motion.div>
                ))}
              </div>

              {noSeats && (
                <div className="glass flex flex-wrap items-center gap-3 rounded-3xl p-4 text-sm">
                  <span className="flex-1 text-muted-foreground">No licensed seats recorded yet, so utilization can't be worked out. Set <b className="text-foreground">Licensed seats</b> on each app (Edit → Basics){me.role === "admin" ? ", or load the full landscape from the Smartworld sheet." : "."}</span>
                  {me.role === "admin" && <Button variant="primary" size="sm" onClick={loadLandscape}><Boxes />Load Smartworld landscape (47 apps)</Button>}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {groups.map(([key, list], i) => (
                    <GroupCard key={`${by}:${key}`} title={groupLabel(key, by)} Icon={groupIcon(key, by)} tone={GROUP_TONES[i % GROUP_TONES.length]!} apps={list} index={i} />
                  ))}
                </AnimatePresence>
              </div>
              <p className="text-xs text-muted-foreground">
                Utilization = active users ÷ licensed seats. <span style={{ color: "#10b981" }}>■</span> ≥85% healthy · <span style={{ color: "#3b82f6" }}>■</span> 60–84% OK · <span style={{ color: "#f59e0b" }}>■</span> 45–59% under-used · <span style={{ color: "#f43f5e" }}>■</span> &lt;45% review seats.
                Active users come from the tracking script (busiest day in the last 30 days) where it's installed, otherwise the figure entered on the app, otherwise logged usage entries.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export { HOSTING_META };
