import { apiFetch } from "@/lib/api-fetch";
import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { HomeNewsItem, LatestResult, TrendingSector } from "./types";

const BASE = import.meta.env.BASE_URL || "/";

export function useHomeNews() {
  return useQuery<{ news: HomeNewsItem[] }>({
    queryKey: ["home-news"],
    queryFn: async () => {
      return getJson<{ news: HomeNewsItem[] }>(
        `${BASE}api/news?multi=true&categories=technology,business,education&perCategory=1`,
      );
    },
    staleTime: 600_000,
  });
}

export function useTrendingSectors() {
  return useQuery<TrendingSector[]>({
    queryKey: ["trending-sectors"],
    queryFn: async () => {
      return getJson<TrendingSector[]>(`${BASE}api/trending-sectors`);
    },
    staleTime: 300_000,
  });
}

export function useLatestRecommendations(enabled: boolean) {
  return useQuery<LatestResult>({
    queryKey: ["latest-recommendations"],
    enabled,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/latest`);
      if (!res.ok) throw new Error("No session");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}
