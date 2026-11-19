import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Ticket as TicketIcon } from "lucide-react";
import { useApps } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { Skeleton } from "@/components/ui/bits";
import { RulesPanel, SyncBar, TicketImportButton, TicketKpis, TicketTable, useTickets, useTicketStatus } from "@/components/app/tickets";
import { fmtNumber, toneHex } from "@/lib/utils";

export default function TicketsPage() {
  const me = useMe();
  const { data: rows, isLoading } = useTickets();
  const { data: apps } = useApps();
  const { data: status } = useTicketStatus();

  const byApp = React.useMemo(() => {
    const m = new Map<string, { id: string | null; name: string; tone: number; open: number; high: number; total: number }>();
    for (const t of rows ?? []) {
      const k = t.appId ?? "__none";
      const e = m.get(k) ?? { id: t.appId, name: t.appName || "Unmatched", tone: t.appTone, open: 0, high: 0, total: 0 };
      e.total++;
      if (t.open) { e.open++; if (/high|urgent|critical|p1|p2/i.test(t.priority)) e.high++; }
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.open - a.open || b.total - a.total);
  }, [rows]);
  const maxOpen = Math.max(1, ...byApp.map((x) => x.open));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">Helpdesk tickets from ServiceDesk Plus, linked to your applications</p>
        </div>
        <TicketImportButton />
      </div>

      <SyncBar status={status} />
      {isLoading || !rows ? <Skeleton className="h-96" /> : (
        <>
          <TicketKpis rows={rows} />

          <div className="glass rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2"><TicketIcon className="size-4 text-primary" /><h3 className="font-semibold">Open tickets by application</h3><span className="ml-auto text-xs text-muted-foreground">total in grey</span></div>
            <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
              {byApp.slice(0, 20).map((a, i) => (
                <div key={a.id ?? "none"} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                  {a.id ? <Link to={`/apps/${a.id}/tickets`} className="truncate font-medium hover:underline">{a.name}</Link> : <span className="truncate text-muted-foreground">Unmatched</span>}
                  <span className="deboss relative h-2.5 overflow-hidden rounded-full">
                    <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: a.id ? toneHex(a.tone) : "#a1a1aa" }} initial={{ width: 0 }} animate={{ width: `${(a.open / maxOpen) * 100}%` }} transition={{ delay: i * 0.03, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                  </span>
                  <span className="w-28 text-right tabular-nums"><b>{fmtNumber(a.open)}</b> open{a.high ? <span className="text-rose-500"> · {a.high}↑</span> : ""} <span className="text-muted-foreground">/ {fmtNumber(a.total)}</span></span>
                </div>
              ))}
              {!byApp.length && <p className="text-sm text-muted-foreground">No tickets yet.</p>}
            </div>
          </div>

          <TicketTable rows={rows} apps={apps ?? []} />
          {status && me.role === "admin" && <RulesPanel status={status} apps={apps ?? []} />}
        </>
      )}
    </div>
  );
}
