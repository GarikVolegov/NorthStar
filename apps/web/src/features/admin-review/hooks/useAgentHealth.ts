import type { AgentsOverview } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchAgentHealth,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useAgentHealth(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<Pick<AgentsOverview, "agents"> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAgentHealth(apiFetch));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    load,
    reset,
  };
}
