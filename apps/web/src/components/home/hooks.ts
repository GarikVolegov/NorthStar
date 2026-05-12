import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { HomeNewsItem, TrendingSector, LatestResult } from "./types";

const BASE = import.meta.env.BASE_URL || "/";

export function useHomeNews() {
  return useQuery<{ news: HomeNewsItem[] }>({
    queryKey: ["home-news"],
    queryFn: async () => {
      const res = await fetch(
        `${BASE}api/news?multi=true&categories=technology,business,education&perCategory=1`,
      );
      if (!res.ok) throw new Error("news error");
      return res.json();
    },
    staleTime: 600_000,
  });
}

export function useTrendingSectors() {
  return useQuery<TrendingSector[]>({
    queryKey: ["trending-sectors"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/trending-sectors`);
      if (!res.ok) throw new Error("error");
      return res.json();
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
