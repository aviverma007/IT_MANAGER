import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  // Embossed gradient: top highlight, bottom bevel, coloured glow
  primary:
    "text-white bg-[linear-gradient(180deg,color-mix(in_oklab,var(--chart-1)_82%,white),var(--chart-1)_45%,color-mix(in_oklab,var(--chart-1)_78%,black))] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.22),0_1px_2px_rgb(0_0_0/0.3),0_8px_22px_-8px_var(--chart-1)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.22),0_1px_2px_rgb(0_0_0/0.3),0_12px_30px_-8px_var(--chart-1)]",
  accent:
    "text-white bg-[linear-gradient(120deg,var(--chart-1),var(--chart-2))] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),inset_0_-2px_0_rgb(0_0_0/0.2),0_8px_22px_-8px_var(--chart-2)]",
  secondary: "emboss text-foreground border border-border hover:brightness-110",
  outline: "border border-border bg-transparent text-foreground hover:bg-muted/60",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  danger:
    "text-white bg-[linear-gradient(180deg,color-mix(in_oklab,var(--destructive)_80%,white),var(--destructive)_50%,color-mix(in_oklab,var(--destructive)_75%,black))] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_0_0/0.22),0_8px_20px_-8px_var(--destructive)]",
  success:
    "text-white bg-[linear-gradient(180deg,color-mix(in_oklab,var(--success)_80%,white),var(--success)_50%,color-mix(in_oklab,var(--success)_72%,black))] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_0_0/0.2),0_8px_20px_-8px_var(--success)]",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-2xl",
  icon: "size-9 rounded-xl",
  "icon-sm": "size-8 rounded-lg",
} as const;

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, disabled, className, children, type = "button", ...rest },
  ref,
) {
  const shiny = variant === "primary" || variant === "accent" || variant === "danger" || variant === "success";
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.96, y: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "group/btn relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden whitespace-nowrap font-medium outline-none transition-[box-shadow,background-color,color,filter] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {shiny && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover/btn:translate-x-[400%]" />
      )}
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </motion.button>
  );
});
