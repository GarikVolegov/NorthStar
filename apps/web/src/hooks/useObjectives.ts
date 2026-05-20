import { apiFetch } from "@/lib/api-fetch";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface Objective {
  id: number; text: string; category: string;
  progress: number; completed: boolean; dueDate: string | null;
}

export function useObjectives() {
  return useQuery<Objective[]>({
    queryKey: ["objectives-dashboard"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/objectives/me`);
      if (!res.ok) throw new Error("Errore obiettivi");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}
