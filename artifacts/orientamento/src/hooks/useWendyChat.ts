import { useState, useCallback, useRef } from 'react';
import { useSSEStream } from './useSSEStream.js';
import { useTTS } from './useTTS.js';
import { useSTT } from './useSTT.js';

/**
 * useWendyChat — orchestratore stato completo chat Wendy
 *
 * Responsabilità:
 *   - Gestione storia messaggi (ChatMessage[])
 *   - Avvio stream SSE verso /api/v1/ai/chat
 *   - Integrazione TTS: lettura automatica risposte completate
 *   - Integrazione STT: trascrizione voce → input testuale
 *   - Thinking state: fase di "elaborazione" prima che arrivi il primo chunk
 *   - Error recovery: retry automatico fino a maxRetries
 *   - Abort: stop esplicito dello stream in corso
 *
 * Architettura:
 *   useWendyChat
 *     ├── useSSEStream   (streaming HTTP, batched flush)
 *     ├── useTTS         (Web Speech Synthesis)
 *     └── useSTT         (Web Speech Recognition)
 */

export type MessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;   // true durante lo stream del messaggio corrente
  thinkingMs?: number;    // ms tra invio e primo chunk ricevuto
}

export interface ThinkingPhase {
  active: boolean;
  label: string;           // es. 'Sto analizzando il tuo profilo…'
  startedAt: number;
}

const THINKING_LABELS = [
  'Wendy sta pensando…',
  'Sto analizzando il contesto…',
  'Elaboro la risposta…',
  'Un momento…',
];

const FATAL_ERRORS = ['ML_SERVICE_UNAVAILABLE', 'UNAUTHORIZED', 'FORBIDDEN'];

export interface UseWendyChatOptions {
  apiUrl?: string;
  ttsEnabled?: boolean;    // default true
  sttLang?: string;        // default 'it-IT'
  maxRetries?: number;     // default 2
  onMessageComplete?: (message: ChatMessage) => void;
}

export interface UseWendyChatReturn {
  messages: ChatMessage[];
  thinking: ThinkingPhase;
  isStreaming: boolean;
  streamError: Error | null;
  sendMessage: (text: string) => Promise<void>;
  stopStream: () => void;
  clearHistory: () => void;
  retryLast: () => Promise<void>;
  // TTS
  tts: ReturnType<typeof useTTS>;
  ttsEnabled: boolean;
  toggleTts: () => void;
  // STT
  stt: ReturnType<typeof useSTT>;
  commitSTT: () => void;    // finalizza trascrizione come messaggio
}

export function useWendyChat(options: UseWendyChatOptions = {}): UseWendyChatReturn {
  const {
    apiUrl = '/api/v1/ai/chat/stream',
    ttsEnabled: initTts = true,
    sttLang = 'it-IT',
    maxRetries = 2,
    onMessageComplete,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState<ThinkingPhase>({
    active: false,
    label: THINKING_LABELS[0],
    startedAt: 0,
  });
  const [ttsEnabled, setTtsEnabled] = useState(initTts);
  const [streamError, setStreamError] = useState<Error | null>(null);

  const lastUserMessageRef = useRef<string>('');
  const retriesRef = useRef(0);
  const assistantMsgIdRef = useRef<string>('');
  const thinkingStartRef = useRef(0);
  const firstChunkReceivedRef = useRef(false);

  const tts = useTTS();
  const stt = useSTT({ lang: sttLang });

  // ─── SSE stream ───────────────────────────────────────────────────────────
  const { start: startStream, stop: stopStream, isStreaming } = useSSEStream({
    onComplete: (finalContent) => {
      const thinkingMs = firstChunkReceivedRef.current
        ? Date.now() - thinkingStartRef.current
        : 0;

      const completedMsg: ChatMessage = {
        id: assistantMsgIdRef.current,
        role: 'assistant',
        content: finalContent,
        timestamp: Date.now(),
        isStreaming: false,
        thinkingMs,
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgIdRef.current
            ? { ...m, content: finalContent, isStreaming: false, thinkingMs }
            : m,
        ),
      );

      setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
      retriesRef.current = 0;

      if (ttsEnabled && tts.supported) {
        tts.speak(finalContent, sttLang);
      }

      onMessageComplete?.(completedMsg);
    },

    onError: (err) => {
      const isFatal = FATAL_ERRORS.some((code) => err.message.includes(code));

      if (!isFatal && retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        setTimeout(() => _doStream(lastUserMessageRef.current), 1000 * retriesRef.current);
        return;
      }

      setStreamError(err);
      setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });

      // Inserisce messaggio errore nella chat
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'error',
          content: _friendlyError(err),
          timestamp: Date.now(),
        },
      ]);
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _friendlyError(err: Error): string {
    if (err.message.includes('504') || err.message.includes('408'))
      return 'Wendy non risponde. Controlla la connessione e riprova.';
    if (err.message.includes('503'))
      return 'Il servizio AI è momentaneamente non disponibile. Riprova tra qualche istante.';
    if (err.message.includes('401') || err.message.includes('403'))
      return 'Sessione scaduta. Effettua nuovamente il login.';
    return 'Qualcosa è andato storto. Riprova o ricarica la pagina.';
  }

  async function _doStream(text: string) {
    const msgId = `assistant-${Date.now()}`;
    assistantMsgIdRef.current = msgId;
    thinkingStartRef.current = Date.now();
    firstChunkReceivedRef.current = false;

    // Placeholder messaggio assistant — aggiornato chunk by chunk
    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
    ]);

    // Thinking phase — rimossa al primo chunk
    const labelIdx = Math.floor(Math.random() * THINKING_LABELS.length);
    setThinking({ active: true, label: THINKING_LABELS[labelIdx], startedAt: Date.now() });
    setStreamError(null);

    await startStream(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: text, history: [] }),
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    lastUserMessageRef.current = trimmed;
    retriesRef.current = 0;
    tts.stop(); // interrompe eventuale TTS precedente

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
    ]);

    await _doStream(trimmed);
  }, [isStreaming, tts]);

  const retryLast = useCallback(async () => {
    if (!lastUserMessageRef.current || isStreaming) return;
    retriesRef.current = 0;
    // Rimuove l'ultimo messaggio errore
    setMessages((prev) => prev.filter((m) => m.role !== 'error').slice(0, -1));
    await _doStream(lastUserMessageRef.current);
  }, [isStreaming]);

  const clearHistory = useCallback(() => {
    stopStream();
    tts.stop();
    setMessages([]);
    setStreamError(null);
    setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
  }, [stopStream, tts]);

  const toggleTts = useCallback(() => {
    setTtsEnabled((v) => {
      if (v) tts.stop();
      return !v;
    });
  }, [tts]);

  const commitSTT = useCallback(() => {
    const text = (stt.transcript + stt.interimTranscript).trim();
    stt.stop();
    stt.reset();
    if (text) sendMessage(text);
  }, [stt, sendMessage]);

  return {
    messages, thinking, isStreaming, streamError,
    sendMessage, stopStream, clearHistory, retryLast,
    tts, ttsEnabled, toggleTts,
    stt, commitSTT,
  };
}
