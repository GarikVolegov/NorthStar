import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export type LeaderboardMode = "xp" | "streak" | "weekly";

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  avatarUrl?: string | null;
  totalXp?: number;
  voiceStreak?: number;
  xpEarned?: number;
  sessionsCompleted?: number;
  level?: number;
  isSelf?: boolean;
}

export interface LeaderboardResponse {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  nextCursor: string | null;
  selfRank?: number | null;
}

export function useLeaderboard(mode: LeaderboardMode) {
  return useQuery({
    queryKey: ["leaderboard", mode],
    queryFn: async () =>
      readJsonResponse<LeaderboardResponse>(
        await apiFetch(`${BASE}api/leaderboard?mode=${encodeURIComponent(mode)}&limit=20`),
      ),
    staleTime: 60_000,
  });
}
