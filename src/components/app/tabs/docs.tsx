import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Code2, Download, Edit3, Eye, FilePlus2, FileText, FileUp, HelpCircle, Printer, Save, Trash2, Wand2, X } from "lucide-react";
import type { AppDetail, Doc, DocKind } from "@/core/types";
import { DOC_KINDS } from "@/core/types";
import { useRun } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, GlassCard, Tabs } from "@/components/ui/bits";
import { useConfirm } from "@/components/ui/modal";
import { Markdown, htmlToMarkdown, tocOf } from "@/components/app/markdown";
import { manualTemplate, technicalTemplate } from "@/core/templates";
import { cn, download, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

const KIND_META: Record<DocKind, { label: string; icon: typeof BookOpen }> = {
  manual: { label: "User manual", icon: BookOpen },
  overview: { label: "Overview", icon: FileText },
  technical: { label: "Technical", icon: Code2 },
  faq: { label: "FAQ", icon: HelpCircle },
  other: { label: "Other", icon: FileText },
};

const FAQ_TEMPLATE = (name: string) => `# ${name} — FAQ\n\n## Access\n**How do I get access?**\nAsk IT to create your account and assign the right role.\n\n## Common problems\n**The page doesn't load.**\nPress Ctrl + F5. If it still fails, report it with a screenshot.\n`;

async function fileToMarkdown(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const lib = (mammoth as unknown as { default?: typeof mammoth }).default ?? mammoth;
    const { value } = await lib.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToMarkdown(value);
  }
  const textContent = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) return htmlToMarkdown(textContent);
  return textContent;
}

