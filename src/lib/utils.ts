import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AppStatus, Priority } from "@/core/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_META: Record<AppStatus, { label: string; color: string; dot: string }> = {
  planning: { label: "Planning", color: "text-sky-700 dark:text-sky-300 bg-sky-500/12 border-sky-400/25", dot: "bg-sky-400" },
  development: { label: "Development", color: "text-violet-700 dark:text-violet-300 bg-violet-500/12 border-violet-400/25", dot: "bg-violet-400" },
  testing: { label: "Testing", color: "text-amber-700 dark:text-amber-300 bg-amber-500/12 border-amber-400/25", dot: "bg-amber-400" },
  uat: { label: "UAT", color: "text-orange-700 dark:text-orange-300 bg-orange-500/12 border-orange-400/25", dot: "bg-orange-400" },
  live: { label: "Live", color: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/12 border-emerald-400/25", dot: "bg-emerald-400" },
  maintenance: { label: "Maintenance", color: "text-cyan-700 dark:text-cyan-300 bg-cyan-500/12 border-cyan-400/25", dot: "bg-cyan-400" },
  "on-hold": { label: "On hold", color: "text-zinc-700 dark:text-zinc-300 bg-zinc-500/12 border-zinc-400/25", dot: "bg-zinc-400" },
  retired: { label: "Retired", color: "text-rose-700 dark:text-rose-300 bg-rose-500/12 border-rose-400/25", dot: "bg-rose-400" },
};

export const STATUS_HEX: Record<AppStatus, string> = {
  planning: "#38bdf8", development: "#a78bfa", testing: "#fbbf24", uat: "#fb923c", live: "#34d399", maintenance: "#22d3ee", "on-hold": "#a1a1aa", retired: "#fb7185",
};

export const PRIORITY_META: Record<Priority, { label: string; dot: string; text: string }> = {
  low: { label: "Low", dot: "bg-zinc-400", text: "text-zinc-400" },
  medium: { label: "Medium", dot: "bg-sky-400", text: "text-sky-400" },
  high: { label: "High", dot: "bg-amber-400", text: "text-amber-400" },
  critical: { label: "Critical", dot: "bg-rose-500", text: "text-rose-400" },
};

export const TONE_HEX = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e"] as const;
export const toneHex = (tone: number) => TONE_HEX[((tone || 1) - 1) % 5]!;

export function fmtNumber(n: number) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toLocaleString("en-IN");
}

export function fmtDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(value + "T00:00:00") : new Date(value);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", opts);
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "never";
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(value);
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

export function download(filename: string, content: Blob | string, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Downscale an image to a JPEG data URL and report its size (screenshots keep up to 1920px). */
export async function imageToShot(file: Blob, max = 1920) {
  const src = await readAsDataUrl(file as File);
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height };
}

/** Downscale an image file to a JPEG data URL so covers and avatars stay small. */
export async function imageToDataUrl(file: File, max = 900, png = false) {
  const src = await readAsDataUrl(file);
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return png ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.86);
}
