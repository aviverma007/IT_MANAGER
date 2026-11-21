import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote, Bot, Boxes, Briefcase, Building2, ChevronDown, Cloud, Code2, Gauge, HardDrive, Headphones, LayoutGrid, LayoutList, Search, ExternalLink, Megaphone, Monitor, PieChart, Server, ShieldCheck, Users, Wrench,
} from "lucide-react";
import type { AppSummary } from "@/core/types";
import { useMe } from "@/lib/auth";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, ProgressRing, StatusBadge, Tabs } from "@/components/ui/bits";
import { openApp } from "@/lib/launch";
import { useConfirm } from "@/components/ui/modal";
import { coverFor } from "@/lib/covers";
import { TicketDrawer, TicketHoverChip } from "@/components/app/tickets";
import { PeopleChip, useOpenPeople } from "@/components/app/people";
import { Ticket as TicketIcon } from "lucide-react";
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

type DrillTo = (t: { title: string; appIds: (string | null)[] }) => void;
function GroupCard({ title, Icon, tone, apps, index, onTickets }: { title: string; Icon: typeof Server; tone: string; apps: AppSummary[]; index: number; onTickets: DrillTo }) {
  const openT = apps.reduce((s, a) => s + (a.tickets?.open ?? 0), 0);
  const highT = apps.reduce((s, a) => s + (a.tickets?.high ?? 0), 0);
  const anyT = apps.some((a) => a.tickets?.total);
  const [all, setAll] = React.useState(false);
  const openPeople = useOpenPeople();
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
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">{apps.length} app{apps.length === 1 ? "" : "s"} · {fmtNumber(t.active)} active{t.seats ? ` / ${fmtNumber(t.seats)} seats` : ""}
            {anyT && <button onClick={() => onTickets({ title, appIds: apps.map((a) => a.id) })} className="inline-flex items-center gap-1 rounded-full px-1.5 font-semibold hover:underline" style={{ color: highT ? "#f43f5e" : openT ? "#f59e0b" : "#10b981" }}><TicketIcon className="size-3" />{openT} open ticket{openT === 1 ? "" : "s"} — view</button>}
          </p>
        </div>
        {t.util !== null ? <ProgressRing value={Math.min(100, t.util)} size={52} stroke={5} color={utilColor(t.util)} /> : <span className="text-[11px] text-muted-foreground">no seats</span>}
      </header>
      <ul className="relative px-3 pb-3">
        <AnimatePresence initial={false}>
          {shown.map((a) => {
            const u = a.landscape.utilization;
            return (
              <motion.li key={a.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <Link to={`/apps/${a.id}`} className="grid grid-cols-[36px_minmax(0,1fr)_92px] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50">
                  <img src={coverFor(a, 80, 80)} alt="" className="size-9 rounded-lg border border-border object-cover object-top" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">{a.name}{a.source === "in-house" && <span className="rounded bg-primary/12 px-1 text-[9px] font-bold uppercase text-primary">IT</span>}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <PeopleChip app={a} big onOpen={() => openPeople(a)} />
                      {a.tickets?.total ? <TicketHoverChip app={a} onOpen={() => onTickets({ title: a.name, appIds: [a.id] })} /> : null}
                    </span>
                  </span>
                  <span className="flex flex-col gap-1" title={u === null ? "Set licensed seats to see how many are in use" : `${fmtNumber(a.landscape.activeUsers)} of ${fmtNumber(a.seats)} licensed seats are in use`}>
                    <span className="flex items-baseline justify-between gap-1"><span className="text-base font-bold tabular-nums" style={{ color: utilColor(u) }}>{u === null ? "—" : `${u}%`}</span><span className="text-[10px] text-muted-foreground">seats used</span></span>
                    <span className="deboss h-1.5 overflow-hidden rounded-full">
                      <motion.span className="block h-full rounded-full" style={{ background: utilColor(u) }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, u ?? 0)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="flex justify-end"><UsageTag app={a} /></span>
                  </span>
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
  const [layout, setLayout] = React.useState<"groups" | "cards" | "list">(() => { try { return (localStorage.getItem("itm.landscapeLayout") as "groups" | "cards" | "list") || "groups"; } catch { return "groups"; } });
  React.useEffect(() => { try { localStorage.setItem("itm.landscape", open ? "1" : "0"); localStorage.setItem("itm.landscapeBy", by); localStorage.setItem("itm.landscapeLayout", layout); } catch { /* ignore */ } }, [open, by, layout]);

  const t = totals(apps);
  const [drill, setDrill] = React.useState<{ title: string; appIds: (string | null)[] } | null>(null);
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
          <span><span className="block text-lg font-semibold tracking-tight">Application landscape</span><span className="block text-xs text-muted-foreground">Users, licensed seats, % of seats in use and open tickets — by group</span></span>
        </button>
        {open && <Tabs id="landscape-layout" className="ml-auto" value={layout} onChange={setLayout} tabs={[{ value: "groups", label: "Grouped", icon: <LayoutGrid /> }, { value: "cards", label: "Cards", icon: <Boxes /> }, { value: "list", label: "List", icon: <LayoutList /> }]} />}
        {open && <Tabs id="landscape-by" value={by} onChange={setBy} tabs={[{ value: "category", label: "By category", icon: <LayoutGrid /> }, { value: "hosting", label: "On-prem / Cloud", icon: <Server /> }, { value: "source", label: "In-house / Vendor", icon: <Code2 /> }]} />}
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
                  {me.role === "admin" && <Button variant="primary" size="sm" onClick={loadLandscape}><Boxes />Load Smartworld landscape (34 vendor apps)</Button>}
                </div>
              )}

              {layout !== "groups" ? <AppCardsGrid groups={groups} by={by} onTickets={setDrill} list={layout === "list"} /> : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {groups.map(([key, list], i) => (
                      <GroupCard key={`${by}:${key}`} title={groupLabel(key, by)} Icon={groupIcon(key, by)} tone={GROUP_TONES[i % GROUP_TONES.length]!} apps={list} index={i} onTickets={setDrill} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                <b>Seats used %</b> = active users ÷ licensed seats (e.g. 96 of 120 licences in use = 80%). <span style={{ color: "#10b981" }}>■</span> ≥85% healthy · <span style={{ color: "#3b82f6" }}>■</span> 60–84% OK · <span style={{ color: "#f59e0b" }}>■</span> 45–59% under-used · <span style={{ color: "#f43f5e" }}>■</span> &lt;45% review seats.
                Active users come from the tracking script (busiest day in the last 30 days) where it's installed, otherwise the figure entered on the app, otherwise logged usage entries.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <TicketDrawer target={drill} onClose={() => setDrill(null)} />
    </section>
  );
}

/** Cards layout: every application gets its own card, listed one after another (in the current grouping order). */
function AppCardsGrid({ groups, by, onTickets, list }: { groups: [string, AppSummary[]][]; by: GroupBy; onTickets: DrillTo; list?: boolean }) {
  const openPeople = useOpenPeople();
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"group" | "name" | "users" | "util" | "tickets">("group");
  const rows = groups.flatMap(([key, list], gi) => [...list].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ a, group: groupLabel(key, by), tone: GROUP_TONES[gi % GROUP_TONES.length]! })));
  const shown = rows
    .filter(({ a, group }) => !q || `${a.name} ${a.vendor} ${a.category} ${group}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => sort === "name" ? x.a.name.localeCompare(y.a.name)
      : sort === "users" ? y.a.landscape.activeUsers - x.a.landscape.activeUsers
        : sort === "util" ? (y.a.landscape.utilization ?? -1) - (x.a.landscape.utilization ?? -1)
          : sort === "tickets" ? (y.a.tickets?.open ?? 0) - (x.a.tickets?.open ?? 0) : 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an application…" className="deboss h-10 w-full rounded-2xl bg-transparent pl-9 pr-3 text-sm outline-none" /></div>
        <Tabs id="landscape-cards-sort" value={sort} onChange={setSort} tabs={[{ value: "group", label: "By group" }, { value: "name", label: "A–Z" }, { value: "users", label: "Most users" }, { value: "util", label: "Seats used %" }, { value: "tickets", label: "Open tickets" }]} />
      </div>
      {list ? (
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["Application", "Group", "Status", "Users / seats", "Seats used", "Tickets", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(({ a, group, tone }, i) => {
                const u = a.landscape.utilization;
                return (
                  <motion.tr key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 25) * 0.012 }} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link to={`/apps/${a.id}`} className="flex items-center gap-3">
                        <img src={coverFor(a, 120, 120)} alt="" className="h-9 w-14 shrink-0 rounded-lg border border-border object-cover object-top" />
                        <span className="min-w-0"><span className="flex items-center gap-1.5 truncate font-semibold hover:underline">{a.name}{a.source === "in-house" && <span className="rounded bg-primary/12 px-1 text-[9px] font-bold uppercase text-primary">IT</span>}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[a.vendor, a.hosting && HOSTING_META[a.hosting]?.label].filter(Boolean).join(" · ") || a.category}</span></span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium"><span className="size-2 rounded-full" style={{ background: tone }} />{group}</span></td>
                    <td className="px-4 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2.5"><PeopleChip app={a} big onOpen={() => openPeople(a)} /></td>
                    <td className="w-64 px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="deboss h-1.5 w-20 shrink-0 overflow-hidden rounded-full"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, u ?? 0)}%`, background: utilColor(u) }} /></span>
                        <span className="w-10 text-right font-bold tabular-nums" style={{ color: utilColor(u) }}>{u === null ? "—" : `${u}%`}</span>
                        <UsageTag app={a} />
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{a.tickets?.total ? <TicketHoverChip app={a} onOpen={() => onTickets({ title: a.name, appIds: [a.id] })} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-right">{a.url && <button onClick={() => openApp(a)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary" title={a.url}><ExternalLink className="size-3.5" />Open</button>}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {shown.map(({ a, group, tone }, i) => {
            const u = a.landscape.utilization;
            return (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 260, damping: 26, delay: Math.min(i, 16) * 0.02 }}
                whileHover={{ y: -4 }} className="group relative h-80 overflow-hidden rounded-3xl border border-white/30 shadow-[0_20px_45px_-25px_rgb(0_0_0/0.5)] dark:border-white/10">
                {/* the picture fills the whole card */}
                <Link to={`/apps/${a.id}`} className="absolute inset-0 block" aria-label={a.name}>
                  {a.logo ? (
                    <span className="absolute inset-0 block overflow-hidden" style={{ background: `linear-gradient(150deg, color-mix(in oklab, ${tone} 30%, white), color-mix(in oklab, ${tone} 12%, white))` }}>
                      <img src={a.logo} alt="" aria-hidden className="absolute inset-0 size-full scale-[1.8] object-cover opacity-45 blur-3xl saturate-150" />
                      <img src={a.logo} alt="" className="absolute left-1/2 top-[34%] w-[52%] max-w-[180px] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_18px_30px_rgb(0_0_0/0.25)] transition-transform duration-700 group-hover:scale-110" />
                    </span>
                  ) : (
                    <img src={coverFor(a, 800, 900)} alt="" className="absolute inset-0 size-full object-cover object-top transition-transform duration-700 group-hover:scale-105" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/45" />
                </Link>
                <span className="pointer-events-none absolute left-3 top-3 flex gap-1.5"><StatusBadge status={a.status} className="!bg-background/85 backdrop-blur-md" /></span>
                <span className="pointer-events-none absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white shadow" style={{ background: tone }}>{group}</span>
                {/* frosted panel over the picture */}
                <div className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-2 rounded-2xl border border-white/40 bg-background/75 p-3.5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-background/70">
                  <div className="flex items-start gap-2">
                    <Link to={`/apps/${a.id}`} className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 truncate text-base font-semibold hover:underline">{a.name}{a.source === "in-house" && <span className="rounded bg-primary/12 px-1 text-[9px] font-bold uppercase text-primary">IT</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[a.vendor, a.hosting && HOSTING_META[a.hosting]?.label].filter(Boolean).join(" · ") || a.category}</span>
                    </Link>
                    <UsageTag app={a} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10"><motion.span className="block h-full rounded-full" style={{ background: utilColor(u) }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, u ?? 0)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} /></span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: utilColor(u) }}>{u === null ? "—" : `${u}%`}</span>
                    <span className="text-[10px] text-muted-foreground">seats used</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PeopleChip app={a} big onOpen={() => openPeople(a)} />
                    {a.tickets?.total ? <TicketHoverChip app={a} onOpen={() => onTickets({ title: a.name, appIds: [a.id] })} /> : null}
                    {a.url && <button onClick={() => openApp(a)} className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary" title={a.url}><ExternalLink className="size-3.5" />Open</button>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}
      {!shown.length && <p className="py-8 text-center text-sm text-muted-foreground">No application matches “{q}”.</p>}
    </div>
  );
}

export { HOSTING_META };
