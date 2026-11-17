import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Eye, File, FileArchive, FileImage, FileSpreadsheet, FileText, FileVideo, Trash2, UploadCloud } from "lucide-react";
import type { AppDetail, Attachment, AttachmentMeta } from "@/core/types";
import { useRun } from "@/api/hooks";
import { call } from "@/api/client";
import { Button } from "@/components/ui/button";
import { EmptyState, GlassCard } from "@/components/ui/bits";
import { Modal, useConfirm } from "@/components/ui/modal";
import { cn, fmtBytes, readAsDataUrl, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

function iconFor(f: AttachmentMeta) {
  if (f.type.startsWith("image/")) return FileImage;
  if (f.type.startsWith("video/")) return FileVideo;
  if (/sheet|excel|csv/.test(f.type) || /\.(xlsx?|csv)$/i.test(f.name)) return FileSpreadsheet;
  if (/zip|rar|7z|tar/.test(f.type)) return FileArchive;
  if (/pdf|word|text|document/.test(f.type)) return FileText;
  return File;
}

export function FilesTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const [drag, setDrag] = React.useState(false);
  const [uploading, setUploading] = React.useState<string[]>([]);
  const [preview, setPreview] = React.useState<Attachment | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    for (const file of [...files]) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} is larger than 8 MB.`); continue; }
      setUploading((u) => [...u, file.name]);
      const dataUrl = await readAsDataUrl(file);
      await run("files.upload", { appId: app.id, name: file.name, type: file.type, size: file.size, dataUrl }, { success: `Uploaded ${file.name}` });
      setUploading((u) => u.filter((n) => n !== file.name));
    }
  }

  async function fetchFile(id: string) {
    try { return await call<Attachment>("files.get", { id }); } catch (e) { toast.error((e as Error).message); return null; }
  }

  async function save(f: AttachmentMeta) {
    const file = await fetchFile(f.id);
    if (!file) return;
    const a = document.createElement("a");
    a.href = file.dataUrl;
    a.download = file.name;
    a.click();
  }

  return (
    <div className="flex flex-col gap-5">
      {canEdit && (
        <motion.label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
          animate={drag ? { scale: 1.015 } : { scale: 1 }}
          className={cn("glass flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors", drag ? "border-primary bg-primary/10" : "border-border hover:border-ring")}>
          <motion.div animate={drag ? { y: -8, rotate: -6 } : { y: 0, rotate: 0 }} className="emboss grid size-14 place-items-center rounded-2xl text-primary"><UploadCloud className="size-6" /></motion.div>
          <div className="text-sm font-semibold">Drop files or click to upload</div>
          <div className="text-xs text-muted-foreground">Any format — PDFs, Word manuals, Excel, screenshots, SQL scripts, zips · up to 8 MB each</div>
          <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ""; }} />
        </motion.label>
      )}

      <AnimatePresence>
        {uploading.map((n) => (
          <motion.div key={n} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="size-2 animate-ping rounded-full bg-primary" />Uploading {n}…
          </motion.div>
        ))}
      </AnimatePresence>

      {app.attachments.length === 0 ? (
        <EmptyState icon={<File />} title="No files yet" text="Keep the signed-off BRD, UAT sheets, PDFs of manuals, screenshots and scripts with the application." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {app.attachments.map((f, i) => {
              const Icon = iconFor(f);
              const viewable = f.type.startsWith("image/") || f.type === "application/pdf" || f.type.startsWith("text/");
              return (
                <motion.div key={f.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}>
                  <GlassCard className="group flex items-center gap-3 p-4">
                    <span className="emboss grid size-11 shrink-0 place-items-center rounded-xl text-primary"><Icon className="size-5" /></span>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={f.name}>{f.name}</div><div className="text-xs text-muted-foreground">{fmtBytes(f.size)} · {f.uploadedBy} · {timeAgo(f.uploadedAt)}</div></div>
                    <div className="flex">
                      {viewable && <Button size="icon-sm" variant="ghost" onClick={async () => setPreview(await fetchFile(f.id))} aria-label="Preview"><Eye /></Button>}
                      <Button size="icon-sm" variant="ghost" onClick={() => save(f)} aria-label="Download"><Download /></Button>
                      {canEdit && <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: `Delete ${f.name}?`, confirm: "Delete", danger: true })) void run("files.delete", { id: f.id }); }} aria-label="Delete"><Trash2 /></Button>}
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? ""} size="xl">
        {preview && (preview.type.startsWith("image/")
          ? <img src={preview.dataUrl} alt={preview.name} className="mx-auto max-h-[70vh] rounded-xl" />
          : <iframe src={preview.dataUrl} title={preview.name} className="h-[70vh] w-full rounded-xl border border-border bg-white" />)}
      </Modal>
    </div>
  );
}
