import * as React from "react";
import { motion } from "motion/react";
import { Activity, BookOpen, CheckSquare, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Backdrop } from "@/components/app/shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { DEMO } from "@/api/client";
import { toast } from "sonner";

const FEATURES = [
  { icon: CheckSquare, title: "Progress by checklist", text: "Headings, tasks and tick-boxes drive each app's progress." },
  { icon: Activity, title: "Usage that's measured", text: "Daily users, sessions and launches from Excel or a form." },
  { icon: BookOpen, title: "Manuals built in", text: "A user manual and technical notes for every application." },
  { icon: ShieldCheck, title: "Rights and audit logs", text: "Edit / view access per person; every change is logged." },
];

const DEMO_USERS = [
  { u: "admin", p: "admin123", role: "Admin", hint: "Full access" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [shake, setShake] = React.useState(0);

  async function submit(e?: React.FormEvent, u = username, p = password) {
    e?.preventDefault();
    if (!u || !p) { setShake((s) => s + 1); return; }
    setBusy(true);
    try {
      await login(u, p);
      toast.success("Welcome back!");
    } catch (err) {
      setShake((s) => s + 1);
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <Backdrop />
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2))] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_10px_30px_-8px_var(--chart-1)]">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round"><path d="M5 7h14M5 12h9M5 17h12" /></svg>
          </div>
          <span className="text-lg font-bold tracking-tight">IT Manager</span>
        </motion.div>

        <div className="relative">
          {/* morphing hero blob */}
          <motion.div aria-hidden className="absolute -left-10 -top-24 size-80 animate-morph bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2),var(--chart-3))] opacity-30 blur-2xl" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="relative mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"><Sparkles className="size-3.5 text-primary" />Application portfolio manager</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative max-w-xl text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
            Every app you build, <span className="text-gradient">tracked in one place.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="relative mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            Progress, usage, documentation, access rights and a full audit trail for the whole internal application portfolio.
          </motion.p>
          <div className="relative mt-10 grid max-w-xl grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 24, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.45 + i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                whileHover={{ y: -4 }} className="glass rounded-2xl p-4">
                <f.icon className="mb-2 size-5 text-primary" />
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{f.text}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} IT Manager</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <motion.form
          key={shake}
          onSubmit={submit}
          initial={shake ? { x: 0 } : { opacity: 0, y: 30, scale: 0.97 }}
          animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { opacity: 1, y: 0, scale: 1 }}
          transition={shake ? { duration: 0.45 } : { type: "spring", stiffness: 200, damping: 22 }}
          className="glass w-full max-w-md rounded-[2rem] p-8"
        >
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your IT Manager account.</p>
          <div className="mt-7 grid gap-4">
            <div>
              <Label htmlFor="u">Username or email</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="u" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 pl-10" placeholder="admin" />
              </div>
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="p" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10 pr-11" placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-2 w-full">Sign in</Button>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"><span className="h-px flex-1 bg-border" />{DEMO ? "Demo account" : "Administrator"}<span className="h-px flex-1 bg-border" /></div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_USERS.map((d, i) => (
                <motion.button key={d.u} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.07 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { setUsername(d.u); setPassword(d.p); void submit(undefined, d.u, d.p); }}
                  className="emboss rounded-2xl border border-border p-3 text-left">
                  <div className="text-xs font-semibold">{d.role}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{d.u}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{d.hint}</div>
                </motion.button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">Change these passwords in Users & rights before going live.</p>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
