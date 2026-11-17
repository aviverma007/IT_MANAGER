// Live refresh: the server pushes every saved change over Server-Sent Events; each open screen re-fetches
// what it shows. The demo build listens for changes made in other tabs instead. If the live connection drops,
// screens fall back to polling every 30 seconds until it comes back.
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEMO, reloadLocalDb, tokenStore } from "./client";
import type { ChangeEvent } from "@/core/service";

export type LiveStatus = "live" | "connecting" | "offline";

export function useLiveSync(myId: string) {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<LiveStatus>(DEMO ? "live" : "connecting");
  const [online, setOnline] = React.useState(0);

  React.useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void qc.invalidateQueries(), 250); // coalesce bursts (imports, bulk capture)
    };
    let lastToast = 0;
    const notify = (e: ChangeEvent) => {
      if (e.userId === myId || !e.summary) return;
      const now = Date.now();
      if (now - lastToast < 2500) return;
      lastToast = now;
      toast(`${e.userName}`, { description: e.summary, duration: 3500 });
    };

    if (DEMO) {
      const onStorage = (ev: StorageEvent) => { if (ev.key === "itm.db.v1") { reloadLocalDb(); refresh(); } };
      window.addEventListener("storage", onStorage);
      return () => { window.removeEventListener("storage", onStorage); window.clearTimeout(timer); };
    }

    let source: EventSource | null = null;
    let poll: number | undefined;
    const startPolling = () => { if (!poll) poll = window.setInterval(() => void qc.invalidateQueries(), 30_000); };
    const stopPolling = () => { window.clearInterval(poll); poll = undefined; };
    const connect = () => {
      source = new EventSource(`/api/events?t=${encodeURIComponent(tokenStore.get() ?? "")}`);
      source.addEventListener("hello", (ev) => {
        setStatus("live");
        stopPolling();
        try { setOnline(JSON.parse((ev as MessageEvent).data).online ?? 0); } catch { /* ignore */ }
        refresh(); // catch up on anything missed while disconnected
      });
      source.addEventListener("change", (ev) => {
        try { notify(JSON.parse((ev as MessageEvent).data)); } catch { /* ignore */ }
        refresh();
      });
      source.onerror = () => { setStatus("offline"); startPolling(); }; // EventSource reconnects by itself
    };
    connect();
    return () => { source?.close(); stopPolling(); window.clearTimeout(timer); };
  }, [qc, myId]);

  return { status, online };
}
