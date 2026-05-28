import { API_ENDPOINTS } from "@/lib/constants";
import { getJson, patchJson, postJson } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface MonthlyRitualRun {
  id: number;
  ritualMonth: string;
  status: "pending" | "opened" | "challenge_completed" | "expired";
  routeTitle: string;
  routeBody: string;
  challengeKey: string;
  challengeLabel: string;
  challengeBody: string;
  ctaLabel: string;
  ctaTarget: string;
  completedAt: string | null;
}

export interface MonthlyRitualPreferences {
  ritualEnabled: boolean;
  emailReminderEnabled: boolean;
}

export interface MonthlyRitualCurrent {
  active: boolean;
  phase: "vigil" | "active" | "inactive";
  ritualMonth: string;
  ritualDate: string;
  nextRitualDate: string;
  preferences: MonthlyRitualPreferences;
  run: MonthlyRitualRun | null;
}

export function useMonthlyRitualCurrent() {
  return useQuery<MonthlyRitualCurrent>({
    queryKey: ["monthly-ritual", "current"],
    queryFn: () => getJson<MonthlyRitualCurrent>(`${BASE}${API_ENDPOINTS.monthlyRitual.current.replace(/^\//, "")}`),
    staleTime: 60_000,
  });
}

export function useMonthlyRitualArchive() {
  return useQuery<{ runs: MonthlyRitualRun[] }>({
    queryKey: ["monthly-ritual", "archive"],
    queryFn: () => getJson<{ runs: MonthlyRitualRun[] }>(
      `${BASE}${API_ENDPOINTS.monthlyRitual.archive.replace(/^\//, "")}`,
    ),
    staleTime: 120_000,
  });
}

export function useMonthlyRitualActions() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["monthly-ritual"] });
  return {
    open: useMutation({
      mutationFn: () => postJson<{ run: MonthlyRitualRun }>(
        `${BASE}${API_ENDPOINTS.monthlyRitual.open.replace(/^\//, "")}`,
      ),
      onSuccess: invalidate,
    }),
    complete: useMutation({
      mutationFn: () => postJson<{ run: MonthlyRitualRun }>(
        `${BASE}${API_ENDPOINTS.monthlyRitual.completeChallenge.replace(/^\//, "")}`,
      ),
      onSuccess: invalidate,
    }),
    updatePreferences: useMutation({
      mutationFn: (patch: Partial<MonthlyRitualPreferences>) => patchJson<{ preferences: MonthlyRitualPreferences }>(
        `${BASE}${API_ENDPOINTS.monthlyRitual.preferences.replace(/^\//, "")}`,
        patch,
      ),
      onSuccess: invalidate,
    }),
  };
}
