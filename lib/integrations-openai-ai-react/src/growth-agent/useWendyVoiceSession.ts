/**
 * useWendyVoiceSession — Phase 3 bridge hook
 *
 * Collega il ciclo TTS/STT di Wendy (useVoiceStream) con:
 *   1. useGrowthChat.sendMessage({ voiceMode: true })   → Wendy risponde in voce
 *   2. useVoiceSession (start / complete / abandon)     → gamification XP + streak
 *
 * CICLO DI VITA:
 *   startVoiceSession()
 *     ├─ useVoiceSession.start("wendy")    → crea record in voice_sessions
 *     └─ inizia la registrazione audio
 *
 *   onUserTranscript(transcript)
 *     └─ useGrowthChat.sendMessage(transcript, { voiceMode: true })
 *
 *   onComplete(fullTranscript)
 *     └─ useVoiceSession.complete({ durationSeconds, summary: fullTranscript })
 *         → assegna XP, aggiorna streak
 *
 *   stopVoiceSession()
 *     └─ useVoiceSession.abandon()  (se ancora ongoing)
 *
 * USAGE:
 *   const wendy = useWendyVoiceSession({ token, userContext });
 *   <button onClick={wendy.startVoiceSession}>Parla con Wendy</button>
 *   <button onClick={wendy.stopVoiceSession}>Termina</button>
 *   {wendy.reward && <XpRewardToast {...wendy.reward} onClose={wendy.clearReward} />}
 */
import { useCallback, useRef, useState } from "react";
import { useGrowthChat, type UseGrowthChatOptions } from "./useGrowthChat";
import { useVoiceSession, type SessionResult } from "@/lib/api-client-react/src/hooks/useVoiceSession";
import { useVoiceStats }   from "@/lib/api-client-react/src/hooks/useVoiceStats";

export interface UseWendyVoiceSessionOptions extends UseGrowthChatOptions {
  /** Worklet path needed by useVoiceStream — forwarded to the consumer */
  workletPath?: string;
  /** Called when a voice session completes with its XP reward */
  onSessionComplete?: (result: SessionResult) => void;
}

export interface WendyVoiceReward {
  xpAwarded:    number;
  newStreak:    number;
  totalXp:      number;
  streakBumped: boolean;
}

export function useWendyVoiceSession(opts: UseWendyVoiceSessionOptions) {
  const { onSessionComplete, workletPath = "/audio-playback-worklet.js", ...chatOpts } = opts;

  // ── Core hooks ──────────────────────────────────────────────────────────
  const chat    = useGrowthChat(chatOpts);
  const session = useVoiceSession();
  const { refetch: refetchStats } = useVoiceStats();

  // ── Local state ─────────────────────────────────────────────────────────
  const [reward,       setReward]       = useState<WendyVoiceReward | null>(null);
  const [voiceActive,  setVoiceActive]  = useState(false);

  const startTimeRef   = useRef<number>(0);
  const transcriptRef  = useRef<string>("");

  // ── Handlers forwarded to useVoiceStream ────────────────────────────────

  /**
   * Called by useVoiceStream when the STT engine produces a user transcript.
   * Sends the text to Wendy in voiceMode so she answers in 2-3 frasi (gpt-4o-mini).
   */
  const onUserTranscript = useCallback(async (text: string) => {
    transcriptRef.current += (transcriptRef.current ? " " : "") + text;
    await chat.sendMessage(text, { voiceMode: true });
  }, [chat]);

  /**
   * Called by useVoiceStream when the full TTS exchange is done.
   * Completes the gamification session.
   */
  const onVoiceStreamComplete = useCallback(async (fullTranscript: string) => {
    if (session.phase !== "ongoing") return;

    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const result = await session.complete({
      durationSeconds,
      summary: fullTranscript.slice(0, 1000),
    });

    if (result) {
      const r: WendyVoiceReward = {
        xpAwarded:    result.xpAwarded,
        newStreak:    result.newStreak,
        totalXp:      result.totalXp,
        streakBumped: result.streakBumped,
      };
      setReward(r);
      void refetchStats();
      onSessionComplete?.(result);
    }

    setVoiceActive(false);
    transcriptRef.current = "";
  }, [session, refetchStats, onSessionComplete]);

  /**
   * Called when useVoiceStream encounters an unrecoverable error.
   * Abandons the gamification session (no XP awarded).
   */
  const onVoiceStreamError = useCallback(async (_err: Error) => {
    if (session.phase === "ongoing") {
      await session.abandon();
    }
    setVoiceActive(false);
    transcriptRef.current = "";
  }, [session]);

  // ── Public controls ─────────────────────────────────────────────────────

  /**
   * Starts a new Wendy voice session.
   * Automatically creates the gamification session record.
   */
  const startVoiceSession = useCallback(async () => {
    if (voiceActive) return;
    session.reset();
    const id = await session.start("wendy");
    if (!id) return;                // start failed — error already in session.error
    startTimeRef.current  = Date.now();
    transcriptRef.current = "";
    setVoiceActive(true);
  }, [voiceActive, session]);

  /**
   * Manually stops an ongoing voice session without completing it.
   * Marks the session as abandoned (no XP).
   */
  const stopVoiceSession = useCallback(async () => {
    if (!voiceActive) return;
    await session.abandon();
    setVoiceActive(false);
    transcriptRef.current = "";
  }, [voiceActive, session]);

  const clearReward = useCallback(() => {
    setReward(null);
    session.reset();
  }, [session]);

  // ── Expose ───────────────────────────────────────────────────────────────
  return {
    // Chat state (messages, isStreaming, error…)
    ...chat,

    // Voice session state
    voiceActive,
    sessionPhase:  session.phase,
    sessionError:  session.error,

    // Reward (shown after complete)
    reward,
    clearReward,

    // Lifecycle controls
    startVoiceSession,
    stopVoiceSession,

    // Callbacks forwarded to useVoiceStream
    voiceStreamCallbacks: {
      workletPath,
      onUserTranscript,
      onComplete:  onVoiceStreamComplete,
      onError:     onVoiceStreamError,
    },
  };
}
