import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    id: number;
    name: string;
    icon: string;
    description: string;
    avgSalaryMin: number;
    avgSalaryMax: number;
    growthRate: number;
    automationRisk: string;
    trend: string;
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

  // §6.2 FRONTEND_RULES — queryKey come array gerarchico inline (non tramite helper)
  // §6.3 — staleTime 2 min per dati utente (precedente: 60s, sotto il minimo di policy)
  const { data: favorites = [] } = useQuery<Favorite[]>({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/favorites/${user!.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // §6.3 — dati utente: 2 min
  });

  // §6.5 — mutation ottimistica con rollback su errore
  const addMutation = useMutation({
    mutationFn: async (data: AddFavoriteData) => {
      const res = await apiFetch(`${BASE}api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, ...data }),
      });
      if (!res.ok) throw new Error("Errore aggiunta preferito");
      return res.json() as Promise<Favorite>;
    },
    onMutate: async (data: AddFavoriteData) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", user?.id] });
      const previous =
        queryClient.getQueryData<Favorite[]>(["favorites", user?.id]) ?? [];

      const optimistic: Favorite = {
        id: -Date.now(),
        userId: user!.id,
        type: data.type,
        sectorId: data.type === "sector" ? data.sectorId : null,
        articleUrl: data.type === "news" ? data.articleUrl : null,
        articleTitle: data.type === "news" ? data.articleTitle : null,
        articleDescription:
          data.type === "news" ? (data.articleDescription ?? null) : null,
        articleSource: data.type === "news" ? (data.articleSource ?? null) : null,
        articleImage: data.type === "news" ? (data.articleImage ?? null) : null,
        articleCategory:
          data.type === "news" ? (data.articleCategory ?? null) : null,
        createdAt: new Date().toISOString(),
        sector: null,
      };

      queryClient.setQueryData<Favorite[]>(["favorites", user?.id], [
        ...previous,
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["favorites", user?.id], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
    },
  });

  // §6.5 — rimozione ottimistica con rollback su errore
  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`${BASE}api/favorites/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore rimozione preferito");
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["favorites", user?.id] });
      const previous =
        queryClient.getQueryData<Favorite[]>(["favorites", user?.id]) ?? [];
      queryClient.setQueryData<Favorite[]>(
        ["favorites", user?.id],
        previous.filter((f) => f.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["favorites", user?.id], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
    },
  });

  function isSectorFavorite(sectorId: number) {
    return favorites.some((f) => f.type === "sector" && f.sectorId === sectorId);
  }

  function getSectorFavoriteId(sectorId: number): number | undefined {
    return favorites.find(
      (f) => f.type === "sector" && f.sectorId === sectorId,
    )?.id;
  }

  function isNewsFavorite(url: string) {
    return favorites.some((f) => f.type === "news" && f.articleUrl === url);
  }

  function getNewsFavoriteId(url: string): number | undefined {
    return favorites.find(
      (f) => f.type === "news" && f.articleUrl === url,
    )?.id;
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
