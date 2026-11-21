// Builds an illustrated PDF user manual for one application:
// opens the app in Edge/Chrome, shows the sign-in screen, signs in (login typed by the user, never stored),
// captures each section's screen, then lays out cover → contents → sections → questions → help and prints to A4.
import type { Browser, Page } from "playwright-core";
import type { App } from "../src/core/types.ts";
import type { Manual, ManualSection } from "../src/core/manuals.ts";

export interface BuildInput {
  app: App;
  manual: Manual;
  login?: { username?: string; password?: string };
  logoDataUrl?: string;
}
export interface BuildResult { pdf: Buffer; markdown: string; pictures: number; missed: string[] }

const W = 1280, H = 760;
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function open(page: Page, target: string) {
  try { await page.goto(target, { waitUntil: "networkidle", timeout: 25_000 }); }
  catch { await page.goto(target, { waitUntil: "load", timeout: 25_000 }).catch(() => undefined); }
}
const settle = async (page: Page, ms = 1500) => {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
};
// pop-up notices ("Welcome back!", cookie bars) are hidden so pictures show the screen itself
const HIDE = "[data-sonner-toaster],.Toastify,.toast-container,.notistack-SnackbarContainer,.MuiSnackbar-root{display:none!important}";
const shoot = async (page: Page) => {
  await page.addStyleTag({ content: HIDE }).catch(() => undefined);
  return `data:image/jpeg;base64,${(await page.screenshot({ type: "jpeg", quality: 70 })).toString("base64")}`;
};

async function signIn(page: Page, login: BuildInput["login"]) {
  if (!login?.username || !login.password) return false;
  const pw = page.locator("input[type=password]:visible").first();
  if (!(await pw.count())) return false;
  const user = page.locator("input:visible:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])");
  if (await user.count()) await user.nth(0).fill(login.username);
  await pw.fill(login.password);
  await Promise.all([page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined), pw.press("Enter")]);
  await page.waitForTimeout(1500);
  return true;
}

/** Click a menu item / tab / button by its visible text. */
async function clickText(page: Page, text: string) {
  const exact = { name: text, exact: true };
  const target = page.getByRole("link", exact).or(page.getByRole("button", exact)).or(page.getByRole("tab", exact))
    .or(page.getByRole("menuitem", exact)).or(page.getByText(text, { exact: true }));
  const el = target.filter({ visible: true }).first();
  await el.click({ timeout: 6_000 });
}

async function captureSections(browser: Browser, input: BuildInput) {
  const shots = new Map<number, string>();
  const missed: string[] = [];
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const base = input.app.url;
  try {
    await open(page, base);
    await settle(page, 1200);
    const sections = input.manual.sections;
    const signInIdx = sections.findIndex((s) => s.title === "Signing in");
    if (signInIdx >= 0) shots.set(signInIdx, await shoot(page));
    await signIn(page, input.login);
    for (const [i, s] of sections.entries()) {
      if (!s.shot || i === signInIdx) continue;
      try {
        if (s.shot.path !== undefined) {
          const target = s.shot.path === "" ? base : new URL(s.shot.path, base).toString();
          if (page.url() !== target) { await open(page, target); }
        }
        for (const c of s.shot.click ?? []) { await clickText(page, c); await settle(page, 600); }
        await settle(page, s.shot.wait ?? 1500);
        shots.set(i, await shoot(page));
      } catch {
        missed.push(s.title);
      }
    }
  } finally {
    await context.close();
  }
  return { shots, missed };
}

