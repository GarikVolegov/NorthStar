import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { BASE } from "./homeConstants";
import type { HomeNewsItem, LatestResult, TrendingSector } from "./homeTypes";

export function useHomeNews() {
  return useQuery<{ news: HomeNewsItem[] }>({
    queryKey: ["home-news"],
    queryFn: () =>
      getJson<{ news: HomeNewsItem[] }>(
        `${BASE}api/news?multi=true&categories=technology,business,education&perCategory=1`,
      ),
    staleTime: 600_000,
  });
}

export function useTrendingSectors() {
  return useQuery<TrendingSector[]>({
    queryKey: ["trending-sectors"],
    queryFn: () => getJson<TrendingSector[]>(`${BASE}api/trending-sectors`),
    staleTime: 300_000,
  });
}

export function useLatestRecommendations(enabled: boolean) {
  return useQuery<LatestResult>({
    queryKey: ["latest-recommendations"],
    enabled,
    queryFn: () => getJson<LatestResult>(`${BASE}api/test-sessions/latest`),
    staleTime: 60_000,
    retry: false,
  });
}
