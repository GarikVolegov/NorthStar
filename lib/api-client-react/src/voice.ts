/**
 * voice.ts — React API client hooks for Phase 3 Gamification
 *
 * useVoiceStats()          → polling stats (streak, XP, level)
 * useStartVoiceSession()   → mutation POST /api/voice/start
 * useCompleteVoiceSession()→ mutation POST /api/voice/complete
 * useAbandonVoiceSession() → mutation POST /api/voice/abandon
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/voice";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VoiceStats {
  voiceStreak:        number;
  totalXp:            number;
  currentLevel:       number;
  xpToNextLevel:      number;
  lastVoiceSessionAt: string | null;
  recentSessions:     RecentSession[];
}

export interface RecentSession {
  id:              number;
  status:          "ongoing" | "completed" | "abandoned";
  durationSeconds: number | null;
  xpAwarded:       number;
  agentType:       string | null;
  summary:         string | null;
  startedAt:       string;
  completedAt:     string | null;
}

export interface CompleteResult {
  xpAwarded:    number;
  newStreak:    number;
  totalXp:      number;
  streakBumped: boolean;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchVoiceStats(): Promise<VoiceStats> {
  const res = await fetch(`${BASE}/stats`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function startSession(agentType?: string): Promise<{ sessionId: number; startedAt: string }> {
  const res = await fetch(`${BASE}/start`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ agentType }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function completeSession(payload: {
  sessionId: number;
  durationSeconds?: number;
  summary?: string;
}): Promise<CompleteResult> {
  const res = await fetch(`${BASE}/complete`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function abandonSession(sessionId: number): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/abandon`, {
    method:  "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export const VOICE_STATS_KEY = ["voice", "stats"] as const;

export function useVoiceStats() {
  return useQuery({
    queryKey: VOICE_STATS_KEY,
    queryFn:  fetchVoiceStats,
    staleTime: 30_000,
  });
}

export function useStartVoiceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentType?: string) => startSession(agentType),
    onSuccess: () => qc.invalidateQueries({ queryKey: VOICE_STATS_KEY }),
  });
}

export function useCompleteVoiceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: VOICE_STATS_KEY }),
  });
}

export function useAbandonVoiceSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) => abandonSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: VOICE_STATS_KEY }),
  });
}