function sectionHtml(s: ManualSection, n: number, shot: string | undefined, app: App) {
  return `<section class="sec">
    <h2><span class="num">${n}</span>${esc(s.title)}</h2>
    ${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}
    ${s.steps?.length ? `<ol class="steps">${s.steps.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>` : ""}
    ${shot ? `<figure><img src="${shot}" alt=""><figcaption>Figure ${n} — ${esc(app.name)}: ${esc(s.title)}</figcaption></figure>` : ""}
    ${s.tips?.length ? `<div class="tip"><b>Good to know</b>${s.tips.map((t) => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
  </section>`;
}

function html(input: BuildInput, shots: Map<number, string>) {
  const { app, manual } = input;
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const accent = "#4f46e5";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
    .cover { height: 255mm; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; page-break-after: always; border-left: 6px solid ${accent}; padding-left: 14mm; }
    .cover img { max-width: 60mm; max-height: 40mm; object-fit: contain; margin-bottom: 14mm; }
    .cover .kicker { text-transform: uppercase; letter-spacing: .18em; color: ${accent}; font-weight: 700; font-size: 10pt; }
    .cover h1 { font-size: 34pt; margin: 4mm 0 2mm; line-height: 1.1; color: #111827; }
    .cover .tag { font-size: 13pt; color: #4b5563; max-width: 140mm; }
    .cover .meta { margin-top: 18mm; font-size: 10pt; color: #6b7280; }
    .cover .meta b { color: #111827; }
    h2 { font-size: 16pt; color: #111827; margin: 0 0 3mm; display: flex; align-items: center; gap: 3mm; }
    .num { display: inline-flex; width: 9mm; height: 9mm; border-radius: 50%; background: ${accent}; color: #fff; font-size: 11pt; align-items: center; justify-content: center; flex: none; }
    .page { page-break-after: always; }
    .toc ol { padding-left: 6mm; font-size: 11.5pt; }
    .toc li { margin: 1.6mm 0; }
    .intro p { font-size: 11.5pt; }
    .box { background: #f3f4f6; border-radius: 3mm; padding: 4mm 5mm; margin: 4mm 0; }
    .box b { display: block; margin-bottom: 1mm; color: #111827; }
    .box ul { margin: 0; padding-left: 5mm; }
    .sec { margin-bottom: 9mm; page-break-inside: avoid; }
    .sec + .sec { border-top: 1px solid #e5e7eb; padding-top: 7mm; }
    .lead { color: #374151; margin: 0 0 2mm; }
    .steps { margin: 2mm 0 3mm; padding-left: 0; list-style: none; counter-reset: step; }
    .steps li { counter-increment: step; position: relative; padding-left: 9mm; margin: 1.6mm 0; }
    .steps li::before { content: counter(step); position: absolute; left: 0; top: .2mm; width: 6mm; height: 6mm; border-radius: 1.5mm; background: #eef2ff; color: ${accent}; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
    figure { margin: 3mm 0 0; page-break-inside: avoid; }
    figure img { width: 100%; border: 1px solid #d1d5db; border-radius: 2mm; box-shadow: 0 1mm 3mm rgba(0,0,0,.08); }
    figcaption { font-size: 8.5pt; color: #6b7280; margin-top: 1.5mm; text-align: center; }
    .tip { border-left: 3px solid #f59e0b; background: #fffbeb; padding: 2.5mm 4mm; margin-top: 3mm; page-break-inside: avoid; }
    .tip b { color: #92400e; font-size: 9.5pt; }
    .tip p { margin: 1mm 0 0; }
    .faq dt { font-weight: 700; margin-top: 3mm; color: #111827; }
    .faq dd { margin: 1mm 0 0; }
  </style></head><body>
  <div class="cover">
    ${input.logoDataUrl ? `<img src="${input.logoDataUrl}" alt="">` : ""}
    <div class="kicker">User manual</div>
    <h1>${esc(app.name)}</h1>
    <div class="tag">${esc(app.tagline || manual.intro)}</div>
    <div class="meta">For: <b>${esc(manual.audience)}</b><br>${app.version ? `Version <b>${esc(app.version)}</b> · ` : ""}${date}<br>Smartworld IT</div>
  </div>
  <div class="page toc intro">
    <h2>About ${esc(app.name)}</h2>
    <p>${esc(manual.intro)}</p>
    ${app.url && /^https?:/i.test(app.url) ? `<div class="box"><b>Where to open it</b>${esc(app.url)}</div>` : ""}
    ${manual.before?.length ? `<div class="box"><b>Before you start</b><ul>${manual.before.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>` : ""}
    <h2 style="margin-top:8mm">Contents</h2>
    <ol>${manual.sections.map((s) => `<li>${esc(s.title)}</li>`).join("")}${manual.faq?.length ? "<li>Common questions</li>" : ""}<li>Getting help</li></ol>
  </div>
  ${manual.sections.map((s, i) => sectionHtml(s, i + 1, shots.get(i), app)).join("")}
  ${manual.faq?.length ? `<section class="sec faq"><h2><span class="num">${manual.sections.length + 1}</span>Common questions</h2><dl>${manual.faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join("")}</dl></section>` : ""}
  <section class="sec"><h2><span class="num">${manual.sections.length + (manual.faq?.length ? 2 : 1)}</span>Getting help</h2>
    <p>Something not working, or need access? Raise a ticket on the IT helpdesk and choose <b>${esc(app.name)}</b>, or write to the IT team.</p>
  </section>
  </body></html>`;
}

export function manualMarkdown(app: App, manual: Manual) {
  const out = [`# ${app.name} — user manual`, "", manual.intro, ""];
  if (manual.before?.length) out.push("**Before you start**", "", ...manual.before.map((b) => `- ${b}`), "");
  manual.sections.forEach((s, i) => {
    out.push(`## ${i + 1}. ${s.title}`, "");
    if (s.text) out.push(s.text, "");
    if (s.steps?.length) out.push(...s.steps.map((t, j) => `${j + 1}. ${t}`), "");
    if (s.tips?.length) out.push(...s.tips.map((t) => `> ${t}`), "");
  });
  if (manual.faq?.length) { out.push("## Common questions", ""); for (const f of manual.faq) out.push(`**${f.q}**`, f.a, ""); }
  out.push("## Getting help", "", `Raise a ticket on the IT helpdesk and choose ${app.name}.`, "", `_The illustrated PDF is in the Files tab: ${app.name} – User manual.pdf_`);
  return out.join("\n");
}

export async function buildManual(browser: Browser, input: BuildInput): Promise<BuildResult> {
  const canOpen = /^https?:/i.test(input.app.url) && input.manual.sections.some((s) => s.shot);
  const { shots, missed } = canOpen ? await captureSections(browser, input) : { shots: new Map<number, string>(), missed: [] as string[] };
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent(html(input, shots), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4", printBackground: true, displayHeaderFooter: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      headerTemplate: `<div style="font-size:7pt;color:#9ca3af;width:100%;padding:0 16mm;text-align:right">${esc(input.app.name)} · User manual</div>`,
      footerTemplate: `<div style="font-size:7pt;color:#9ca3af;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Smartworld IT</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    return { pdf: Buffer.from(pdf), markdown: manualMarkdown(input.app, input.manual), pictures: shots.size, missed };
  } finally {
    await context.close();
  }
}
