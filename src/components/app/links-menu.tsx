import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ExternalLink, Globe, Search } from "lucide-react";
import type { EnvLink } from "@/core/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Labels like "Reports · Live PR report" are grouped under "Reports". */
function split(label: string) {
  const i = label.indexOf(" · ");
  return i > 0 ? { group: label.slice(0, i), name: label.slice(i + 3) } : { group: "Links", name: label || "Link" };
}

/** "Open ▾" menu with every extra page / API of an application. One link stays a plain button. */
export function LinksMenu({ links, onOpen }: { links: EnvLink[]; onOpen: (url: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [pos, setPos] = React.useState({ top: 0, right: 0 });
  const btn = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const place = () => { const r = btn.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) }); };
    place();
    const away = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!links.length) return null;
  if (links.length === 1) return <Button variant="overlay" size="lg" onClick={() => onOpen(links[0]!.url)}><Globe />{split(links[0]!.label).name}</Button>;

  const needle = q.trim().toLowerCase();
  const shown = links.filter((l) => !needle || `${l.label} ${l.url}`.toLowerCase().includes(needle));
  const groups = new Map<string, EnvLink[]>();
  for (const l of shown) { const g = split(l.label).group; groups.set(g, [...(groups.get(g) ?? []), l]); }

  return (
    <div ref={btn}>
      <Button variant="overlay" size="lg" onClick={() => setOpen((v) => !v)} aria-expanded={open}><Globe />More links<span className="rounded-full bg-white/15 px-1.5 text-[11px]">{links.length}</span><ChevronDown className={cn("transition-transform", open && "rotate-180")} /></Button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div ref={panel} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.14 }}
              style={{ top: pos.top, right: pos.right }} className="fixed z-[70] border border-border bg-popover backdrop-blur-xl w-[24rem] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl text-sm text-popover-foreground shadow-2xl">
              {links.length > 6 && (
                <label className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                  <Search className="size-4 text-muted-foreground" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a page or API…" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" />
                </label>
              )}
              <div className="max-h-[60vh] overflow-y-auto p-1.5">
                {[...groups].map(([g, items]) => (
                  <div key={g} className="mb-1">
                    <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{g}</div>
                    {items.map((l) => (
                      <button key={l.url} onClick={() => { onOpen(l.url); setOpen(false); }} className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-muted/70">
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{split(l.label).name}</span>
                          <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{l.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {!shown.length && <p className="px-3 py-6 text-center text-muted-foreground">Nothing matches “{q}”.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </div>
  );
}
