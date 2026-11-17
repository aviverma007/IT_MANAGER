import * as React from "react";
import { motion } from "motion/react";
import { Edit3, Plus, Rocket, Trash2 } from "lucide-react";
import type { AppDetail, Release } from "@/core/types";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, GlassCard } from "@/components/ui/bits";
import { Modal, useConfirm } from "@/components/ui/modal";
import { Markdown } from "@/components/app/markdown";
import { fmtDate, toneHex } from "@/lib/utils";

export function ReleasesTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const color = toneHex(app.tone);
  const [form, setForm] = React.useState<(Partial<Release> & { setCurrent?: boolean }) | null>(null);

  async function save() {
    if (!form) return;
    const res = await run("releases.save", { appId: app.id, ...form }, { success: "Release saved" });
    if (res) setForm(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Release history and change notes. Current version: <b className="text-foreground">{app.version ? `v${app.version}` : "not set"}</b></p>
        {canEdit && <Button variant="primary" onClick={() => setForm({ version: "", date: new Date().toISOString().slice(0, 10), title: "", notes: "- ", setCurrent: true })}><Plus />New release</Button>}
      </div>
      {app.releases.length === 0 ? (
        <EmptyState icon={<Rocket />} title="No releases yet" text="Record each deployment with its version and what changed — handy for users and for audits." />
      ) : (
        <div className="relative pl-8">
          <motion.span aria-hidden className="absolute left-3 top-2 w-0.5 rounded-full" style={{ background: `linear-gradient(${color}, transparent)` }} initial={{ height: 0 }} animate={{ height: "calc(100% - 1rem)" }} transition={{ duration: 1, ease: "easeOut" }} />
          {app.releases.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, type: "spring", stiffness: 220, damping: 24 }} className="relative mb-5">
              <motion.span className="absolute -left-[26px] top-6 size-4 rounded-full border-4 border-background" style={{ background: color, boxShadow: `0 0 0 4px color-mix(in oklab, ${color} 25%, transparent), 0 0 18px ${color}` }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + i * 0.08, type: "spring" }} />
              <GlassCard className="group p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl px-3 py-1 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]" style={{ background: color }}>v{r.version}</span>
                  <span className="font-semibold">{r.title}</span>
                  {app.version === r.version && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">current</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(r.date)}</span>
                  {canEdit && <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon-sm" variant="ghost" onClick={() => setForm(r)} aria-label="Edit"><Edit3 /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Delete release v${r.version}?`, confirm: "Delete", danger: true })) void run("releases.delete", { id: r.id }); }} aria-label="Delete"><Trash2 /></Button>
                  </div>}
                </div>
                {r.notes && <div className="mt-3 text-sm"><Markdown source={r.notes} /></div>}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit release" : "New release"} icon={<Rocket />} footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save release</Button></>}>
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Version *"><Input autoFocus value={form.version ?? ""} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="2.5.0" /></Field>
            <Field label="Release date"><Input type="date" value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Title" className="sm:col-span-2"><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Month-end reports" /></Field>
            <Field label="What changed (markdown)" className="sm:col-span-2"><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-36 font-mono text-[13px]" /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!form.setCurrent} onChange={(e) => setForm({ ...form, setCurrent: e.target.checked })} className="size-4 accent-[var(--chart-1)]" />Set as the application's current version</label>
          </div>
        )}
      </Modal>
    </div>
  );
}
