import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AppWindow, CheckCircle2, Mail, Settings } from "lucide-react";
import TeamLanyardRail, { type LanyardMember } from "@/components/ui/team-lanyard-rail";
import { useApps, useUsers } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import { avatarFor, coverFor } from "@/lib/covers";
import { Avatar, GlassCard, Skeleton } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

export default function TeamPage() {
  const me = useMe();
  const { data: users, isLoading } = useUsers();
  const { data: apps } = useApps();
  const active = (users ?? []).filter((u) => u.active);

  const members: LanyardMember[] = React.useMemo(() => active.map((u) => {
    const owned = (apps ?? []).filter((a) => a.ownerId === u.id).length;
    return {
      id: u.id, name: u.name, role: u.title || u.role, team: `${u.department || "IT"} · ${u.role[0]!.toUpperCase()}${u.role.slice(1)}`,
      image: avatarFor(u), bio: u.bio || `${u.name.split(" ")[0]} is part of the IT Manager workspace.`, tone: u.tone,
      tags: [u.role === "admin" ? "Administrator" : u.role === "editor" ? "Can edit" : "View only", owned ? `${owned} app${owned > 1 ? "s" : ""} owned` : "Contributor"],
      links: u.email ? [{ label: "Email", href: `mailto:${u.email}` }] : [],
    };
  }), [active, apps]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight">Team</h1><p className="text-sm text-muted-foreground">Everyone with an IT Manager account, their role and what they own.</p></div>
        {me.role === "admin" && <Link to="/users"><Button variant="secondary"><Settings />Manage users & rights</Button></Link>}
      </div>

      <GlassCard className="overflow-hidden">
        {isLoading ? <Skeleton className="h-96" /> : (
          <TeamLanyardRail
            items={members}
            eyebrow={`The team · ${members.length} ${members.length === 1 ? "person" : "people"}`}
            heading="Pick a badge to meet the people behind the apps."
            caption="Brush along the rail, pull a badge down, click to flip it."
            autoplay
            className="!bg-transparent"
          />
        )}
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(users ?? []).map((u, i) => {
          const owned = (apps ?? []).filter((a) => a.ownerId === u.id);
          return (
            <motion.div key={u.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ y: -4 }}>
              <GlassCard className={cn("h-full p-5", !u.active && "opacity-50")}>
                <div className="flex items-center gap-3">
                  <Avatar user={u} size={48} ring />
                  <div className="min-w-0"><div className="truncate font-semibold">{u.name}</div><div className="truncate text-xs text-muted-foreground">{u.title || u.department}</div></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold capitalize", u.role === "admin" ? "bg-violet-500/15 text-violet-400" : u.role === "editor" ? "bg-emerald-500/15 text-emerald-500" : "bg-sky-500/15 text-sky-500")}>{u.role}</span>
                  {!u.active && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-rose-400">deactivated</span>}
                  <span className="text-muted-foreground">last seen {timeAgo(u.lastLoginAt)}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><AppWindow className="size-3.5" />{owned.length} owned</div>
                <div className="mt-2 flex -space-x-2">
                  {owned.slice(0, 6).map((a) => <Link key={a.id} to={`/apps/${a.id}`} title={a.name}><img src={coverFor(a, 60, 60)} alt="" className="size-8 rounded-lg border-2 border-background object-cover transition-transform hover:z-10 hover:scale-125" /></Link>)}
                </div>
                {u.email && <a href={`mailto:${u.email}`} className="mt-4 flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"><Mail className="size-3.5" />{u.email}</a>}
                {owned.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-500" />{Math.round(owned.reduce((s, a) => s + a.progress, 0) / owned.length)}% average progress</div>}
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
      {users && <p className="text-center text-xs text-muted-foreground">Avatars are generated from initials; upload a photo in Settings → Profile.</p>}
    </div>
  );
}
