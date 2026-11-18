import * as React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ConfirmProvider } from "@/components/ui/modal";
import { AppShell, Backdrop } from "@/components/app/shell";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AppsPage from "@/pages/apps";
import AppDetailPage from "@/pages/app-detail";
import TeamPage from "@/pages/team";
import TasksPage from "@/pages/tasks";
import LogsPage from "@/pages/logs";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import GuidePage from "@/pages/guide";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } } });

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Backdrop />
      <div className="size-16 animate-morph bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2))] shadow-[0_0_60px_var(--chart-1)]" />
    </div>
  );
}

function Gate() {
  const { user, ready } = useAuth();
  React.useEffect(() => {
    const full = () => toast.error("Browser storage is full — remove large files or export a backup.");
    window.addEventListener("itm:storage-full", full);
    return () => window.removeEventListener("itm:storage-full", full);
  }, []);
  if (!ready) return <Splash />;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="apps" element={<AppsPage />} />
        <Route path="apps/:id" element={<AppDetailPage />} />
        <Route path="apps/:id/:tab" element={<AppDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="users" element={user.role === "admin" ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <HashRouter>
          <AuthProvider>
            <ConfirmProvider>
              <Gate />
            </ConfirmProvider>
          </AuthProvider>
        </HashRouter>
        <Toaster position="bottom-right" theme="system" richColors closeButton toastOptions={{ className: "!rounded-2xl !backdrop-blur-xl" }} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
