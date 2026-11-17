import * as React from "react";
import { motion } from "motion/react";
import { Eye, Globe, Lock, PenLine, Save, Shield } from "lucide-react";
import type { Access, AppDetail, User } from "@/core/types";
import { useRun, useUsers } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Avatar, GlassCard, SectionTitle } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

type Choice = "default" | Access | "none";

/** Mirrors Service.permission() so the screen can show what each person will end up with. */
function effective(user: User, app: AppDetail, visibility: string, grant: Access | undefined): Access | null {
  if (user.role === "admin") return "edit";
  if (grant) return grant;
  if (app.ownerId === user.id || app.createdBy === user.id) return user.role === "viewer" ? "view" : "edit";
  if (visibility === "restricted") return null;
  return user.role === "editor" ? "edit" : "view";
}

export function AccessTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const { data: users } = useUsers();
  const canEdit = app.permission === "edit";
  const [visibility, setVisibility] = React.useState(app.visibility);
  const [acl, setAcl] = React.useState<Record<string, Access>>(app.acl);
  React.useEffect(() => { setVisibility(app.visibility); setAcl(app.acl); }, [app.visibility, app.acl]);
  const dirty = visibility !== app.visibility || JSON.stringify(acl) !== JSON.stringify(app.acl);

  const set = (id: string, c: Choice) => setAcl((a) => {
    const next = { ...a };
    if (c === "edit" || c === "view") next[id] = c; else delete next[id];
    return next;
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <GlassCard className="p-5">
        <SectionTitle title="People and rights" sub="Grant edit or view rights per person. “Default” follows their role and the visibility setting." icon={<Shield />} />
        <div className="divide-y divide-border">
          {(users ?? []).map((u, i) => {
            const grant = acl[u.id];
            const eff = effective(u, app, visibility, grant);
            const locked = u.role === "admin";
            return (
              <motion.div key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar user={u} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.name}{app.ownerId === u.id && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">owner</span>}</div>
                  <div className="text-xs capitalize text-muted-foreground">{u.role} · {u.department || u.title}</div>
                </div>
                <div className="deboss inline-flex rounded-xl p-1">
                  {(["default", "view", "edit"] as const).map((c) => {
                    const active = (grant ?? "default") === c;
                    return (
                      <button key={c} disabled={!canEdit || locked} onClick={() => set(u.id, c)}
                        className={cn("relative rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors disabled:cursor-not-allowed", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        {active && <motion.span layoutId={`acl-${u.id}`} className="emboss absolute inset-0 -z-10 rounded-lg border border-border" />}
                        {c}
                      </button>
                    );
                  })}
                </div>
                <span className={cn("inline-flex w-24 items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", eff === "edit" ? "bg-emerald-500/15 text-emerald-500" : eff === "view" ? "bg-sky-500/15 text-sky-500" : "bg-rose-500/15 text-rose-400")}>
                  {eff === "edit" ? <PenLine className="size-3" /> : eff === "view" ? <Eye className="size-3" /> : <Lock className="size-3" />}{eff ?? "no access"}
                </span>
              </motion.div>
            );
          })}
        </div>
      </GlassCard>

      <div className="flex flex-col gap-5">
        <GlassCard className="p-5">
          <SectionTitle title="Visibility" />
          <div className="grid gap-2">
            {([["public", Globe, "Everyone", "All users can see it. Editors can edit, viewers can view."], ["restricted", Lock, "Restricted", "Only admins, the owner and people granted access above."]] as const).map(([v, Icon, label, text]) => (
              <button key={v} disabled={!canEdit} onClick={() => setVisibility(v)}
                className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed", visibility === v ? "emboss border-ring" : "border-border hover:border-ring")}>
                <Icon className={cn("mt-0.5 size-5", visibility === v ? "text-primary" : "text-muted-foreground")} />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{text}</span></span>
              </button>
            ))}
          </div>
          {canEdit && <Button variant="primary" className="mt-4 w-full" disabled={!dirty} onClick={() => run("apps.access", { id: app.id, visibility, acl }, { success: "Access rights saved" })}><Save />Save access</Button>}
          {!canEdit && <p className="mt-3 text-xs text-muted-foreground">You have view-only rights, so you can't change access.</p>}
        </GlassCard>
        <GlassCard className="p-5 text-xs leading-relaxed text-muted-foreground">
          <div className="mb-2 text-sm font-semibold text-foreground">How rights work</div>
          <ul className="list-disc space-y-1 pl-4">
            <li><b className="text-foreground">Admins</b> can always edit everything.</li>
            <li><b className="text-foreground">Edit</b> lets a person change details, tasks, usage, docs, releases and files.</li>
            <li><b className="text-foreground">View</b> is read-only, including for editors.</li>
            <li>Every change here is recorded in the audit log.</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
