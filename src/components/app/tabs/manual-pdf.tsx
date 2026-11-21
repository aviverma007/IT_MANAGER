import * as React from "react";
import { BookOpenCheck, Download, FileDown, KeyRound, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppDetail, Attachment } from "@/core/types";
import { call, CAN_CAPTURE } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/bits";
import { Modal } from "@/components/ui/modal";
import { timeAgo } from "@/lib/utils";

type Available = { available: boolean; sections: number; needsLogin: boolean; loginNote: string };
type Built = { pictures: number; missed: string[]; sections: number };

/** "User manual (PDF)" card on the Docs tab: download the current PDF or make a new one from the live app. */
export function ManualPdfCard({ app }: { app: AppDetail }) {
  const qc = useQueryClient();
  const canEdit = app.permission === "edit";
  const pdf = app.attachments.find((f) => / – User manual\.pdf$/.test(f.name));
  const avail = useQuery({ queryKey: ["manual.available", app.id], queryFn: () => call<Available>("manual.available", { appId: app.id }), enabled: CAN_CAPTURE, staleTime: 600_000 });
  const [open, setOpen] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (!avail.data?.available && !pdf) return null;

  async function downloadPdf() {
    if (!pdf) return;
    try {
      const file = await call<Attachment>("files.get", { id: pdf.id });
      const a = document.createElement("a");
      a.href = file.dataUrl;
      a.download = file.name;
      a.click();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function build() {
    setBusy(true);
    const id = toast.loading(`Opening ${app.name} and capturing every screen — this takes a minute or two…`);
    try {
      const r = await call<Built>("manual.build", { appId: app.id, login: username && password ? { username, password } : undefined });
      setPassword("");
      await qc.invalidateQueries();
      const note = r.missed.length ? ` ${r.missed.length} section${r.missed.length > 1 ? "s" : ""} have steps only (screen not reached: ${r.missed.slice(0, 3).join(", ")}${r.missed.length > 3 ? "…" : ""}).` : "";
      toast.success(`Manual ready — ${r.sections} sections, ${r.pictures} pictures.${note}`, { id, duration: 9000 });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message, { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"><BookOpenCheck className="size-3.5" />User manual (PDF)</div>
      {pdf ? (
        <p className="mb-3 text-xs text-muted-foreground">Made {timeAgo(pdf.uploadedAt)} by {pdf.uploadedBy} · {(pdf.size / 1048576).toFixed(1)} MB</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">Step-by-step manual with pictures of every screen, made from the live app.</p>
      )}
      <div className="grid gap-2">
        {pdf && <Button size="sm" variant="primary" onClick={downloadPdf}><Download />Download PDF</Button>}
        {canEdit && avail.data?.available && (
          <Button size="sm" variant={pdf ? "secondary" : "primary"} onClick={() => setOpen(true)}>{pdf ? <RefreshCw /> : <FileDown />}{pdf ? "Make it again" : "Make PDF manual"}</Button>
        )}
      </div>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`Make the ${app.name} manual`} icon={<FileDown />} size="md"
        description={`IT Manager opens ${app.url || "the app"} in Edge, signs in, captures each of the ${avail.data?.sections ?? 0} sections and lays them out as a PDF.`}
        footer={<><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={build}><FileDown />Make PDF</Button></>}>
        <div className="grid gap-3">
          {avail.data?.needsLogin && (
            <div className="deboss rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4 text-primary" />Sign in to {app.name}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="off" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{avail.data.loginNote ? `${avail.data.loginNote} ` : ""}Used once to sign in for the pictures, then discarded — never saved or logged.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Screens that can't be reached keep their written steps without a picture. The PDF replaces the previous one in Files, and the text version is kept here as “User manual”.</p>
        </div>
      </Modal>
    </GlassCard>
  );
}
