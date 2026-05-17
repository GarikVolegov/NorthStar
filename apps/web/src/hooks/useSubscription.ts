/**
 * useSubscription — piano abbonamento corrente dell'utente.
 *
 * Fornisce:
 *   plan: "free" | "pro" | "team"
 *   isPro: boolean
 *   isTeam: boolean
 *   canAccess(feature): boolean — controlla accesso a feature gate
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";

export type Plan = "free" | "pro" | "team";

export interface SubscriptionData {
  plan:        Plan;
  validUntil:  string | null;
  cancelledAt: string | null;
}

// Feature gate — specchiato dal server (check-feature.ts)
const FEATURE_GATES: Record<string, Plan> = {
  wendy_unlimited:      "pro",
  wendy_focus_mode:     "pro",
  wendy_long_memory:    "pro",
  wendy_briefing_auto:  "pro",
  rag_search:           "pro",
  weak_signals:         "pro",
  unlimited_plans:      "pro",
  export_plan_pdf:      "pro",
  file_upload:          "pro",
  workspace_shared:     "team",
  mentor_mode:          "team",
  team_dashboard:       "team",
};

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

async function fetchSubscription(): Promise<SubscriptionData> {
  const res = await apiFetch("/api/subscription");
  if (!res.ok) return { plan: "free", validUntil: null, cancelledAt: null };
  return res.json() as Promise<SubscriptionData>;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey:   ["subscription"],
    queryFn:    fetchSubscription,
    enabled:    !!user,
    staleTime:  5 * 60 * 1000,
  });

  const plan: Plan = data?.plan ?? "free";

  function canAccess(feature: string): boolean {
    const required = FEATURE_GATES[feature];
    if (!required) return true; // feature non gated
    return PLAN_RANK[plan] >= PLAN_RANK[required];
  }

  return {
    plan,
    isPro:    plan === "pro" || plan === "team",
    isTeam:   plan === "team",
    isFree:   plan === "free",
    validUntil: data?.validUntil,
    canAccess,
    isLoading,
  };
}
