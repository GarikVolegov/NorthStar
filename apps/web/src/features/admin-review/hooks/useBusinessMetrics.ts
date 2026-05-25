import type { BusinessStatusSnapshot } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchBusinessStatus,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useBusinessMetrics(
  apiFetch: AdminReviewApiFetch,
  fallbackError = "Metriche business non disponibili.",
) {
  const [data, setData] = useState<BusinessStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBusinessStatus(apiFetch, 30));
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    }
    setLoading(false);
  }, [apiFetch, fallbackError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    load,
    reset,
  };
}