export function DocsTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const [selected, setSelected] = React.useState<string | null>(app.docs.find((d) => d.kind === "manual")?.id ?? app.docs[0]?.id ?? null);
  const [editing, setEditing] = React.useState<Partial<Doc> | null>(null);
  const [pane, setPane] = React.useState<"split" | "write" | "preview">("split");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const doc = app.docs.find((d) => d.id === selected) ?? null;

  React.useEffect(() => { if (!app.docs.some((d) => d.id === selected)) setSelected(app.docs[0]?.id ?? null); }, [app.docs, selected]);

  const toc = tocOf(editing ? editing.content ?? "" : doc?.content ?? "");

  async function save() {
    if (!editing) return;
    const res = await run<Doc>("docs.save", { appId: app.id, id: editing.id, title: editing.title, kind: editing.kind, content: editing.content }, { success: "Document saved" });
    if (res) { setSelected(res.id); setEditing(null); }
  }

  async function importFile(file: File) {
    try {
      const content = await fileToMarkdown(file);
      const title = file.name.replace(/\.[^.]+$/, "");
      const kind: DocKind = /manual|guide|sop|how/i.test(title) ? "manual" : /tech|arch|deploy/i.test(title) ? "technical" : /faq/i.test(title) ? "faq" : "other";
      setEditing({ title, kind, content });
      toast.success(`Converted ${file.name} — review and save`);
    } catch (e) {
      toast.error(`Couldn't read ${file.name}: ${(e as Error).message}`);
    }
  }

  const newDoc = (kind: DocKind) => setEditing({ kind, title: KIND_META[kind].label, content: kind === "manual" ? manualTemplate(app) : kind === "technical" ? technicalTemplate(app) : kind === "faq" ? FAQ_TEMPLATE(app.name) : `# ${app.name}\n\n` });

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-4">
        <GlassCard className="p-3">
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Documents</div>
          <div className="flex flex-col gap-1">
            {app.docs.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No documents yet.</p>}
            {app.docs.map((d) => {
              const Icon = KIND_META[d.kind].icon;
              return (
                <button key={d.id} onClick={() => { setSelected(d.id); setEditing(null); }} className={cn("relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm", selected === d.id && !editing ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {selected === d.id && !editing && <motion.span layoutId="doc-sel" className="emboss absolute inset-0 -z-10 rounded-xl border border-border" />}
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.title}</span><span className="block text-[11px] text-muted-foreground">{KIND_META[d.kind].label} · {timeAgo(d.updatedAt)}</span></span>
                </button>
              );
            })}
          </div>
          {canEdit && (
            <div className="mt-3 grid gap-2 border-t border-border pt-3">
              <Select onChange={(e) => { if (e.target.value) { newDoc(e.target.value as DocKind); e.target.value = ""; } }} defaultValue="" className="h-9 text-xs">
                <option value="" disabled>+ New document from template…</option>
                {DOC_KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
              </Select>
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}><FileUp />Import .docx / .md / .html / .txt</Button>
              <input ref={fileRef} type="file" hidden accept=".md,.markdown,.txt,.docx,.html,.htm" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ""; }} />
            </div>
          )}
        </GlassCard>

        {toc.length > 0 && !editing && (
          <GlassCard className="sticky top-40 hidden p-4 lg:block">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">On this page</div>
            <nav className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
              {toc.map((h, i) => (
                <a key={i} href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className={cn("truncate rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground", h.level === 3 && "pl-5")}>{h.text}</a>
              ))}
            </nav>
          </GlassCard>
        )}
      </aside>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            <GlassCard className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="h-11 min-w-48 flex-1 text-base font-semibold" placeholder="Document title" />
                <div className="w-40"><Select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as DocKind })}>{DOC_KINDS.map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}</Select></div>
                <Tabs id="pane" value={pane} onChange={setPane} tabs={[{ value: "write", label: "Write", icon: <Edit3 /> }, { value: "split", label: "Split" }, { value: "preview", label: "Preview", icon: <Eye /> }]} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, content: manualTemplate(app) })}><Wand2 />User-manual template</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, content: technicalTemplate(app) })}><Code2 />Technical template</Button>
                <span className="ml-auto self-center text-muted-foreground">Markdown · # headings, **bold**, - lists, | tables |, ![image](url)</span>
              </div>
              <div className={cn("grid gap-4", pane === "split" && "lg:grid-cols-2")}>
                {pane !== "preview" && <Textarea value={editing.content ?? ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="min-h-[60vh] font-mono text-[13px] leading-6" spellCheck />}
                {pane !== "write" && <div className="deboss max-h-[60vh] min-h-[60vh] overflow-y-auto rounded-xl p-5"><Markdown source={editing.content ?? ""} /></div>}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}><X />Cancel</Button>
                <Button variant="primary" onClick={save}><Save />Save document</Button>
              </div>
            </GlassCard>
          </motion.div>
        ) : doc ? (
          <motion.div key={doc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GlassCard className="p-6 md:p-10">
              <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-4">
                <span className="text-xs text-muted-foreground">{KIND_META[doc.kind].label} · updated {timeAgo(doc.updatedAt)} by {doc.updatedBy}</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => download(`${app.code || app.name}-${doc.title}.md`, doc.content, "text/markdown")}><Download />.md</Button>
                  <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer />Print / PDF</Button>
                  {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing(doc)}><Edit3 />Edit</Button>}
                  {canEdit && <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Delete “${doc.title}”?`, confirm: "Delete", danger: true })) void run("docs.delete", { id: doc.id }, { success: "Document deleted" }); }} aria-label="Delete"><Trash2 /></Button>}
                </div>
              </div>
              <div className="print-area mx-auto max-w-3xl"><Markdown source={doc.content} /></div>
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <EmptyState icon={<BookOpen />} title="No documentation yet" text="Start from the user-manual template — it already has sections for getting started, step-by-step tasks, roles and FAQ."
              action={canEdit ? <div className="flex gap-2"><Button variant="primary" onClick={() => newDoc("manual")}><FilePlus2 />Write user manual</Button><Button variant="secondary" onClick={() => fileRef.current?.click()}><FileUp />Import</Button></div> : undefined} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
