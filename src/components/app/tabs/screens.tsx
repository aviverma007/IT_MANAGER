import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, Camera, ChevronLeft, ChevronRight, ClipboardPaste, Download, Edit3, ImagePlus, KeyRound, Monitor, Smartphone, Star, Tablet, Trash2, X,
} from "lucide-react";
import type { AppDetail, ScreenshotMeta } from "@/core/types";
import { useRun } from "@/api/hooks";
import { call, CAN_CAPTURE, shotSrc } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { EmptyState, GlassCard } from "@/components/ui/bits";
import { Modal, useConfirm } from "@/components/ui/modal";
import { cn, imageToShot, timeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const VIEWPORTS = [
  { key: "desktop", label: "Desktop", w: 1440, h: 900, icon: Monitor },
  { key: "laptop", label: "Laptop", w: 1280, h: 800, icon: Monitor },
  { key: "tablet", label: "Tablet", w: 820, h: 1180, icon: Tablet },
  { key: "mobile", label: "Mobile", w: 390, h: 844, icon: Smartphone },
] as const;

/** A browser-window frame around a screenshot, so a screen reads as "the app" at a glance. */
export function BrowserFrame({ src, url, className, children }: { src: string; url?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/15 bg-[#0d0d18] shadow-2xl", className)}>
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/5 px-3 py-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" /><span className="size-2.5 rounded-full bg-[#febc2e]" /><span className="size-2.5 rounded-full bg-[#28c840]" />
        {url && <span className="ml-3 truncate rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">{url.replace(/^https?:\/\//, "")}</span>}
      </div>
      <img src={src} alt="" className="block w-full" draggable={false} />
      {children}
    </div>
  );
}

function CaptureDialog({ app, open, onClose }: { app: AppDetail; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = React.useState(app.url);
  const [pages, setPages] = React.useState("");
  const [vp, setVp] = React.useState<(typeof VIEWPORTS)[number]["key"]>("desktop");
  const [fullPage, setFullPage] = React.useState(false);
  const [delay, setDelay] = React.useState("1.5");
  const [login, setLogin] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [cover, setCover] = React.useState(!app.screenshots.length);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (open) { setUrl(app.url); setCover(!app.screenshots.length); setPassword(""); } }, [open, app.url, app.screenshots.length]);

  async function go() {
    const v = VIEWPORTS.find((x) => x.key === vp)!;
    setBusy(true);
    const id = toast.loading(`Opening ${url} in a headless browser…`);
    try {
      const res = await call<{ shots: ScreenshotMeta[] }>("apps.capture", {
        id: app.id, url, width: v.w, height: v.h, fullPage, delay: Math.round(parseFloat(delay || "0") * 1000), setCover: cover,
        pages: pages.split(/\n|,/).map((x) => x.trim()).filter(Boolean), login: login ? { username, password } : undefined,
      });
      await qc.invalidateQueries();
      toast.success(`Captured ${res.shots.length} screenshot${res.shots.length > 1 ? "s" : ""}`, { id });
      setPassword("");
      onClose();
    } catch (e) {
      toast.error((e as Error).message, { id });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Capture from the live application" description="The IT Manager server opens the link in Edge/Chrome and saves exactly what users see." icon={<Camera />} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} disabled={!/^https?:/i.test(url)} onClick={go}><Camera />Capture</Button></>}>
      <div className="grid gap-4">
        <Field label="Link to capture"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://smartdesk.company.local" /></Field>
        <Field label="More pages (optional)" hint="One per line — paths like /dashboard or full links. Each becomes its own screenshot, in the same signed-in session.">
          <Textarea value={pages} onChange={(e) => setPages(e.target.value)} className="min-h-20 font-mono text-xs" placeholder={"/dashboard\n/reports"} />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Screen size</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VIEWPORTS.map((v) => (
              <button key={v.key} onClick={() => setVp(v.key)} className={cn("relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs", vp === v.key ? "emboss border-ring" : "border-border text-muted-foreground hover:border-ring")}>
                <v.icon className="size-4" /><span><span className="block font-semibold text-foreground">{v.label}</span>{v.w}×{v.h}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="deboss flex items-center justify-between gap-3 rounded-xl p-3 text-sm">Whole page (scroll)<Switch checked={fullPage} onChange={setFullPage} label="Full page" /></label>
          <label className="deboss flex items-center justify-between gap-3 rounded-xl p-3 text-sm">Use as cover<Switch checked={cover} onChange={setCover} label="Set as cover" /></label>
          <label className="deboss flex items-center gap-2 rounded-xl p-3 text-sm">Wait<Input type="number" min={0} max={15} step={0.5} value={delay} onChange={(e) => setDelay(e.target.value)} className="h-8 w-16" />sec</label>
        </div>
        <div className="deboss rounded-2xl p-4">
          <label className="flex items-center justify-between gap-3 text-sm font-medium"><span className="flex items-center gap-2"><KeyRound className="size-4 text-primary" />Sign in before capturing</span><Switch checked={login} onChange={setLogin} label="Sign in" /></label>
          <AnimatePresence>
            {login && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="off" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Used once to fill the app's login form, then discarded — never saved or logged. Use a read-only test account where possible.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}

function Lightbox({ app, index, onIndex, onClose }: { app: AppDetail; index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
  const shots = app.screenshots;
  const shot = index === null ? null : shots[index];
  const [dir, setDir] = React.useState(1);
  React.useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") { setDir(1); onIndex((index + 1) % shots.length); }
      if (e.key === "ArrowLeft") { setDir(-1); onIndex((index - 1 + shots.length) % shots.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, shots.length, onIndex, onClose]);
  return (
    <AnimatePresence>
      {shot && index !== null && (
        <motion.div className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center gap-3 p-4 text-white">
            <span className="font-mono text-xs text-white/60">{index + 1} / {shots.length}</span>
            <span className="truncate text-sm font-medium">{shot.caption || app.name}</span>
            {shot.url && <span className="hidden truncate font-mono text-xs text-white/50 md:inline">{shot.url}</span>}
            <a href={shotSrc(shot.id)} download={`${app.code || app.name}-${index + 1}.jpg`} className="ml-auto"><Button variant="ghost" size="icon" className="!text-white" aria-label="Download"><Download /></Button></a>
            <Button variant="ghost" size="icon" className="!text-white" onClick={onClose} aria-label="Close"><X /></Button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4 md:px-20">
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.img
                key={shot.id} src={shotSrc(shot.id)} alt={shot.caption} custom={dir}
                variants={{ enter: (d: number) => ({ x: d * 120, opacity: 0, scale: 0.94 }), center: { x: 0, opacity: 1, scale: 1 }, exit: (d: number) => ({ x: d * -120, opacity: 0, scale: 0.94 }) }}
                initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 32 }}
                drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 80) { const d = info.offset.x < 0 ? 1 : -1; setDir(d); onIndex((index + d + shots.length) % shots.length); } }}
                className="max-h-full max-w-full cursor-grab rounded-xl object-contain shadow-2xl active:cursor-grabbing"
              />
            </AnimatePresence>
            {shots.length > 1 && <>
              <button onClick={() => { setDir(-1); onIndex((index - 1 + shots.length) % shots.length); }} className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20" aria-label="Previous"><ChevronLeft /></button>
              <button onClick={() => { setDir(1); onIndex((index + 1) % shots.length); }} className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20" aria-label="Next"><ChevronRight /></button>
            </>}
          </div>
          <div className="flex justify-center gap-2 overflow-x-auto p-4 pt-0">
            {shots.map((s, i) => (
              <button key={s.id} onClick={() => { setDir(i > index ? 1 : -1); onIndex(i); }} className={cn("h-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all", i === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80")}>
                <img src={shotSrc(s.id)} alt="" className="h-full w-auto" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ScreensTab({ app }: { app: AppDetail }) {
  const run = useRun();
  const confirm = useConfirm();
  const canEdit = app.permission === "edit";
  const [capturing, setCapturing] = React.useState(false);
  const [viewing, setViewing] = React.useState<number | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(0);
  const [captionFor, setCaptionFor] = React.useState<ScreenshotMeta | null>(null);
  const [caption, setCaption] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);
  const coverId = app.coverShot?.id;

  const add = React.useCallback(async (files: (File | Blob)[], source: "upload" | "paste") => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) { toast.error("Those files aren't images."); return; }
    setBusy((b) => b + images.length);
    for (const f of images) {
      try {
        const shot = await imageToShot(f);
        await run("shots.add", { appId: app.id, ...shot, source, caption: f instanceof File ? f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") : "" });
      } catch (e) {
        toast.error((e as Error).message);
      }
      setBusy((b) => b - 1);
    }
    toast.success(`${images.length} screenshot${images.length > 1 ? "s" : ""} added`);
  }, [app.id, run]);

  // Win + Shift + S (or Cmd + Shift + 4) then Ctrl/⌘ + V anywhere on this tab
  React.useEffect(() => {
    if (!canEdit) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter(Boolean) as File[];
      if (files.length) { e.preventDefault(); void add(files, "paste"); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add, canEdit]);

  return (
    <div className="flex flex-col gap-5">
      <GlassCard className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Real screens of {app.name}</div>
          <div className="text-xs text-muted-foreground">The cover image is used on cards, the app wall and this page's header. {canEdit && <>Paste with <kbd className="rounded border border-border px-1">Ctrl</kbd>+<kbd className="rounded border border-border px-1">V</kbd> after a Win+Shift+S snip.</>}</div>
        </div>
        {canEdit && <>
          <Button variant="secondary" onClick={() => input.current?.click()}><ImagePlus />Upload</Button>
          <Button variant="primary" onClick={() => (CAN_CAPTURE ? setCapturing(true) : toast.info("Capture runs on the IT Manager server. It isn't available in this browser-only preview — upload or paste instead."))} disabled={!app.url && CAN_CAPTURE} title={app.url ? "" : "Set the app's link first"}><Camera />Capture from link</Button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void add([...e.target.files], "upload"); e.target.value = ""; }} />
        </>}
      </GlassCard>

      {canEdit && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void add([...e.dataTransfer.files], "upload"); }}
          animate={drag ? { scale: 1.01 } : { scale: 1 }}
          className={cn("rounded-3xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground transition-colors", drag ? "border-primary bg-primary/10 text-foreground" : "border-border")}
        >
          <ClipboardPaste className="mr-2 inline size-4" />Drop screenshots here · paste from clipboard · or capture straight from the live link
          {busy > 0 && <span className="ml-3 inline-flex items-center gap-2 text-primary"><span className="size-2 animate-ping rounded-full bg-primary" />Saving {busy}…</span>}
        </motion.div>
      )}

      {app.screenshots.length === 0 ? (
        <EmptyState icon={<Camera />} title="No screenshots yet"
          text={canEdit ? "Add the real screens of this application — the login page, dashboard, key forms and reports. They also make the user manual easier to follow." : "Nobody has added screenshots of this application yet."}
          action={canEdit ? <div className="flex flex-wrap justify-center gap-2"><Button variant="primary" onClick={() => (CAN_CAPTURE ? setCapturing(true) : input.current?.click())}><Camera />{CAN_CAPTURE ? "Capture from link" : "Upload screenshots"}</Button></div> : undefined} />
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence>
            {app.screenshots.map((s, i) => (
              <motion.figure key={s.id} layout initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: Math.min(i, 8) * 0.05, type: "spring", stiffness: 240, damping: 26 }}
                className="group relative">
                <motion.button whileHover={{ y: -4 }} onClick={() => setViewing(i)} className="block w-full text-left" aria-label={`View ${s.caption || "screenshot"}`}>
                  <BrowserFrame src={shotSrc(s.id)} url={s.url || app.url} className="transition-shadow group-hover:shadow-[0_20px_60px_-15px_var(--chart-1)]" />
                </motion.button>
                {coverId === s.id && <span className="absolute left-3 top-11 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-black shadow-lg"><Star className="size-3 fill-current" />Cover</span>}
                <figcaption className="mt-2 flex items-center gap-2 px-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.caption || <span className="text-muted-foreground">Untitled screen</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{s.source === "capture" ? "Captured" : s.source === "paste" ? "Pasted" : "Uploaded"} by {s.createdBy} · {timeAgo(s.createdAt)} · {s.width}×{s.height}</div>
                  </div>
                  {canEdit && (
                    <div className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      {coverId !== s.id && <Button size="icon-sm" variant="ghost" onClick={() => run("shots.cover", { id: s.id }, { success: "Cover updated" })} aria-label="Set as cover" title="Set as cover"><Star /></Button>}
                      <Button size="icon-sm" variant="ghost" onClick={() => { setCaptionFor(s); setCaption(s.caption); }} aria-label="Caption"><Edit3 /></Button>
                      <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => run("shots.move", { id: s.id, dir: -1 })} aria-label="Move earlier"><ArrowLeft /></Button>
                      <Button size="icon-sm" variant="ghost" disabled={i === app.screenshots.length - 1} onClick={() => run("shots.move", { id: s.id, dir: 1 })} aria-label="Move later"><ArrowRight /></Button>
                      <Button size="icon-sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Delete this screenshot?", message: s.caption, confirm: "Delete", danger: true })) void run("shots.delete", { id: s.id }); }} aria-label="Delete"><Trash2 /></Button>
                    </div>
                  )}
                </figcaption>
              </motion.figure>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Lightbox app={app} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      {CAN_CAPTURE && <CaptureDialog app={app} open={capturing} onClose={() => setCapturing(false)} />}
      <Modal open={!!captionFor} onClose={() => setCaptionFor(null)} title="Caption" size="sm"
        footer={<><Button variant="ghost" onClick={() => setCaptionFor(null)}>Cancel</Button><Button variant="primary" onClick={async () => { if (captionFor && (await run("shots.update", { id: captionFor.id, caption }))) setCaptionFor(null); }}>Save</Button></>}>
        <Input autoFocus value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Dashboard after login" />
      </Modal>
    </div>
  );
}
