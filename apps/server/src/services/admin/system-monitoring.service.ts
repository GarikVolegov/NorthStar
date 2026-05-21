import type { AdminSystemMetric, AdminSystemRepo } from "../../repos/admin/system.repo";

export function createSystemMonitoringService(repo: AdminSystemRepo) {
  return {
    async getOverview(): Promise<{ metrics: AdminSystemMetric[]; healthy: boolean }> {
      const metrics = await repo.listMetrics();
      return {
        metrics,
        healthy: metrics.every((metric) => Number.isFinite(metric.value)),
      };
    },
  };
}
