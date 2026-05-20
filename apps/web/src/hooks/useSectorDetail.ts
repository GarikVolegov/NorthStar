import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/apiClient";

const BASE = import.meta.env.BASE_URL || "/";

export interface SectorDetail {
  id: number;
  name: string;
  icon: string;
  description: string;
  trend: string;
  growthRate: number;
  avgSalaryMin: number;
  avgSalaryMax: number;
}

export function useSectorDetail(sectorId: number | null) {
  return useQuery<SectorDetail>({
    queryKey: ["sector-detail", sectorId],
    enabled: !!sectorId,
    queryFn: () => getJson<SectorDetail>(`${BASE}api/sectors/${sectorId}`),
    staleTime: 600_000,
  });
}
