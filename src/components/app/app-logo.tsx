import { coverFor } from "@/lib/covers";
import { cn } from "@/lib/utils";

type LogoApp = { id: string; name: string; code?: string; tone: number; cover?: string; logo?: string; coverShot?: Parameters<typeof coverFor>[0]["coverShot"] };

/** The app's logo on a white tile everywhere a small app picture is shown; falls back to its screenshot / cover. */
export function AppLogo({ app, className, pad = "p-[12%]" }: { app: LogoApp; className?: string; pad?: string }) {
  if (app.logo) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden border border-border bg-white shadow-sm", className)}>
        <img src={app.logo} alt="" className={cn("size-full object-contain", pad)} />
      </span>
    );
  }
  return <img src={coverFor(app, 160, 160)} alt="" className={cn("shrink-0 border border-border object-cover object-top", className)} />;
}

/** Big picture for an app: its logo (centred on a soft wash of the app colour) or the screenshot / cover. */
export function AppHero({ app, tone, className, logoClassName }: { app: LogoApp; tone: string; className?: string; logoClassName?: string }) {
  if (app.logo) {
    return (
      <span className={cn("absolute inset-0 block", className)} style={{ background: `radial-gradient(120% 90% at 50% 35%, #ffffff, color-mix(in oklab, ${tone} 22%, white))` }}>
        <img src={app.logo} alt="" className={cn("absolute left-1/2 top-1/2 max-h-[72%] w-[46%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.18)] transition-transform duration-700 group-hover/tilt:scale-110 group-hover:scale-110", logoClassName)} />
      </span>
    );
  }
  return <img src={coverFor(app, 800, 600)} alt="" className={cn("absolute inset-0 size-full object-cover object-top transition-transform duration-700 group-hover/tilt:scale-110 group-hover:scale-105", className)} />;
}
