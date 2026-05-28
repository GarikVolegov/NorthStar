import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";

export interface PinnedSector {
  userId: number;
  sectorId: number;
  sectorName: string | null;
  pinnedAt: string;
}

export interface PinnedSectorsResponse {
  pinnedSectors: PinnedSector[];
}

export const PINNED_SECTORS_QUERY_KEY = ["/api/pinned-sectors"] as const;

export function usePinnedSectors() {
  return useQuery({
    queryKey: PINNED_SECTORS_QUERY_KEY,
    queryFn: () =>
      customFetch<PinnedSectorsResponse>("/api/pinned-sectors", {
        method: "GET",
        responseType: "json",
      }),
    staleTime: 60_000,
  });
}

export function usePinSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectorId: number) =>
      customFetch<{ ok: boolean }>("/api/pinned-sectors", {
        method: "POST",
        responseType: "json",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectorId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PINNED_SECTORS_QUERY_KEY }),
  });
}

export function useUnpinSector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectorId: number) =>
      customFetch<{ ok: boolean }>(`/api/pinned-sectors/${sectorId}`, {
        method: "DELETE",
        responseType: "json",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PINNED_SECTORS_QUERY_KEY }),
  });
}
