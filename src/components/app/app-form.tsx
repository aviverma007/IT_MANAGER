import * as React from "react";
import { motion } from "motion/react";
import { AppWindow, ImagePlus, Link2, Plus, Trash2, Wand2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/bits";
import { useApps, useRun, useUsers } from "@/api/hooks";
import { APP_STATUSES, PRIORITIES, type AppSummary, type EnvLink, type Tone } from "@/core/types";
import { cn, imageToDataUrl, STATUS_META, TONE_HEX } from "@/lib/utils";
import { coverFor } from "@/lib/covers";
import { toast } from "sonner";
import { call, CAN_CAPTURE } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";

type Form = {
  name: string; code: string; tagline: string; description: string; category: string; department: string; status: string; priority: string;
  url: string; repoUrl: string; environments: EnvLink[]; techStack: string; ownerId: string; version: string; startDate: string; goLiveDate: string;
  tone: Tone; cover: string; visibility: "public" | "restricted"; withTemplate: boolean;
};

const blank = (): Form => ({
  name: "", code: "", tagline: "", description: "", category: "", department: "", status: "planning", priority: "medium", url: "", repoUrl: "",
  environments: [], techStack: "", ownerId: "", version: "", startDate: new Date().toISOString().slice(0, 10), goLiveDate: "", tone: 1, cover: "",
  visibility: "public", withTemplate: true,
});

function fromApp(a: AppSummary): Form {
  return {
    name: a.name, code: a.code, tagline: a.tagline, description: a.description, category: a.category, department: a.department, status: a.status,
    priority: a.priority, url: a.url, repoUrl: a.repoUrl, environments: a.environments, techStack: a.techStack.join(", "), ownerId: a.ownerId ?? "",
    version: a.version, startDate: a.startDate, goLiveDate: a.goLiveDate, tone: a.tone, cover: a.cover, visibility: a.visibility, withTemplate: false,
  };
}

export function AppFormModal({ open, onClose, app, onSaved }: { open: boolean; onClose: () => void; app?: AppSummary; onSaved?: (id: string) => void }) {
  const run = useRun();
  const qc = useQueryClient();
  const { data: users } = useUsers();
  const { data: apps } = useApps();
  const [form, setForm] = React.useState<Form>(blank);
  const [tab, setTab] = React.useState<"basics" | "links" | "look">("basics");
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (open) { setForm(app ? fromApp(app) : blank()); setTab("basics"); } }, [open, app]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const categories = [...new Set((apps ?? []).map((a) => a.category).filter(Boolean))];
  const departments = [...new Set((apps ?? []).map((a) => a.department).filter(Boolean))];

  async function save() {
    if (!form.name.trim()) { setTab("basics"); toast.error("Give the application a name."); return; }
    setBusy(true);
    const payload = { ...form, ownerId: form.ownerId || null, environments: form.environments.filter((e) => e.url.trim()) };
    const res = app
      ? await run<AppSummary>("apps.update", { id: app.id, ...payload }, { success: "Application updated" })
      : await run<AppSummary>("apps.create", payload, { success: `${form.name} added` });
    setBusy(false);
    if (res) {
      onClose();
      onSaved?.(res.id);
      // New or changed link and no real screenshot yet → grab one from the live app in the background.
      const linkChanged = form.url.trim() && form.url !== (app?.url ?? "");
      if (CAN_CAPTURE && linkChanged && !res.shotCount && res.url) {
        const id = toast.loading(`Taking a screenshot of ${res.name}…`);
        call("apps.capture", { id: res.id, setCover: true })
          .then(() => { toast.success(`Screenshot of ${res.name} saved`, { id }); return qc.invalidateQueries(); })
          .catch((e: Error) => toast.error(e.message, { id, description: "Add one from the Screens tab instead." }));
      }
    }
  }

  const preview = coverFor({ id: app?.id ?? "new", name: form.name || "New app", code: form.code, tone: form.tone, cover: form.cover }, 400, 500);

  return (
    <Modal open={open} onClose={onClose} title={app ? `Edit ${app.name}` : "New application"} description="Everything here can be changed later." icon={<AppWindow />} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={busy} onClick={save}>{app ? "Save changes" : "Create application"}</Button>
      </>}>
      <Tabs id="app-form" value={tab} onChange={setTab} tabs={[{ value: "basics", label: "Basics" }, { value: "links", label: "Links & stack" }, { value: "look", label: "Look & access" }]} className="mb-5" />
      <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        {tab === "basics" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Application name *" className="sm:col-span-2"><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. SmartDesk" /></Field>
            <Field label="Short code" hint="Used to match rows when importing"><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="SMARTDESK" /></Field>
            <Field label="Version"><Input value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="1.0.0" /></Field>
            <Field label="Tagline" className="sm:col-span-2"><Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="One line on what it does" /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Who uses it, what problem it solves…" /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>{APP_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p[0]!.toUpperCase() + p.slice(1)}</option>)}</Select>
            </Field>
            <Field label="Category">
              <Input list="itm-categories" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Finance & billing" />
              <datalist id="itm-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Business department">
              <Input list="itm-departments" value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Accounts" />
              <datalist id="itm-departments">{departments.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Owner">
              <Select value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
                <option value="">— No owner —</option>
                {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="Go-live date"><Input type="date" value={form.goLiveDate} onChange={(e) => set("goLiveDate", e.target.value)} /></Field>
            </div>
            {!app && (
              <label className="deboss flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.withTemplate} onChange={(e) => set("withTemplate", e.target.checked)} className="size-4 accent-[var(--chart-1)]" />
                <Wand2 className="size-4 text-primary" />
                Start with a standard task checklist (planning → development → UAT → go-live)
              </label>
            )}
          </div>
        )}

        {tab === "links" && (
          <div className="grid gap-4">
            <Field label="Application link (opens from IT Manager)" hint="Every open is counted as a launch in the usage stats."><Input value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://smartdesk.company.local" /></Field>
            <Field label="Source repository"><Input value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} placeholder="https://github.com/org/repo" /></Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Other environments</span>
                <Button size="sm" variant="ghost" onClick={() => set("environments", [...form.environments, { label: form.environments.length ? "UAT" : "UAT", url: "" }])}><Plus />Add link</Button>
              </div>
              <div className="flex flex-col gap-2">
                {form.environments.length === 0 && <p className="deboss rounded-xl p-3 text-xs text-muted-foreground">UAT, admin panel, API docs, Power BI report… add as many links as you need.</p>}
                {form.environments.map((env, i) => (
                  <motion.div key={i} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <Input className="w-36" value={env.label} onChange={(e) => set("environments", form.environments.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" />
                    <Input value={env.url} onChange={(e) => set("environments", form.environments.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} placeholder="https://" />
                    <Button variant="ghost" size="icon" onClick={() => set("environments", form.environments.filter((_, k) => k !== i))} aria-label="Remove link"><Trash2 /></Button>
                  </motion.div>
                ))}
              </div>
            </div>
            <Field label="Tech stack" hint="Comma separated"><Input value={form.techStack} onChange={(e) => set("techStack", e.target.value)} placeholder="React, Node.js, SQL Server" /></Field>
          </div>
        )}

        {tab === "look" && (
          <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
            <div>
              <motion.img key={preview.slice(-40)} initial={{ opacity: 0, scale: 0.95, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} src={preview} alt="Cover preview" className="aspect-[4/5] w-full rounded-2xl border border-border object-cover shadow-xl" />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set("cover", await imageToDataUrl(f)); e.target.value = ""; }} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}><ImagePlus />Upload</Button>
                {form.cover && <Button size="sm" variant="ghost" onClick={() => set("cover", "")}>Reset</Button>}
              </div>
            </div>
            <div className="grid content-start gap-5">
              <Field label="Accent colour">
                <div className="flex gap-3">
                  {TONE_HEX.map((hex, i) => (
                    <motion.button key={hex} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} onClick={() => set("tone", (i + 1) as Tone)} aria-label={`Colour ${i + 1}`}
                      className={cn("size-9 rounded-full shadow-[inset_0_2px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.25)]", form.tone === i + 1 && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: hex }} />
                  ))}
                </div>
              </Field>
              <Field label="Fallback cover image link" hint="Only used when the app has no screenshots yet."><Input value={form.cover.startsWith("data:") ? "(uploaded image)" : form.cover} onChange={(e) => set("cover", e.target.value)} placeholder="https://images.unsplash.com/…" disabled={form.cover.startsWith("data:")} /></Field>
              {!app && (
                <Field label="Visibility" hint="Restricted apps are only visible to admins, the owner and people you grant access to.">
                  <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value as Form["visibility"])}>
                    <option value="public">Everyone can see it (editors can edit)</option>
                    <option value="restricted">Restricted — invited people only</option>
                  </Select>
                </Field>
              )}
              <p className="deboss flex items-start gap-2 rounded-xl p-3 text-xs text-muted-foreground"><Link2 className="mt-0.5 size-4 shrink-0" />Real screenshots (upload, paste or capture from the link) live in the app's <b className="text-foreground">Screens</b> tab — the starred one becomes the cover everywhere. </p>
              <p className="deboss flex items-start gap-2 rounded-xl p-3 text-xs text-muted-foreground"><Link2 className="mt-0.5 size-4 shrink-0" />Fine-grained edit / view rights per person are set in the application's <b className="text-foreground">Access</b> tab.</p>
            </div>
          </div>
        )}
      </motion.div>
    </Modal>
  );
}
