import { useCallback } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { call } from "./client";
import type { AppDetail, AppSummary, DashboardStats, LogEntry, Paged, User } from "@/core/types";

export const useApps = () => useQuery({ queryKey: ["apps"], queryFn: () => call<AppSummary[]>("apps.list") });
export const useApp = (id: string | undefined) => useQuery({ queryKey: ["app", id], queryFn: () => call<AppDetail>("apps.get", { id }), enabled: !!id, retry: false });
export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: () => call<DashboardStats>("dashboard") });
export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: () => call<User[]>("users.list") });
export const useLogs = (filters: Record<string, unknown>) =>
  useQuery({ queryKey: ["logs", filters], queryFn: () => call<Paged<LogEntry>>("logs.list", filters), placeholderData: keepPreviousData });

/**
 * Run an API mutation, then refresh every cached query (the data set is small, so this keeps every screen consistent).
 * Errors become toasts; the promise resolves to undefined on failure so callers can simply `if (!res) return`.
 */
export function useRun() {
  const qc = useQueryClient();
  return useCallback(
    async <T = unknown>(method: string, params: Record<string, unknown> = {}, opts: { success?: string; silent?: boolean } = {}) => {
      try {
        const result = await call<T>(method, params);
        await qc.invalidateQueries();
        if (opts.success) toast.success(opts.success);
        return result;
      } catch (e) {
        if (!opts.silent) toast.error((e as Error).message);
        return undefined;
      }
    },
    [qc],
  );
}
