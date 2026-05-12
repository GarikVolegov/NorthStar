import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface SectorDetail {
  id: number; name: string; icon: string; description: string;
  trend: string; growthRate: number; avgSalaryMin: number; avgSalaryMax: number;
}

export function useSectorDetail(sectorId: number | null) {
  return useQuery<SectorDetail>({
    queryKey: ["sector-detail", sectorId],
    enabled: !!sectorId,
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors/${sectorId}`);
      if (!res.ok) throw new Error("Errore settore");
      return res.json();
    },
    staleTime: 600_000,
  });
}
