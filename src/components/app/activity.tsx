import { motion } from "motion/react";
import {
  Camera, ArrowRightLeft, CheckCircle2, Download, Edit3, FilePlus2, FileUp, KeyRound, LogIn, LogOut, MousePointerClick, PlusCircle, RotateCcw, Shield, Trash2, Upload,
} from "lucide-react";
import type { LogEntry } from "@/core/types";
import { cn, timeAgo } from "@/lib/utils";
import { Link } from "react-router-dom";

export const ACTION_META: Record<string, { icon: typeof Edit3; color: string; label: string }> = {
  create: { icon: PlusCircle, color: "text-emerald-400 bg-emerald-500/12", label: "Created" },
  update: { icon: Edit3, color: "text-sky-400 bg-sky-500/12", label: "Updated" },
  delete: { icon: Trash2, color: "text-rose-400 bg-rose-500/12", label: "Deleted" },
  complete: { icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/12", label: "Completed" },
  reopen: { icon: RotateCcw, color: "text-amber-400 bg-amber-500/12", label: "Reopened" },
  status: { icon: ArrowRightLeft, color: "text-violet-400 bg-violet-500/12", label: "Status" },
  import: { icon: FileUp, color: "text-cyan-400 bg-cyan-500/12", label: "Imported" },
  capture: { icon: Camera, color: "text-pink-400 bg-pink-500/12", label: "Captured" },
  upload: { icon: Upload, color: "text-cyan-400 bg-cyan-500/12", label: "Uploaded" },
  access: { icon: Shield, color: "text-fuchsia-400 bg-fuchsia-500/12", label: "Access" },
  open: { icon: MousePointerClick, color: "text-indigo-400 bg-indigo-500/12", label: "Opened" },
  login: { icon: LogIn, color: "text-zinc-400 bg-zinc-500/12", label: "Sign in" },
  logout: { icon: LogOut, color: "text-zinc-400 bg-zinc-500/12", label: "Sign out" },
  "reset-password": { icon: KeyRound, color: "text-amber-400 bg-amber-500/12", label: "Password" },
  "change-password": { icon: KeyRound, color: "text-amber-400 bg-amber-500/12", label: "Password" },
  export: { icon: Download, color: "text-zinc-400 bg-zinc-500/12", label: "Export" },
  restore: { icon: FilePlus2, color: "text-amber-400 bg-amber-500/12", label: "Restore" },
  reset: { icon: RotateCcw, color: "text-rose-400 bg-rose-500/12", label: "Reset" },
};

export function ActionIcon({ action, className }: { action: string; className?: string }) {
  const meta = ACTION_META[action] ?? ACTION_META.update!;
  return <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", meta.color, className)}><meta.icon className="size-4" /></span>;
}

export function ActivityFeed({ items, showApp = true, empty = "No activity yet." }: { items: LogEntry[]; showApp?: boolean; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-3 left-4 top-3 w-px bg-gradient-to-b from-border via-border to-transparent" />
      {items.map((l, i) => (
        <motion.li key={l.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.035 }} className="relative flex gap-3 py-2">
          <ActionIcon action={l.action} className="relative z-10 ring-4 ring-background/0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">{l.summary}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {l.userName}
              {showApp && l.appId && <> · <Link to={`/apps/${l.appId}`} className="hover:text-foreground hover:underline">{l.appName}</Link></>}
              {" · "}<span title={new Date(l.at).toLocaleString()}>{timeAgo(l.at)}</span>
            </p>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
