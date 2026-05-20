import { postJson } from "@/lib/apiClient";
import { useCallback, useState } from "react";

export type SessionPhase =
  | "idle"
  | "starting"
  | "ongoing"
  | "completing"
  | "done"
  | "error";

export interface SessionResult {
  xpAwarded: number;
  newStreak: number;
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  streakBumped: boolean;
}

export function useVoiceSession() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (agentType?: string) => {
    setPhase("starting");
    setError(null);
    try {
      const data = await postJson<{ sessionId: number; startedAt: string }>(
        "/api/voice/start",
        { agentType },
        { credentials: "include" },
      );
      setSessionId(data.sessionId);
      setPhase("ongoing");
      return data.sessionId;
    } catch (err) {
      setError(String(err));
      setPhase("error");
      return null;
    }
  }, []);

  const complete = useCallback(
    async (opts?: { durationSeconds?: number; summary?: string }) => {
      if (!sessionId) return null;
      setPhase("completing");
      try {
        const data = await postJson<SessionResult>(
          "/api/voice/complete",
          { sessionId, ...opts },
          { credentials: "include" },
        );
        setResult(data);
        setPhase("done");
        return data;
      } catch (err) {
        setError(String(err));
        setPhase("error");
        return null;
      }
    },
    [sessionId],
  );

  const abandon = useCallback(async () => {
    if (!sessionId) return;
    try {
      await postJson(
        "/api/voice/abandon",
        { sessionId },
        { credentials: "include" },
      );
    } catch {
      /* silent */
    }
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
