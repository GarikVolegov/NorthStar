import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/apiClient";

export interface SectorPreview {
  id: number;
  name: string;
  icon: string;
  color: string;
  description: string;
  trend: "declining" | "stable" | "growing" | "booming";
  growthRate: number;
  automationRisk: "low" | "medium" | "high";
  avgSalaryMin: number;
  avgSalaryMax: number;
  autonomyScore: number;
  stabilityScore: number;
}

async function fetchSectors(): Promise<SectorPreview[]> {
  return getJson<SectorPreview[]>("/api/sectors", { credentials: "include" });
}

export function useSectors() {
  return useQuery<SectorPreview[]>({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
    staleTime: 10 * 60 * 1000, // 10 min — dati quasi statici
    gcTime: 30 * 60 * 1000,
  });
}

export function useSectorsByTrend(trend: SectorPreview["trend"] | null) {
  const query = useSectors();
  return {
    ...query,
    data: trend ? query.data?.filter((s) => s.trend === trend) : query.data,
  };
}
