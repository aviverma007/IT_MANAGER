import * as React from "react";
import { coverFor } from "@/lib/covers";
import { cn } from "@/lib/utils";

type LogoApp = { id: string; name: string; code?: string; tone: number; cover?: string; logo?: string; coverShot?: Parameters<typeof coverFor>[0]["coverShot"] };

/** The app's logo on its own (no tile, no background) wherever a small app picture is shown; falls back to its screenshot / cover. */
export function AppLogo({ app, className }: { app: LogoApp; className?: string; pad?: string }) {
  if (app.logo) {
    return (
      <span className={cn("grid shrink-0 place-items-center", className)}>
        <img src={app.logo} alt="" className="size-full object-contain" />
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

/* ---------- the logo's main colour (read from the image once, then cached) ---------- */
const colorCache = new Map<string, string | null>();
const waiting = new Map<string, Promise<string | null>>();

function dominantColor(src: string): Promise<string | null> {
  if (colorCache.has(src)) return Promise.resolve(colorCache.get(src)!);
  if (waiting.has(src)) return waiting.get(src)!;
  const p = new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const n = 32, c = document.createElement("canvas");
        c.width = n; c.height = n;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, n, n);
        const d = ctx.getImageData(0, 0, n, n).data;
        // weight colourful pixels by saturation, grouped by hue (12 buckets); greys only count if nothing is colourful
        const buckets = Array.from({ length: 13 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!, a = d[i + 3]!;
          if (a < 160) continue;
          const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 510;
          const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
          if (l > 0.94) continue; // white
          let k = 12, w = 0.15;
          if (s > 0.22 && l > 0.12) {
            const h = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
            k = Math.floor(h * 2) % 12; w = s;
          }
          const bk = buckets[k]!; bk.w += w; bk.r += r * w; bk.g += g * w; bk.b += b * w;
        }
        const colorful = buckets.slice(0, 12).sort((x, y) => y.w - x.w)[0]!;
        const pick = colorful.w > 0.6 ? colorful : buckets[12]!.w > 0 ? buckets[12]! : null;
        const hex = pick ? "#" + [pick.r, pick.g, pick.b].map((v) => Math.round(v / pick.w).toString(16).padStart(2, "0")).join("") : null;
        colorCache.set(src, hex); resolve(hex);
      } catch { colorCache.set(src, null); resolve(null); }
    };
    img.onerror = () => { colorCache.set(src, null); resolve(null); };
    img.src = src;
  });
  waiting.set(src, p);
  return p;
}

/** Main colour of an app's logo (null while loading / when it has no logo). */
export function useLogoColor(app: { logo?: string }) {
  const src = app.logo || "";
  const [color, setColor] = React.useState<string | null>(() => (src ? colorCache.get(src) ?? null : null));
  React.useEffect(() => {
    if (!src) { setColor(null); return; }
    let live = true;
    void dominantColor(src).then((c) => { if (live) setColor(c); });
    return () => { live = false; };
  }, [src]);
  return color;
}
