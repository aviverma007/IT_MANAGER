import * as React from "react";
import { motion } from "motion/react";
import { KeyRound, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useApps, useRun, useUsers } from "@/api/hooks";
import { useMe } from "@/lib/auth";
import type { Role, User } from "@/core/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Avatar, GlassCard } from "@/components/ui/bits";
import { Modal, useConfirm } from "@/components/ui/modal";
import { cn, timeAgo } from "@/lib/utils";

const ROLE_INFO: Record<Role, string> = {
  admin: "Everything, including users, backups and every app's access.",
  editor: "Create applications and edit public ones (or any app they're granted edit on).",
  viewer: "Read-only, except apps where they're explicitly granted edit.",
};

export default function UsersPage() {
  const me = useMe();
  const run = useRun();
  const confirm = useConfirm();
  const { data: users } = useUsers();
  const { data: apps } = useApps();
  const [creating, setCreating] = React.useState(false);
  const [reset, setReset] = React.useState<User | null>(null);
  const [form, setForm] = React.useState({ username: "", name: "", email: "", password: "", role: "viewer" as Role, title: "", department: "" });
  const [pw, setPw] = React.useState("");

  async function create() {
    const res = await run("users.create", form, { success: `${form.name || form.username} added` });
    if (res) { setCreating(false); setForm({ username: "", name: "", email: "", password: "", role: "viewer", title: "", department: "" }); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-bold tracking-tight">Users & rights</h1><p className="text-sm text-muted-foreground">Accounts, roles and passwords. Per-application rights live in each app's Access tab.</p></div>
        <Button variant="primary" onClick={() => setCreating(true)}><UserPlus />Add user</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(ROLE_INFO) as Role[]).map((r, i) => (
          <motion.div key={r} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <GlassCard className="h-full p-4">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold capitalize">{r}</span><span className="text-2xl font-bold">{(users ?? []).filter((u) => u.role === r).length}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_INFO[r]}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">{["User", "Role", "Apps owned", "Last sign-in", "Active", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {(users ?? []).map((u, i) => {
              const self = u.id === me.id;
              return (
                <motion.tr key={u.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={cn("border-t border-border", !u.active && "opacity-55")}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar user={u} size={36} /><div className="min-w-0"><div className="font-semibold">{u.name} {self && <span className="text-xs text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">@{u.username}{u.email && ` · ${u.email}`}</div></div></div></td>
                  <td className="px-4 py-3 w-40">
                    <Select value={u.role} disabled={self} onChange={(e) => run("users.update", { id: u.id, role: e.target.value }, { success: `${u.name} is now ${e.target.value}` })} className="h-9">
                      <option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums">{(apps ?? []).filter((a) => a.ownerId === u.id).length}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{timeAgo(u.lastLoginAt)}</td>
                  <td className="px-4 py-3"><Switch checked={u.active} disabled={self} label="Active" onChange={(v) => run("users.update", { id: u.id, active: v }, { success: v ? `${u.name} re-activated` : `${u.name} deactivated` })} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setReset(u); setPw(""); }}><KeyRound />Reset password</Button>
                      {!self && <Button size="icon-sm" variant="ghost" aria-label="Delete user" onClick={async () => { if (await confirm({ title: `Delete ${u.name}?`, message: "Their apps stay; ownership is cleared. Consider deactivating instead to keep history readable.", confirm: "Delete user", danger: true })) void run("users.delete", { id: u.id }, { success: "User deleted" }); }}><Trash2 /></Button>}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={creating} onClose={() => setCreating(false)} title="Add user" icon={<Plus />} footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" onClick={create}>Create user</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Username *"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="firstname.lastname" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Temporary password *" hint="At least 6 characters"><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Job title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Role" className="sm:col-span-2" hint={ROLE_INFO[form.role]}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></Select>
          </Field>
        </div>
      </Modal>

      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset password · ${reset?.name ?? ""}`} icon={<ShieldCheck />} size="sm"
        footer={<><Button variant="ghost" onClick={() => setReset(null)}>Cancel</Button><Button variant="primary" disabled={pw.length < 6} onClick={async () => { if (reset && (await run("users.resetPassword", { id: reset.id, password: pw }, { success: "Password reset — they'll need to sign in again" }))) setReset(null); }}>Set password</Button></>}>
        <Field label="New password" hint="Signs the user out everywhere."><Input autoFocus value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
