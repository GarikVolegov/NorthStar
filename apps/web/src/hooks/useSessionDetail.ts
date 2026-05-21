import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface SessionDetail {
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
}

export function useSessionDetail(sessionId: number | null) {
  return useQuery<SessionDetail>({
    queryKey: ["session-detail", sessionId],
    enabled: !!sessionId,
    staleTime: 600_000,
    queryFn: async () => {
      return getJson<SessionDetail>(`${BASE}api/test-sessions/${sessionId}`);
    },
  });
}
