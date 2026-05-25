import { useCallback, useState } from "react";
import type { MemoryGraphOverview } from "../adminReviewTypes";
import {
  backfillMemoryGraphUser,
  fetchMemoryGraphOverview,
  reviewMemoryGraphRelation,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useMemoryGraph(
  apiFetch: AdminReviewApiFetch,
  onError: (message: string) => void,
) {
  const [data, setData] = useState<MemoryGraphOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [backfillUserId, setBackfillUserId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchMemoryGraphOverview(apiFetch));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch]);

  const runBackfill = useCallback(async () => {
    const userId = Number(backfillUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      onError("Inserisci un userId valido per il backfill memoria.");
      return;
    }
    setActionLoading("backfill");
    try {
      await backfillMemoryGraphUser(apiFetch, userId);
      await load();
    } catch {
      /* handled by apiFetch */
    }
    setActionLoading(null);
  }, [apiFetch, backfillUserId, load, onError]);

  const reviewRelation = useCallback(
    async (id: number, action: "approve" | "reject") => {
      setActionLoading(`${action}:${id}`);
      try {
        await reviewMemoryGraphRelation(apiFetch, id, action);
        await load();
      } catch {
        /* handled by apiFetch */
      }
      setActionLoading(null);
    },
    [apiFetch, load],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setBackfillUserId("");
    setActionLoading(null);
  }, []);

  return {
    data,
    loading,
    backfillUserId,
    actionLoading,
    setBackfillUserId,
    load,
    runBackfill,
    reviewRelation,
    reset,
  };
}
