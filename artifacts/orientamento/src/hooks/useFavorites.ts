import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

export interface Favorite {
  id: number;
  userId: number;
  type: "sector" | "news";
  sectorId: number | null;
  articleUrl: string | null;
  articleTitle: string | null;
  articleDescription: string | null;
  articleSource: string | null;
  articleImage: string | null;
  articleCategory: string | null;
  label?: string;
  createdAt: string;
  sector: {
    id: number; name: string; icon: string; description: string;
    avgSalaryMin: number; avgSalaryMax: number;
    growthRate: number; automationRisk: string; trend: string;
  } | null;
}

export interface AddSectorFavorite {
  type: "sector";
  sectorId: number;
}

export interface AddNewsFavorite {
  type: "news";
  articleUrl: string;
  articleTitle: string;
  articleDescription?: string;
  articleSource?: string;
  articleImage?: string;
  articleCategory?: string;
}

export type AddFavoriteData = AddSectorFavorite | AddNewsFavorite;

export function useFavorites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery<Favorite[]>({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/favorites/${user!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: async (data: AddFavoriteData) => {
      const res = await fetch(`${BASE}api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, ...data }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}api/favorites/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] }),
  });

  function isSectorFavorite(sectorId: number) {
    return favorites.some((f) => f.type === "sector" && f.sectorId === sectorId);
  }

  function getSectorFavoriteId(sectorId: number): number | undefined {
    return favorites.find((f) => f.type === "sector" && f.sectorId === sectorId)?.id;
  }

  function isNewsFavorite(url: string) {
    return favorites.some((f) => f.type === "news" && f.articleUrl === url);
  }

  function getNewsFavoriteId(url: string): number | undefined {
    return favorites.find((f) => f.type === "news" && f.articleUrl === url)?.id;
  }

  return {
    favorites,
    isSectorFavorite,
    getSectorFavoriteId,
    isNewsFavorite,
    getNewsFavoriteId,
    addFavorite: (data: AddFavoriteData) => addMutation.mutate(data),
    removeFavorite: (id: number) => removeMutation.mutate(id),
    isLoading: addMutation.isPending || removeMutation.isPending,
  };
}
