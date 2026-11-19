import * as React from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import {
  ListChecks, Activity, AppWindow, BookOpen, ChevronsLeft, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings, ShieldCheck, Sun, Users, X, Ticket } from "lucide-react";
import { useAuth, useMe } from "@/lib/auth";
import { useApps } from "@/api/hooks";
import { DEMO } from "@/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, StatusBadge } from "@/components/ui/bits";
import { coverFor } from "@/lib/covers";
import { AppFormModal } from "./app-form";
import { useLiveSync } from "@/api/live";
import type { AppStatus } from "@/core/types";

/* ---------------- theme ---------------- */
export function useTheme() {
  const [theme, setTheme] = React.useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("itm.theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("itm.theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, setTheme] as const;
}

/* ---------------- animated backdrop ---------------- */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[10%] -top-[20%] size-[55vmax] animate-aurora rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--chart-1)_32%,transparent),transparent_62%)] blur-2xl" />
      <div className="absolute -right-[15%] top-[10%] size-[50vmax] animate-aurora rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--chart-2)_24%,transparent),transparent_62%)] blur-2xl [animation-delay:-6s]" />
      <div className="absolute -bottom-[25%] left-[25%] size-[45vmax] animate-aurora rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--chart-5)_16%,transparent),transparent_62%)] blur-2xl [animation-delay:-11s]" />
      <div className="grid-bg absolute inset-0" />
    </div>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/apps", label: "Applications", icon: AppWindow },
  { to: "/tasks", label: "All tasks", icon: ListChecks },
  { to: "/tickets", label: "Tickets", icon: Ticket },
  { to: "/team", label: "Team", icon: Users },
  { to: "/logs", label: "Audit logs", icon: Activity },
  { to: "/guide", label: "User guide", icon: BookOpen },
  { to: "/users", label: "Users & rights", icon: ShieldCheck, admin: true },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.div whileHover={{ rotate: 8, scale: 1.06 }} className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2))] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),inset_0_-2px_0_rgb(0_0_0/0.25),0_8px_24px_-8px_var(--chart-1)]">
        <span className="absolute inset-1 animate-morph bg-white/15" />
        <svg viewBox="0 0 24 24" className="relative size-5" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round"><path d="M5 7h14M5 12h9M5 17h12" /></svg>
      </motion.div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">IT Manager</div>
          <div className="text-[11px] text-muted-foreground">App portfolio</div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, setCollapsed, mobile, onNavigate }: { collapsed: boolean; setCollapsed: (v: boolean) => void; mobile?: boolean; onNavigate?: () => void }) {
  const me = useMe();
  const { logout } = useAuth();
  const { data: apps } = useApps();
  const favorites = (apps ?? []).filter((a) => a.favorite).slice(0, 5);
  return (
    <motion.aside
      animate={{ width: mobile ? 280 : collapsed ? 84 : 264 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="glass flex h-full flex-col gap-2 !rounded-none border-y-0 border-l-0 px-3 py-4 lg:!rounded-3xl lg:border"
    >
      <div className={cn("flex items-center px-2 pb-3", collapsed && !mobile ? "justify-center" : "justify-between")}>
        <Logo collapsed={collapsed && !mobile} />
        {!mobile && !collapsed && (
          <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar"><ChevronsLeft /></Button>
        )}
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.filter((n) => !n.admin || me.role === "admin").map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate} title={n.label}
            className={({ isActive }) => cn("group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground", collapsed && !mobile && "justify-center px-0")}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId={mobile ? "nav-pill-m" : "nav-pill"} transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="emboss absolute inset-0 -z-10 rounded-2xl border border-border">
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[linear-gradient(var(--chart-1),var(--chart-2))] shadow-[0_0_12px_var(--chart-1)]" />
                  </motion.span>
                )}
                <n.icon className={cn("size-[18px] shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                {(!collapsed || mobile) && <span>{n.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {(!collapsed || mobile) && favorites.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pinned</div>
          <div className="flex flex-col gap-1">
            {favorites.map((a) => (
              <NavLink key={a.id} to={`/apps/${a.id}`} onClick={onNavigate} className={({ isActive }) => cn("flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm transition-colors hover:bg-muted/60", isActive ? "text-foreground" : "text-muted-foreground")}>
                <img src={coverFor(a, 80, 80)} alt="" className="size-6 rounded-lg object-cover" />
                <span className="truncate">{a.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {collapsed && !mobile && (
          <Button variant="ghost" size="icon" className="mx-auto" onClick={() => setCollapsed(false)} aria-label="Expand sidebar"><ChevronsLeft className="rotate-180" /></Button>
        )}
        <div className={cn("deboss flex items-center gap-3 rounded-2xl p-2", collapsed && !mobile && "justify-center")}>
          <Avatar user={me} size={36} />
          {(!collapsed || mobile) && (
            <>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold">{me.name}</div>
                <div className="text-[11px] capitalize text-muted-foreground">{me.role}</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => void logout()} aria-label="Sign out" title="Sign out"><LogOut /></Button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

/* ---------------- command palette (Ctrl/⌘ + K) ---------------- */
function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const me = useMe();
  const { data: apps } = useApps();
  const [q, setQ] = React.useState("");
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => { if (open) { setQ(""); setIndex(0); } }, [open]);

  const items = React.useMemo(() => {
    const s = q.toLowerCase().trim();
    type Item = { key: string; label: string; hint: string; icon: React.ReactNode; go: () => void; status?: AppStatus; text?: string };
    const pages: Item[] = NAV.filter((n) => !n.admin || me.role === "admin").map((n) => ({ key: "p" + n.to, label: n.label, hint: "Page", icon: <n.icon className="size-4" />, go: () => navigate(n.to) }));
    const appItems: Item[] = (apps ?? []).map((a) => ({
      key: a.id, label: a.name, hint: a.tagline || a.category, icon: <img src={coverFor(a, 60, 60)} alt="" className="size-6 rounded-md" />, go: () => navigate(`/apps/${a.id}`), status: a.status,
      text: `${a.name} ${a.code} ${a.category} ${a.department} ${a.techStack.join(" ")}`,
    }));
    const all = [...appItems, ...pages];
    return s ? all.filter((i) => `${i.label} ${i.text ?? ""} ${i.hint}`.toLowerCase().includes(s)).slice(0, 12) : all.slice(0, 10);
  }, [q, apps, me.role, navigate]);

  const run = (i: number) => { const item = items[i]; if (item) { item.go(); onClose(); } };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -8 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass relative w-full max-w-xl overflow-hidden rounded-3xl !bg-popover/95">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIndex(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
                  if (e.key === "Enter") run(index);
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Search applications, pages…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
              <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
              {items.map((item, i) => (
                <li key={item.key}>
                  <button onMouseEnter={() => setIndex(i)} onClick={() => run(i)} className={cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === index ? "text-foreground" : "text-muted-foreground")}>
                    {i === index && <motion.span layoutId="cmd-hl" className="emboss absolute inset-0 -z-10 rounded-xl" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                    <span className="grid size-7 place-items-center">{item.icon}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{item.label}</span><span className="block truncate text-xs">{item.hint}</span></span>
                    {item.status && <StatusBadge status={item.status} />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* Keeps showing the old page while it animates out (an exiting <Outlet/> would otherwise render the new route). */
function PresentOutlet() {
  const outlet = useOutlet();
  const isPresent = useIsPresent();
  const last = React.useRef(outlet);
  if (isPresent) last.current = outlet;
  return last.current;
}

/* ---------------- shell ---------------- */
export function AppShell() {
  const me = useMe();
  const [theme, setTheme] = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(() => { try { return localStorage.getItem("itm.sidebar") === "1"; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const live = useLiveSync(me.id);

  React.useEffect(() => { try { localStorage.setItem("itm.sidebar", collapsed ? "1" : "0"); } catch { /* ignore */ } }, [collapsed]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => { setMobileOpen(false); window.scrollTo({ top: 0 }); }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Backdrop />
      <div className="flex gap-4 lg:p-4">
        <div className="sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 lg:block">
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.div className="absolute inset-y-0 left-0" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
                <Sidebar collapsed={false} setCollapsed={() => {}} mobile onNavigate={() => setMobileOpen(false)} />
                <Button variant="ghost" size="icon" className="absolute right-3 top-4" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1">
          <header className="glass sticky top-0 z-30 mb-4 flex h-16 items-center gap-3 !bg-[color-mix(in_oklab,var(--background)_82%,transparent)] px-4 lg:top-4 lg:rounded-3xl">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></Button>
            <button onClick={() => setPalette(true)} className="deboss flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-input px-3 text-sm text-muted-foreground transition-colors hover:border-ring sm:max-w-md">
              <Search className="size-4 shrink-0" />
              <span className="truncate">Search applications…</span>
              <kbd className="ml-auto hidden rounded-md border border-border px-1.5 py-0.5 text-[10px] sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span title={live.status === "live" ? `Live — changes from everyone appear instantly${live.online ? ` · ${live.online} screen(s) connected` : ""}` : "Reconnecting — refreshing every 30 seconds meanwhile"}
                className={cn("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
                  live.status === "live" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-300")}>
                <span className="relative flex size-2">
                  <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-70", live.status === "live" ? "bg-emerald-400" : "bg-amber-400")} />
                  <span className={cn("relative inline-flex size-2 rounded-full", live.status === "live" ? "bg-emerald-500" : "bg-amber-500")} />
                </span>
                {live.status === "live" ? "Live" : "Reconnecting"}
              </span>
              {DEMO && <span className="hidden rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-300 md:inline">Demo · data saved in this browser</span>}
              <Button variant="secondary" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={theme} initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0 }} transition={{ duration: 0.2 }}>
                    {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  </motion.span>
                </AnimatePresence>
              </Button>
              {me.role !== "viewer" && (
                <Button variant="primary" onClick={() => setCreating(true)}><Plus /><span className="hidden sm:inline">New application</span></Button>
              )}
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname.split("/").slice(0, 3).join("/")}
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="px-4 pb-12 lg:px-0"
            >
              <PresentOutlet />
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <AppFormModal open={creating} onClose={() => setCreating(false)} onSaved={(id) => navigate(`/apps/${id}`)} />
    </div>
  );
}
