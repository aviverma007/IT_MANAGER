import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "deboss w-full rounded-xl border border-input px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-[border-color,box-shadow] focus:border-ring focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ring)_22%,transparent)] disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, "h-10", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(base, "h-10 appearance-none pr-9 [&>option]:bg-popover", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground", className)} {...props} />;
}

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "deboss relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input transition-colors disabled:opacity-50",
        checked && "bg-[color-mix(in_oklab,var(--chart-1)_70%,transparent)]",
      )}
    >
      <span className={cn("emboss inline-block size-5 rounded-full transition-transform duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)]", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}
