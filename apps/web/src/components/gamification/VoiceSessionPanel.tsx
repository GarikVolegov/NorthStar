import React, { useState, useEffect, useRef, useCallback } from "react";
import { useVoiceSession, type SessionResult } from "@/hooks/useVoiceSession";
import { useVoiceStats } from "@/hooks/useVoiceStats";
import { XpRewardToast } from "./XpRewardToast";
import { XpStreakBadge } from "./XpStreakBadge";

interface Props {
  agentType?: string;
  onComplete?: (result: SessionResult) => void;
}

export function VoiceSessionPanel({ agentType, onComplete }: Props) {
  const { phase, result, error, start, complete, abandon, reset } = useVoiceSession();
  const { refetch: refetchStats } = useVoiceStats();
  const [elapsed, setElapsed] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "ongoing") {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (phase !== "completing") setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase === "done" && result) {
      setShowToast(true);
      void refetchStats();
      onComplete?.(result);
    }
  }, [phase, result, refetchStats, onComplete]);

  const handleStart = useCallback(async () => { await start(agentType); }, [start, agentType]);
  const handleComplete = useCallback(async () => { await complete({ durationSeconds: elapsed }); }, [complete, elapsed]);
  const handleAbandon = useCallback(async () => { await abandon(); setElapsed(0); }, [abandon]);
  const handleCloseToast = useCallback(() => { setShowToast(false); reset(); }, [reset]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-5 w-full max-w-sm">
        <XpStreakBadge />
        {(phase === "idle" || phase === "error") && (
          <div className="flex flex-col gap-3">
            {phase === "error" && <p className="text-sm text-red-500">⚠️ Errore. Riprova.</p>}
            <button onClick={handleStart} className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-base font-semibold hover:opacity-90 transition-opacity">
              🎤 Inizia sessione vocale
            </button>
          </div>
        )}
        {phase === "starting" && (
          <div className="flex items-center justify-center py-4">
            <span className="animate-spin text-2xl">⌛</span>
            <span className="ml-2 text-sm text-muted-foreground">Connessione in corso…</span>
          </div>
        )}
        {phase === "ongoing" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-2xl font-mono font-bold">{mm}:{ss}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleComplete} className="flex-1 rounded-xl bg-emerald-500 text-white py-3 font-semibold hover:opacity-90 transition-opacity">✅ Termina</button>
              <button onClick={handleAbandon} className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">Annulla</button>
            </div>
          </div>
        )}
        {phase === "completing" && (
          <div className="flex items-center justify-center py-4">
            <span className="animate-spin text-2xl">⌛</span>
            <span className="ml-2 text-sm text-muted-foreground">Salvataggio…</span>
          </div>
        )}
        {phase === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-4xl">🎉</span>
            <p className="text-sm text-muted-foreground text-center">
              Sessione completata!<br />
              <span className="font-semibold text-yellow-500">+{result.xpAwarded} XP</span>
              {result.streakBumped && <> — <span className="text-orange-500">🔥 {result.newStreak}g streak</span></>}
            </p>
            <button onClick={handleCloseToast} className="mt-1 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
              Nuova sessione
            </button>
          </div>
        )}
      </div>
      {showToast && result && (
        <XpRewardToast xpAwarded={result.xpAwarded} newStreak={result.newStreak} streakBumped={result.streakBumped} onClose={handleCloseToast} />
      )}
    </>
  );
}
