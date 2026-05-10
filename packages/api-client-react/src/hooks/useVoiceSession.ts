/**
 * useVoiceSession
 *
 * Hook che gestisce il ciclo di vita di una singola sessione vocale:
 *   start()    → POST /api/voice/start    (crea sessione, salva sessionId)
 *   complete() → POST /api/voice/complete (assegna XP, aggiorna streak)
 *   abandon()  → POST /api/voice/abandon  (annulla senza XP)
 *
 * Ritorna anche { sessionId, phase, result, error }.
 *
 * Usage:
 *   const { start, complete, abandon, phase, result } = useVoiceSession();
 */
import { useState, useCallback } from "react";

export type SessionPhase = "idle" | "starting" | "ongoing" | "completing" | "done" | "error";

export interface SessionResult {
  xpAwarded:    number;
  newStreak:    number;
  totalXp:      number;
  streakBumped: boolean;
}

export function useVoiceSession() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [phase,     setPhase]     = useState<SessionPhase>("idle");
  const [result,    setResult]    = useState<SessionResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const start = useCallback(async (agentType?: string) => {
    setPhase("starting");
    setError(null);
    try {
      const res = await fetch("/api/voice/start", {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ agentType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { sessionId: number; startedAt: string };
      setSessionId(data.sessionId);
      setPhase("ongoing");
      return data.sessionId;
    } catch (err) {
      setError(String(err));
      setPhase("error");
      return null;
    }
  }, []);

  const complete = useCallback(async (opts?: {
    durationSeconds?: number;
    summary?: string;
  }) => {
    if (!sessionId) return null;
    setPhase("completing");
    try {
      const res = await fetch("/api/voice/complete", {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId, ...opts }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SessionResult;
      setResult(data);
      setPhase("done");
      return data;
    } catch (err) {
      setError(String(err));
      setPhase("error");
      return null;
    }
  }, [sessionId]);

  const abandon = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/voice/abandon", {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId }),
      });
    } catch { /* silent */ }
    setPhase("idle");
    setSessionId(null);
  }, [sessionId]);

  const reset = useCallback(() => {
    setSessionId(null);
    setPhase("idle");
    setResult(null);
    setError(null);
  }, []);

  return { sessionId, phase, result, error, start, complete, abandon, reset };
}
