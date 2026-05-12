import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

export interface GrowthArticle {
  id: number; title: string; description: string; slug: string;
  category: string; readTimeMinutes: number | null; difficulty: string;
}

export function usePersonalizedArticles() {
  return useQuery<{ articles: GrowthArticle[]; hasProfile: boolean }>({
    queryKey: ["crescita-per-te-dashboard"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/crescita/per-te`);
      if (!res.ok) throw new Error("Errore articoli");
      return res.json();
    },
    staleTime: 300_000,
    retry: false,
  });
}
