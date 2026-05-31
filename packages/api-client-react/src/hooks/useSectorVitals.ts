import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

export type VitalKey = "pulse" | "oxygen" | "temperature" | "pressure" | "adrenaline";
export type VitalStatus = "green" | "yellow" | "red";

export interface VitalSign {
  key: VitalKey;
  value: number;
  status: VitalStatus;
  sparkline: number[];
  delta: number;
  source: string;
}

export interface VitalSigns {
  sectorId: number;
  computedAt: string;
  geography: string;
  signs: Record<VitalKey, VitalSign>;
  summary?: string;
}

export function getSectorVitalsQueryKey(sectorId: number, geography = "IT") {
  return ["/api/sectors", sectorId, "vitals", geography] as const;
}

export async function getSectorVitals(sectorId: number, geography = "IT", options?: RequestInit) {
  const query = new URLSearchParams({ geography });
  return customFetch<VitalSigns>(`/api/sectors/${sectorId}/vitals?${query.toString()}`, {
    ...options,
    method: "GET",
    responseType: "json",
  });
}

export function useSectorVitals<TData = VitalSigns>(
  sectorId: number,
  geography = "IT",
  options?: {
    query?: UseQueryOptions<VitalSigns, Error, TData>;
    request?: RequestInit;
  },
) {
  const queryKey = options?.query?.queryKey ?? getSectorVitalsQueryKey(sectorId, geography);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getSectorVitals(sectorId, geography, { signal, ...options?.request }),
    enabled: sectorId > 0,
    staleTime: 60 * 60 * 1000,
    ...options?.query,
  });
}

export function useSectorVitalsSummary() {
  return useMutation({
    mutationFn: ({ sectorId, geography = "IT" }: { sectorId: number; geography?: string }) =>
      customFetch<{ summary: string }>(`/api/sectors/${sectorId}/vitals/summary`, {
        method: "POST",
        responseType: "json",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geography }),
      }),
  });
}
