/**
 * useWendyVoiceSession v2 — pageContext awareness.
 *
 * CHANGES vs v1:
 * - Reads WendyPageContext via useWendyPageContext() and deep-merges the
 *   active page context into chatOpts.userContext.pageContext before
 *   instantiating useGrowthChat. This means voice-mode messages also
 *   carry full page awareness (e.g. Wendy knows the user is on the
 *   RIASEC page even when speaking).
 * - The merge is reactive: if the page context changes while the hook is
 *   mounted, the next sendMessage call picks up the updated context.
 *
 * All other behaviour unchanged.
 */
import { useCallback, useRef, useState, useMemo } from "react";
import { useGrowthChat, type UseGrowthChatOptions } from "./useGrowthChat";
import { useWendyPageContext } from "./WendyPageContext";
import { useVoiceSession, type SessionResult } from "@/lib/api-client-react/src/hooks/useVoiceSession";
import { useVoiceStats }   from "@/lib/api-client-react/src/hooks/useVoiceStats";

export interface UseWendyVoiceSessionOptions extends UseGrowthChatOptions {
  workletPath?: string;
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

  // v2: read the global page context set by WendyContextButton
  const { context: pageCtx } = useWendyPageContext();

  // Merge pageCtx into userContext so every sendMessage carries page awareness
  const mergedChatOpts = useMemo<UseGrowthChatOptions>(() => ({
    ...chatOpts,
    userContext: {
      ...chatOpts.userContext,
      pageContext: pageCtx
        ? { pageId: pageCtx.pageId, pageLabel: pageCtx.pageLabel, ...pageCtx.data }
        : chatOpts.userContext?.pageContext,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    chatOpts.token,
    chatOpts.apiBase,
    // Stringify userContext + pageCtx for stable comparison
    JSON.stringify(chatOpts.userContext),
    JSON.stringify(pageCtx),
  ]);

  const chat    = useGrowthChat(mergedChatOpts);
  const session = useVoiceSession();
  const { refetch: refetchStats } = useVoiceStats();

  const [reward,      setReward]      = useState<WendyVoiceReward | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);

  const startTimeRef  = useRef<number>(0);
  const transcriptRef = useRef<string>("");

  const onUserTranscript = useCallback(async (text: string) => {
    transcriptRef.current += (transcriptRef.current ? " " : "") + text;
    await chat.sendMessage(text, { voiceMode: true });
  }, [chat]);

  const onVoiceStreamComplete = useCallback(async (fullTranscript: string) => {
    if (session.phase !== "ongoing") return;
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const result = await session.complete({
      durationSeconds,
      summary: fullTranscript.slice(0, 1000),
    });
    if (result) {
      setReward({
        xpAwarded:    result.xpAwarded,
        newStreak:    result.newStreak,
        totalXp:      result.totalXp,
        streakBumped: result.streakBumped,
      });
      void refetchStats();
      onSessionComplete?.(result);
    }
    setVoiceActive(false);
    transcriptRef.current = "";
  }, [session, refetchStats, onSessionComplete]);

  const onVoiceStreamError = useCallback(async (_err: Error) => {
    if (session.phase === "ongoing") await session.abandon();
    setVoiceActive(false);
    transcriptRef.current = "";
  }, [session]);

  const startVoiceSession = useCallback(async () => {
    if (voiceActive) return;
    session.reset();
    const id = await session.start("wendy");
    if (!id) return;
    startTimeRef.current  = Date.now();
    transcriptRef.current = "";
    setVoiceActive(true);
  }, [voiceActive, session]);

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

  return {
    ...chat,
    voiceActive,
    sessionPhase: session.phase,
    sessionError: session.error,
    reward,
    clearReward,
    startVoiceSession,
    stopVoiceSession,
    voiceStreamCallbacks: {
      workletPath,
      onUserTranscript,
      onComplete: onVoiceStreamComplete,
      onError:    onVoiceStreamError,
    },
  };
}
