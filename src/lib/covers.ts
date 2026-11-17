// Generated artwork: every app gets a unique cover and every user an avatar, with no network images required.
import { TONE_HEX, initials } from "./utils";

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const svgUri = (svg: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
const cache = new Map<string, string>();

export function coverFor(app: { id: string; name: string; code?: string; tone: number; cover?: string }, w = 800, h = 1000) {
  if (app.cover) return app.cover;
  const key = `${app.id}:${app.name}:${app.tone}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = rand(hash(app.id + app.name));
  const a = TONE_HEX[(app.tone - 1) % 5]!;
  const b = TONE_HEX[(app.tone + 1) % 5]!;
  const c = TONE_HEX[(app.tone + 2) % 5]!;
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = r() * w, cy = r() * h, rad = 120 + r() * 320;
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${[a, b, c][i % 3]}" opacity="${(0.35 + r() * 0.4).toFixed(2)}"/>`;
  }).join("");
  const rings = Array.from({ length: 7 }, (_, i) => `<circle cx="${w * 0.72}" cy="${h * 0.3}" r="${60 + i * 46}" fill="none" stroke="white" stroke-opacity="${(0.16 - i * 0.018).toFixed(3)}" stroke-width="1.5"/>`).join("");
  const bars = Array.from({ length: 9 }, (_, i) => {
    const bh = 40 + r() * 220;
    return `<rect x="${60 + i * 38}" y="${h - 120 - bh}" width="22" height="${bh.toFixed(0)}" rx="6" fill="white" opacity="${(0.1 + r() * 0.16).toFixed(2)}"/>`;
  }).join("");
  const fs = Math.round(Math.min(w * 0.28, h * 0.4));
  const tx = Math.round(w * 0.07);
  const banner = w / h > 2; // hero banners: no monogram, the page title sits on top
  const label = esc(initials(app.name.replace(/[^\p{L}\p{N}\s]/gu, " ")));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1024"/><stop offset="1" stop-color="#1b1640"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="60"/></filter>
<pattern id="d" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="white" opacity="0.12"/></pattern>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<g filter="url(#b)">${blobs}</g>
<rect width="${w}" height="${h}" fill="url(#d)"/>
${rings}${bars}
${banner ? "" : `<text x="${tx}" y="${Math.round(h * 0.5 + fs * 0.32)}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${fs}" font-weight="800" fill="white" opacity="0.95" letter-spacing="${-Math.round(fs * 0.04)}">${label}</text>
<text x="${tx + 4}" y="${Math.round(h * 0.5 + fs * 0.32 + Math.max(22, fs * 0.22))}" font-family="ui-monospace,Menlo,monospace" font-size="${Math.round(Math.max(14, fs * 0.13))}" fill="white" opacity="0.6" letter-spacing="${Math.round(Math.max(3, fs * 0.03))}">${esc((app.code || "").slice(0, 18))}</text>`}
</svg>`;
  const uri = svgUri(svg);
  cache.set(key, uri);
  return uri;
}

export function avatarFor(user: { id: string; name: string; tone: number; avatar?: string }) {
  if (user.avatar) return user.avatar;
  const key = `av:${user.id}:${user.name}:${user.tone}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const a = TONE_HEX[(user.tone - 1) % 5]!;
  const b = TONE_HEX[user.tone % 5]!;
  const r = rand(hash(user.id));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="200" height="200" fill="url(#g)"/>
<circle cx="${(40 + r() * 120).toFixed(0)}" cy="${(30 + r() * 60).toFixed(0)}" r="${(50 + r() * 40).toFixed(0)}" fill="white" opacity="0.14"/>
<circle cx="${(40 + r() * 120).toFixed(0)}" cy="${(120 + r() * 60).toFixed(0)}" r="${(40 + r() * 40).toFixed(0)}" fill="black" opacity="0.12"/>
<text x="100" y="124" text-anchor="middle" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="72" font-weight="700" fill="white">${esc(initials(user.name))}</text>
</svg>`;
  const uri = svgUri(svg);
  cache.set(key, uri);
  return uri;
}
