import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiOption = { value: string; label: string; hint?: string; color?: string };

/**
 * Dropdown with checkboxes. `value` is the list of picked values; an empty list means "all"
 * (for filters) or "none" (for fields) — the `placeholder` says which.
 */
export function MultiSelect({ options, value, onChange, placeholder = "All", label, className, searchable = true, disabled }: {
  options: MultiOption[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; label?: string; className?: string; searchable?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  React.useEffect(() => { if (!open) setQ(""); }, [open]);

  const picked = new Set(value);
  const shown = options.filter((o) => !q || `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (v: string) => onChange(picked.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const names = options.filter((o) => picked.has(o.value)).map((o) => o.label);
  const text = !names.length ? placeholder : names.length <= 2 ? names.join(", ") : `${names[0]}, ${names[1]} +${names.length - 2}`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "deboss flex h-10 w-full items-center gap-2 rounded-xl border border-input px-3.5 text-left text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring disabled:opacity-60",
          open && "border-ring shadow-[0_0_0_4px_color-mix(in_oklab,var(--ring)_22%,transparent)]",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !names.length && "text-foreground/90")}>{text}</span>
        {names.length > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground tabular-nums">{names.length}</span>
        )}
        {names.length > 0 ? (
          <span role="button" tabIndex={-1} aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange([]); }} className="grid size-5 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-3.5" /></span>
        ) : (
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-muted-foreground"><ChevronDown className="size-4" /></motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-multiselectable="true"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="glass absolute left-0 top-[calc(100%+6px)] z-40 w-full min-w-60 overflow-hidden rounded-2xl !bg-popover/95 p-1.5"
          >
            {searchable && options.length > 6 && (
              <div className="relative mb-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-full rounded-lg bg-muted/60 pl-8 pr-2 text-sm outline-none" />
              </div>
            )}
            <div className="flex justify-between px-2 py-1 text-[11px]">
              <button type="button" onClick={() => onChange([...new Set([...value, ...shown.map((o) => o.value)])])} className="font-medium text-primary hover:underline">Select all{q && " shown"}</button>
              <button type="button" onClick={() => onChange([])} disabled={!value.length} className="text-muted-foreground hover:text-foreground disabled:opacity-40">Clear</button>
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</li>}
              {shown.map((o) => {
                const on = picked.has(o.value);
                return (
                  <li key={o.value}>
                    <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/70", on && "bg-primary/8")}>
                      <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors", on ? "border-transparent bg-primary text-primary-foreground" : "border-input")}>
                        <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="size-3" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                      </span>
                      {o.color && <span className="size-2 shrink-0 rounded-full" style={{ background: o.color }} />}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
