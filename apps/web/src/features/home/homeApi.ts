import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BASE } from "./homeConstants";
import type { HomeNewsItem, LatestResult, TrendingSector } from "./homeTypes";

export function useHomeNews() {
  const { i18n } = useTranslation();
  const activeLanguage =
    i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";

  return useQuery<{ news: HomeNewsItem[] }>({
    queryKey: ["home-news", activeLanguage],
    queryFn: () =>
      getJson<{ news: HomeNewsItem[] }>(
        `${BASE}api/news?multi=true&categories=technology,business,education&perCategory=1&locale=${encodeURIComponent(activeLanguage)}`,
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
