import type {
  AdminOverview,
  AgentsOverview,
  AgentsTab,
  WendyQualityOverview,
} from "@/components/admin/console";
import { useCallback, useState } from "react";

import type { AdminReviewApiFetch } from "../api/adminReviewApi";

export function useAdminOverviewPanels(apiFetch: AdminReviewApiFetch) {
  const [agentsRunning, setAgentsRunning] = useState<Set<string>>(new Set());
  const [agentsResult, setAgentsResult] = useState<
    Record<string, { ok: boolean; data: Record<string, unknown> }>
  >({});
  const [newsSectorInput, setNewsSectorInput] = useState("");
  const [agentsOverviewData, setAgentsOverviewData] =
    useState<AgentsOverview | null>(null);
  const [agentsOverviewLoading, setAgentsOverviewLoading] = useState(false);
  const [agentsTab, setAgentsTab] = useState<AgentsTab>("overview");
  const [agentFilter, setAgentFilter] = useState("all");
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentDays, setAgentDays] = useState("30");

  const [qualitaData, setQualitaData] = useState<WendyQualityOverview | null>(
    null,
  );
  const [qualitaLoading, setQualitaLoading] = useState(false);
  const [qualitaDays, setQualitaDays] = useState("30");

  const [homeData, setHomeData] = useState<AdminOverview | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);

  const loadAgentsOverview = useCallback(async () => {
    setAgentsOverviewLoading(true);
    try {
      const data = await apiFetch<AgentsOverview>(
        `/admin/agents/overview?days=${agentDays}&limit=100`,
      );
      setAgentsOverviewData(data);
    } catch {
      /* handled */
    }
    setAgentsOverviewLoading(false);
  }, [agentDays, apiFetch]);

  const loadQualita = useCallback(async () => {
    setQualitaLoading(true);
    try {
      const data = await apiFetch<WendyQualityOverview>(
        `/admin/quality/overview?days=${qualitaDays}&limit=50`,
      );
      setQualitaData(data);
    } catch {
      /* handled */
    }
    setQualitaLoading(false);
  }, [apiFetch, qualitaDays]);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    try {
      const data = await apiFetch<AdminOverview>("/admin/overview");
      setHomeData(data);
    } catch {
      /* handled */
    }
    setHomeLoading(false);
  }, [apiFetch]);

  const triggerAgent = useCallback(
    async (agentKey: string, path: string, body?: Record<string, unknown>) => {
      if (agentsRunning.has(agentKey)) return;
      setAgentsRunning((prev) => new Set(prev).add(agentKey));
      setAgentsResult((prev) => ({
        ...prev,
        [agentKey]: { ok: false, data: { status: "running..." } },
      }));
      try {
        const data = await apiFetch<Record<string, unknown>>(path, {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        });
        setAgentsResult((prev) => ({
          ...prev,
          [agentKey]: { ok: true, data },
        }));
      } catch (err) {
        setAgentsResult((prev) => ({
          ...prev,
          [agentKey]: { ok: false, data: { error: String(err) } },
        }));
      }
      setAgentsRunning((prev) => {
        const next = new Set(prev);
        next.delete(agentKey);
        return next;
      });
      void loadAgentsOverview();
    },
    [agentsRunning, apiFetch, loadAgentsOverview],
  );

  const resetOverviewPanels = useCallback(() => {
    setAgentsOverviewData(null);
    setQualitaData(null);
    setHomeData(null);
  }, []);

  return {
    agentDays,
    agentFilter,
    agentsOverviewData,
    agentsOverviewLoading,
    agentsResult,
    agentsRunning,
    agentsTab,
    agentStatusFilter,
    homeData,
    homeLoading,
    loadAgentsOverview,
    loadHome,
    loadQualita,
    newsSectorInput,
    qualitaData,
    qualitaDays,
    qualitaLoading,
    resetOverviewPanels,
    setAgentDays,
    setAgentFilter,
    setAgentsTab,
    setAgentStatusFilter,
    setNewsSectorInput,
    setQualitaDays,
    triggerAgent,
  };
}
