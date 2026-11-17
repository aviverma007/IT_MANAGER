// Small animated building blocks: badges, progress ring/bar, tabs with a sliding pill, animated checkbox, counters, sparkline,
// avatars, glass/tilt cards, empty states and a particle burst.
import * as React from "react";
import { animate, AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn, PRIORITY_META, STATUS_META } from "@/lib/utils";
import type { AppStatus, Priority } from "@/core/types";
import { avatarFor } from "@/lib/covers";

export function StatusBadge({ status, className }: { status: AppStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", meta.color, className)}>
      <span className="relative flex size-1.5">
        {status === "live" && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", meta.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </span>
  );
}

export function PriorityDot({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", m.text)} title={`${m.label} priority`}>
      <span className={cn("size-2 rounded-full", m.dot)} />
      {withLabel && m.label}
    </span>
  );
}

export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>{children}</span>;
}

export function ProgressRing({ value, size = 56, stroke = 6, color = "var(--chart-1)", label = true, className }: { value: number; size?: number; stroke?: number; color?: string; label?: boolean; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ref = React.useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-foreground/10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - (c * Math.min(100, Math.max(0, value))) / 100 : c }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 60%, transparent))` }}
        />
      </svg>
      {label && <span className="absolute text-[11px] font-bold tabular-nums" style={{ fontSize: size * 0.22 }}><AnimatedNumber value={value} />%</span>}
    </div>
  );
}

export function ProgressBar({ value, className, color = "var(--chart-1)" }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("deboss h-2 w-full overflow-hidden rounded-full", className)}>
      <motion.div
        className="relative h-full rounded-full"
        style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${color} 70%, white), ${color})`, boxShadow: `0 0 12px color-mix(in oklab, ${color} 60%, transparent)` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="absolute inset-0 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.35),transparent)] bg-[length:200%_100%]" />
      </motion.div>
    </div>
  );
}

export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString("en-IN") }: { value: number; format?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const prev = React.useRef(0);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { node.textContent = format(v); } });
    prev.current = value;
    return () => controls.stop();
  }, [value, format]);
  return <span ref={ref} className="tabular-nums">{format(0)}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange, id, className }: { tabs: { value: T; label: string; icon?: React.ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; id: string; className?: string }) {
  return (
    <div role="tablist" className={cn("deboss inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("relative z-0 inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors [&_svg]:size-4", value === t.value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {value === t.value && <motion.span layoutId={`tab-${id}`} className="emboss absolute inset-0 -z-10 rounded-xl border border-border" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, disabled, label, color = "var(--chart-3)" }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; color?: string }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      whileTap={{ scale: 0.8 }}
      onClick={() => onChange(!checked)}
      className={cn("relative grid size-[22px] shrink-0 place-items-center rounded-[7px] border transition-colors disabled:cursor-not-allowed disabled:opacity-60", checked ? "border-transparent" : "deboss border-input hover:border-ring")}
      style={checked ? { background: `linear-gradient(180deg, color-mix(in oklab, ${color} 80%, white), ${color})`, boxShadow: `inset 0 1px 0 rgb(255 255 255 / .35), 0 0 14px color-mix(in oklab, ${color} 55%, transparent)` } : undefined}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="white" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: 0.28, ease: "easeOut" }} />
      </svg>
    </motion.button>
  );
}

export function Sparkline({ data, color = "var(--chart-2)", width = 120, height = 32, className }: { data: number[]; color?: string; width?: number; height?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * width, height - 3 - (v / max) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.45} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient>
      </defs>
      <motion.path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
    </svg>
  );
}

export function Avatar({ user, size = 32, className, ring }: { user: { id: string; name: string; tone: number; avatar?: string }; size?: number; className?: string; ring?: boolean }) {
  return (
    <img
      src={avatarFor(user)}
      alt=""
      title={user.name}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-background shadow-[0_0_0_3px_color-mix(in_oklab,var(--chart-1)_45%,transparent)]", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function GlassCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-3xl", className)} {...rest}>{children}</div>;
}

/** Card that tilts toward the pointer with a moving light sheen. */
export function TiltCard({ className, children, intensity = 8, ...rest }: React.HTMLAttributes<HTMLDivElement> & { intensity?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [intensity, -intensity]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-intensity, intensity]), { stiffness: 220, damping: 18 });
  const sheen = useTransform([mx, my] as const, ([x, y]: number[]) => `radial-gradient(420px circle at ${(x ?? 0.5) * 100}% ${(y ?? 0.5) * 100}%, color-mix(in oklab, white 14%, transparent), transparent 45%)`);
  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        mx.set((e.clientX - box.left) / box.width);
        my.set((e.clientY - box.top) / box.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={cn("glass group/tilt relative rounded-3xl", className)}
      {...(rest as object)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100" style={{ background: sheen }} />
      {children}
    </motion.div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      <div className="emboss grid size-14 animate-float place-items-center rounded-2xl text-primary [&_svg]:size-6">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

/** Celebratory particle burst; mount it with a changing `fire` key. */
export function Burst({ fire }: { fire: number }) {
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  return (
    <AnimatePresence>
      {fire > 0 && (
        <motion.span key={fire} className="pointer-events-none absolute inset-0 z-20" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.9, duration: 0.4 }}>
          {Array.from({ length: 18 }, (_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            const dist = 50 + (i % 4) * 18;
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 size-2 rounded-[2px]"
                style={{ background: colors[i % 5] }}
                initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
                animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, scale: [0, 1.3, 0.8], rotate: 220 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function SectionTitle({ title, sub, action, icon }: { title: string; sub?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-primary [&_svg]:size-5">{icon}</span>}
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
