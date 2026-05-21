import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface GrowthArticle {
  id: number; title: string; description: string; slug: string;
  category: string; readTimeMinutes: number | null; difficulty: string;
}

export function usePersonalizedArticles() {
  return useQuery<{ articles: GrowthArticle[]; hasProfile: boolean }>({
    queryKey: ["crescita-per-te-dashboard"],
    queryFn: async () => {
      return getJson<{ articles: GrowthArticle[]; hasProfile: boolean }>(
        `${BASE}api/crescita/per-te`,
      );
    },
    staleTime: 300_000,
    retry: false,
  });
}
