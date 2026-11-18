import * as React from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Radio, UserRound } from "lucide-react";
import type { AppDetail, LiveUsage } from "@/core/types";
import { call, DEMO } from "@/api/client";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, GlassCard, SectionTitle } from "@/components/ui/bits";
import { cn, timeAgo, toneHex } from "@/lib/utils";
import { toast } from "sonner";

/** Live usage from the track.js snippet embedded in the application, plus the snippet itself. */
export function TrackingCard({ app }: { app: AppDetail }) {
  const { data } = useQuery({ queryKey: ["live", app.id], queryFn: () => call<LiveUsage>("usage.live", { appId: app.id }), refetchInterval: 15_000 });
  const [copied, setCopied] = React.useState(false);
  const host = DEMO ? "http://192.168.66.28:4000" : window.location.origin;
  const snippet = `<script async src="${host}/track.js" data-app="${app.code}"></script>`;
  const color = toneHex(app.tone);
  const maxHour = Math.max(1, ...(data?.hours ?? [0]));
  const live = data?.tracking && data.lastSeen && Date.now() - data.lastSeen < 24 * 3600e3;

  async function copy() {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Couldn't copy — select the text and copy it manually."); }
  }

  return (
    <GlassCard className="p-5">
      <SectionTitle title="Live tracking" icon={<Radio />}
        sub={data?.tracking ? `Automatic — reported by ${app.name} itself · last visit ${timeAgo(data.lastSeen ? new Date(data.lastSeen).toISOString() : null)}` : `Not connected yet — add the snippet below to ${app.name}`}
        action={<span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", live ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
          <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50")} />{live ? "Receiving data" : "Waiting for data"}
        </span>} />

      {data?.tracking && (
        <div className="mb-5 grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
          {[["Using it right now", data.activeNow], ["Visits today", data.today.sessions], ["People today", data.today.users], ["Avg minutes / visit", data.today.avgMinutes]].map(([l, v], i) => (
            <motion.div key={l as string} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="deboss rounded-2xl p-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className="flex items-center gap-2 text-2xl font-bold">
                {i === 0 && (v as number) > 0 && <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" /></span>}
                <AnimatedNumber value={v as number} format={(n) => (i === 3 ? n.toFixed(1) : String(Math.round(n)))} />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {data?.tracking && (
        <div className="mb-5 grid gap-5 lg:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Visits by hour (today)</div>
            <div className="flex h-24 items-end gap-[3px]">
              {data.hours.map((n, h) => (
                <motion.div key={h} title={`${h}:00 — ${n} visit(s)`} className="flex-1 rounded-t" style={{ background: n ? color : "var(--muted)" }}
                  initial={{ height: 0 }} animate={{ height: `${Math.max(4, (n / maxHour) * 100)}%` }} transition={{ delay: h * 0.015, duration: 0.6 }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Top pages (today)</div>
            {data.topPages.length ? data.topPages.slice(0, 6).map((p) => (
              <div key={p.page} className="flex justify-between gap-3 py-0.5 text-sm"><span className="truncate font-mono text-xs">{p.page}</span><span className="tabular-nums text-muted-foreground">{p.views}</span></div>
            )) : <p className="text-sm text-muted-foreground">No page views yet today.</p>}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Most active people (today)</div>
            {data.topUsers.length ? data.topUsers.slice(0, 6).map((u) => (
              <div key={u.user} className="flex items-center justify-between gap-3 py-0.5 text-sm"><span className="flex min-w-0 items-center gap-1.5"><UserRound className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{u.user}</span></span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{u.sessions} visit{u.sessions > 1 ? "s" : ""} · {u.minutes} min</span></div>
            )) : <p className="text-sm text-muted-foreground">Names appear when the app exposes the signed-in user.</p>}
          </div>
        </div>
      )}

      <div className="deboss rounded-2xl p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Tracking snippet for {app.name} — paste into its <code className="rounded bg-muted px-1">index.html</code>, just before <code className="rounded bg-muted px-1">&lt;/head&gt;</code></div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-background/70 px-3 py-2 font-mono text-xs">{snippet}</code>
          <Button size="sm" variant="secondary" onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Counts every visit, page change and minutes spent; daily totals fill the chart below automatically. To show names, set <code className="rounded bg-muted px-1">window.ITM_USER = employeeCode</code> after login (the script also looks for common keys like <code className="rounded bg-muted px-1">user</code> in localStorage).
        </p>
      </div>
    </GlassCard>
  );
}
