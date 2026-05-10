/**
 * useVoiceChat
 *
 * Orchestrates the full voice conversation loop:
 *   1. STT  — listen via useWendyVoice (react-speech-recognition)
 *   2. API  — send transcript to /api/v1/ai/chat/stream with voiceMode:true (SSE)
 *   3. TTS  — auto-play Wendy's reply via Web Speech API
 *
 * The hook is completely self-contained — it shares `history` with the
 * parent WendyChat so that text and voice conversations are interleaved
 * in the same session.
 *
 * States:
 *   idle        — waiting, mic button shown
 *   listening   — STT active, interim transcript shown
 *   thinking    — SSE request in flight, spinner shown
 *   speaking    — TTS playing, avatar pulses
 *   error       — last error message
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useWendyVoice } from './useWendyVoice.js';

export type VoiceChatPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UseVoiceChatOptions {
  /** SSE endpoint — must accept { message, history, voiceMode: true } */
  apiUrl?: string;
  /** Shared history with the text chat (passed by ref so it stays in sync) */
  historyRef: React.MutableRefObject<VoiceChatMessage[]>;
  lang?: string;
}

export interface UseVoiceChatReturn {
  phase: VoiceChatPhase;
  transcript: string;        // live STT transcript shown in overlay
  lastReply: string;         // last Wendy response (shown as bubble)
  errorMessage: string | null;
  startListening: () => void;
  stopAndSend: () => void;
  cancelAll: () => void;     // interrupt speech + abort fetch
  isSupported: boolean;
}

export function useVoiceChat({
  apiUrl = '/api/v1/ai/chat/stream',
  historyRef,
  lang = 'it-IT',
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [phase, setPhase]             = useState<VoiceChatPhase>('idle');
  const [lastReply, setLastReply]     = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 1. Wire up useWendyVoice ────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) {
      setPhase('idle');
      return;
    }

    setPhase('thinking');
    setErrorMessage(null);

    // Optimistically push user turn into shared history
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: text },
    ];

    // ── 2. SSE stream with voiceMode:true ──────────────────────────────────
    abortRef.current = new AbortController();
    let replyBuffer = '';

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortRef.current.signal,
        body: JSON.stringify({
          message:   text,
          history:   historyRef.current.slice(-10), // last 10 turns
          voiceMode: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') replyBuffer += event.value;
            if (event.type === 'done' || event.type === 'error') break;
          } catch { /* partial chunk */ }
        }
      }

      if (!replyBuffer.trim()) throw new Error('Risposta vuota');

      // Push assistant turn into shared history
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: replyBuffer },
      ];

      setLastReply(replyBuffer);
      setPhase('speaking');

      // ── 3. TTS auto-play ─────────────────────────────────────────────────
      voice.speak(replyBuffer);

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setPhase('idle');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setPhase('error');
      }
    }
  }, [apiUrl, historyRef]);

  const voice = useWendyVoice({ onSend: handleSend, lang });

  // When TTS finishes speaking → back to idle
  useEffect(() => {
    if (phase === 'speaking' && !voice.isSpeaking) {
      // small delay so the bubble stays visible a moment
      const t = setTimeout(() => setPhase('idle'), 600);
      return () => clearTimeout(t);
    }
  }, [phase, voice.isSpeaking]);

  // Mirror STT phase
  useEffect(() => {
    if (voice.listening && phase === 'idle') setPhase('listening');
    if (!voice.listening && phase === 'listening') {
      // STT stopped externally (e.g. browser timeout) — treat as send
      handleSend(voice.transcript);
    }
  }, [voice.listening]); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = useCallback(() => {
    setPhase('listening');
    voice.startListening();
  }, [voice]);

  const stopAndSend = useCallback(() => {
    voice.stopAndSend();
  }, [voice]);

  const cancelAll = useCallback(() => {
    abortRef.current?.abort();
    voice.cancelSpeech();
    SpeechRecognition_stop();
    setPhase('idle');
  }, [voice]);

  return {
    phase,
    transcript:   voice.transcript,
    lastReply,
    errorMessage,
    startListening,
    stopAndSend,
    cancelAll,
    isSupported:  voice.isSupported,
  };
}

// tiny shim — avoids importing react-speech-recognition at hook level just for stop
function SpeechRecognition_stop() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).SpeechRecognition?.prototype?.stop?.();
    import('react-speech-recognition').then(({ default: SR }) => SR.stopListening()).catch(() => {});
  } catch { /* silent */ }
}
