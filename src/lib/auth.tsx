import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { call, tokenStore } from "@/api/client";
import type { User } from "@/core/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); setReady(true); return; }
    try { setUser(await call<User>("me")); } catch { setUser(null); }
    setReady(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => { setUser(null); qc.clear(); };
    window.addEventListener("itm:unauthorized", onUnauthorized);
    return () => window.removeEventListener("itm:unauthorized", onUnauthorized);
  }, [qc]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await call<{ token: string; user: User }>("login", { username, password });
    tokenStore.set(res.token);
    qc.clear();
    setUser(res.user);
  }, [qc]);

  const logout = useCallback(async () => {
    try { await call("logout"); } catch { /* already gone */ }
    tokenStore.set(null);
    qc.clear();
    setUser(null);
  }, [qc]);

  return <AuthContext.Provider value={{ user, ready, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Signed-in user (only call inside the authenticated layout). */
export function useMe() {
  const { user } = useAuth();
  if (!user) throw new Error("Not signed in");
  return user;
}
