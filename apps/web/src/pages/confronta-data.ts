import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export type Sector = {
  id: number;
  name: string;
  icon: string;
  description: string;
  riasecTypes: string[];
  skills: string[];
  avgSalaryMin: number;
  avgSalaryMax: number;
  growthRate: number;
  automationRisk: string;
  scalability: string;
  trend: string;
  timeToAutonomy: string;
  advantages: string[];
  disadvantages: string[];
  opportunities: string[];
  color: string;
};

export function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors-compare"],
    queryFn: async () => getJson<Sector[]>(`${BASE}api/sectors`),
    staleTime: 300_000,
  });
}
