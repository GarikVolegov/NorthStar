import { getJson } from "@/lib/apiClient";
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
      return getJson<Objective[]>(`${BASE}api/objectives/me`);
    },
    staleTime: 60_000,
    retry: false,
  });
}
