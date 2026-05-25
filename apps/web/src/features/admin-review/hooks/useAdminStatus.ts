import { useCallback } from "react";
import type { AdminReviewApiFetch } from "../api/adminReviewApi";
import { useAdminOps } from "./useAdminOps";
import { useBusinessMetrics } from "./useBusinessMetrics";

export function useAdminStatus(apiFetch: AdminReviewApiFetch) {
  const business = useBusinessMetrics(apiFetch, "Status business non disponibile.");
  const ops = useAdminOps(apiFetch);
  const businessLoad = business.load;
  const businessReset = business.reset;
  const opsLoad = ops.load;
  const opsReset = ops.reset;

  const loadAll = useCallback(() => {
    void businessLoad();
    void opsLoad();
  }, [businessLoad, opsLoad]);

  const reset = useCallback(() => {
    businessReset();
    opsReset();
  }, [businessReset, opsReset]);

  return {
    data: business.data,
    loading: business.loading,
    error: business.error,
    load: business.load,
    opsData: ops.data,
    opsLoading: ops.loading,
    opsActionLoading: ops.actionLoading,
    opsError: ops.error,
    loadOps: ops.load,
    runOpsAction: ops.runAction,
    toggleMaintenanceMode: ops.toggleMaintenanceMode,
    loadAll,
    reset,
  };
}
