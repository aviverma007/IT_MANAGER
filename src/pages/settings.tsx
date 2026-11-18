import * as React from "react";
import { motion } from "motion/react";
import { Database, Download, FileSpreadsheet, ImagePlus, KeyRound, Moon, Palette, RotateCcw, Save, Server, Sun, Trash2, Upload, User as UserIcon } from "lucide-react";
import { useAuth, useMe } from "@/lib/auth";
import { useRun } from "@/api/hooks";
import { call, DEMO } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Avatar, GlassCard, SectionTitle } from "@/components/ui/bits";
import { useConfirm } from "@/components/ui/modal";
import { useTheme } from "@/components/app/shell";
import { downloadTemplate } from "@/components/app/import-wizard";
import { cn, download, imageToDataUrl, TONE_HEX } from "@/lib/utils";
import type { Tone } from "@/core/types";
import { toast } from "sonner";

export default function SettingsPage() {
  const me = useMe();
  const { refresh } = useAuth();
  const run = useRun();
  const confirm = useConfirm();
  const [theme, setTheme] = useTheme();
  const [p, setP] = React.useState({ name: me.name, email: me.email, title: me.title, department: me.department, bio: me.bio, avatar: me.avatar, tone: me.tone });
  const [pw, setPw] = React.useState({ current: "", next: "", confirm: "" });
  const avatarRef = React.useRef<HTMLInputElement>(null);
  const restoreRef = React.useRef<HTMLInputElement>(null);

  async function saveProfile() {
    if (await run("users.update", { id: me.id, ...p }, { success: "Profile saved" })) await refresh();
  }
  async function changePassword() {
    if (pw.next !== pw.confirm) { toast.error("New passwords don't match."); return; }
    if (await run("users.changePassword", { current: pw.current, next: pw.next }, { success: "Password changed" })) setPw({ current: "", next: "", confirm: "" });
  }
  async function backup() {
    try {
      const db = await call("admin.export");
      download(`it-manager-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), "application/json");
      toast.success("Backup downloaded");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function restore(file: File) {
    try {
      const db = JSON.parse(await file.text());
      if (!(await confirm({ title: "Restore this backup?", message: `This replaces ALL current data with ${file.name} (${db.apps?.length ?? 0} apps, ${db.users?.length ?? 0} users).`, confirm: "Restore", danger: true }))) return;
      if (await run("admin.import", { db }, { success: "Backup restored" })) await refresh();
    } catch (e) { toast.error(`Not a valid backup: ${(e as Error).message}`); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground">Your profile, password, appearance{me.role === "admin" && " and data management"}.</p></div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassCard className="p-6">
          <SectionTitle title="Profile" icon={<UserIcon />} sub="Shown on your badge in the Team page" />
          <div className="mb-5 flex items-center gap-4">
            <motion.div whileHover={{ scale: 1.05, rotate: -3 }}><Avatar user={{ id: me.id, name: p.name || me.name, tone: p.tone, avatar: p.avatar }} size={72} ring /></motion.div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => avatarRef.current?.click()}><ImagePlus />Upload photo</Button>
              {p.avatar && <Button size="sm" variant="ghost" onClick={() => setP({ ...p, avatar: "" })}>Use initials</Button>}
              <input ref={avatarRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setP({ ...p, avatar: await imageToDataUrl(f, 400) }); e.target.value = ""; }} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
            <Field label="Job title"><Input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></Field>
            <Field label="Department"><Input value={p.department} onChange={(e) => setP({ ...p, department: e.target.value })} /></Field>
            <Field label="Short bio (back of your badge)" className="sm:col-span-2"><Textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} className="min-h-20" /></Field>
            <Field label="Badge colour" className="sm:col-span-2">
              <div className="flex gap-3">{TONE_HEX.map((hex, i) => <motion.button key={hex} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={() => setP({ ...p, tone: (i + 1) as Tone })} aria-label={`Colour ${i + 1}`} className={cn("size-8 rounded-full shadow-[inset_0_2px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.25)]", p.tone === i + 1 && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: hex }} />)}</div>
            </Field>
          </div>
          <div className="mt-5 flex justify-end"><Button variant="primary" onClick={saveProfile}><Save />Save profile</Button></div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="p-6">
            <SectionTitle title="Password" icon={<KeyRound />} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Current"><Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
              <Field label="New"><Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
              <Field label="Confirm"><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            </div>
            <div className="mt-4 flex justify-end"><Button variant="secondary" disabled={!pw.current || pw.next.length < 6} onClick={changePassword}>Change password</Button></div>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionTitle title="Appearance" icon={<Palette />} />
            <div className="grid grid-cols-2 gap-3">
              {(["dark", "light"] as const).map((t) => (
                <motion.button key={t} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => setTheme(t)} className={cn("overflow-hidden rounded-2xl border-2 text-left transition-colors", theme === t ? "border-primary" : "border-border")}>
                  <div className={cn("h-20 p-3", t === "dark" ? "bg-[#14142a]" : "bg-[#f6f6fb]")}>
                    <div className={cn("h-2 w-16 rounded-full", t === "dark" ? "bg-white/30" : "bg-black/20")} />
                    <div className="mt-2 flex gap-1.5">{TONE_HEX.slice(0, 3).map((h) => <span key={h} className="h-6 w-8 rounded-md" style={{ background: h }} />)}</div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium capitalize">{t === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}{t}</div>
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Animations follow your operating system's “reduce motion” setting.</p>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionTitle title="Import templates" icon={<FileSpreadsheet />} sub="Excel files with the right columns. CSV, JSON or pasted tables work too." />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => downloadTemplate("apps")}><Download />Applications</Button>
              <Button size="sm" variant="secondary" onClick={() => downloadTemplate("tasks")}><Download />Tasks</Button>
              <Button size="sm" variant="secondary" onClick={() => downloadTemplate("usage")}><Download />Usage</Button>
            </div>
          </GlassCard>
        </div>
      </div>

      {me.role === "admin" && (
        <GlassCard className="p-6">
          <SectionTitle title="Data" icon={<Database />} sub={DEMO ? "Demo build — everything is stored in this browser's local storage." : "Stored by the server in server/data/db.json (a .bak copy is kept on every start)."} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { icon: Download, title: "Download backup", text: "Everything as one JSON file — apps, tasks, usage, docs, files, users, logs.", action: <Button variant="primary" onClick={backup}><Download />Backup</Button> },
              { icon: Upload, title: "Restore backup", text: "Replace all data with a backup file. You stay signed in.", action: <><Button variant="secondary" onClick={() => restoreRef.current?.click()}><Upload />Restore…</Button><input ref={restoreRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ""; }} /></> },
              { icon: RotateCcw, title: "Reload sample data", text: "Replace everything with the sample portfolio (handy for demos).", action: <Button variant="secondary" onClick={async () => { if (await confirm({ title: "Reload sample data?", message: "All current applications and logs are replaced.", confirm: "Reload", danger: true })) { await run("admin.reset", { mode: "sample" }, { success: "Sample data loaded" }); await refresh(); } }}><RotateCcw />Reload</Button> },
              { icon: RotateCcw, title: "Clear sample usage", text: "Delete the made-up / manual usage numbers and launch counts. Real data from the tracking script is kept.", action: <Button variant="secondary" onClick={async () => { if (await confirm({ title: "Clear sample usage?", message: "Removes every usage entry that wasn't recorded by the tracking script.", confirm: "Clear usage", danger: true })) await run("admin.clearUsage", {}, { success: "Sample usage cleared" }); }}><RotateCcw />Clear usage</Button> },
              { icon: Trash2, title: "Start fresh", text: "Delete all applications, tasks, usage and logs. Users are kept.", action: <Button variant="danger" onClick={async () => { if (await confirm({ title: "Delete all applications?", message: "Users stay. Everything else is removed. Download a backup first if unsure.", confirm: "Delete everything", danger: true })) await run("admin.reset", { mode: "empty" }, { success: "All application data cleared" }); }}><Trash2 />Clear data</Button> },
            ].map((c) => (
              <div key={c.title} className="deboss flex flex-col gap-3 rounded-2xl p-4">
                <c.icon className="size-5 text-primary" />
                <div><div className="text-sm font-semibold">{c.title}</div><div className="text-xs text-muted-foreground">{c.text}</div></div>
                <div className="mt-auto">{c.action}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Server className="size-3.5" />Mode: {DEMO ? "browser demo" : "server API"}</p>
        </GlassCard>
      )}
    </div>
  );
}
