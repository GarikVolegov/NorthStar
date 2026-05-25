import type { AdminOpsAction, AdminOpsStatus } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchAdminOpsStatus,
  runAdminOpsAction,
  setAdminDatabaseMaintenance,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useAdminOps(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<AdminOpsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAdminOpsStatus(apiFetch));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stato operativo non disponibile.");
    }
    setLoading(false);
  }, [apiFetch]);

  const runAction = useCallback(
    async (action: AdminOpsAction, confirmation: string) => {
      setActionLoading(action);
      setError(null);
      try {
        await runAdminOpsAction(apiFetch, action, confirmation);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Operazione non riuscita.");
      }
      setActionLoading(null);
    },
    [apiFetch, load],
  );

  const toggleMaintenanceMode = useCallback(
    async (enabled: boolean) => {
      setActionLoading("database-maintenance");
      setError(null);
      try {
        await setAdminDatabaseMaintenance(apiFetch, enabled);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Maintenance mode non aggiornata.");
      }
      setActionLoading(null);
    },
    [apiFetch, load],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setActionLoading(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    actionLoading,
    error,
    load,
    runAction,
    toggleMaintenanceMode,
    reset,
  };
}
