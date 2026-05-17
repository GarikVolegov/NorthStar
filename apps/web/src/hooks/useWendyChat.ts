import { useState, useCallback, useRef } from 'react';
import { useSSEStream } from './useSSEStream.js';
import { useTTS } from './useTTS.js';
import { useSTT } from './useSTT.js';
import { useWendyOpenAITTS } from './useWendyOpenAITTS.js';
import { useWendy } from '../contexts/WendyProvider';
import { TOKEN_STORAGE_KEY } from '../lib/storage-keys';

/**
 * useWendyChat — orchestratore stato completo chat Wendy
 *
 * Novità v2:
 *   - sendContextualMessage(): messaggio con contesto iniettato + prefill
 *   - citations: lista fonti RAG ricevute via SSE prima del testo
 *   - sendFeedback(): 👍/👎 + nota opzionale per Human-in-the-Loop
 *   - history: inviato al backend per mantenere la coerenza di sessione
 */

export type MessageRole = 'user' | 'assistant' | 'error';

export interface RagCitation {
  nodeId: number;
  title:  string;
  type:   string;
  score:  number;       // percentuale 0-100
  url:    string | null;
}

export interface ChatMessage {
  id:           string;
  role:         MessageRole;
  content:      string;
  timestamp:    number;
  isStreaming?: boolean;
  thinkingMs?:  number;
  citations?:   RagCitation[];   // fonti KB alleggate al messaggio
  feedback?:    'up' | 'down';   // voto utente
  context?:     string;          // prompt contestuale usato (debug)
  uiTool?:      { name: string; args: Record<string, unknown> };
}

export interface ThinkingPhase {
  active:    boolean;
  label:     string;
  startedAt: number;
}

export interface ContextualAction {
  id:          string;
  label:       string;      // es. "Spiega il mio RIASEC"
  prompt:      string;      // prompt completo inviato a Wendy
  prefillText?: string;     // testo pre-compilato visibile nell'input
}

const THINKING_LABELS = [
  'Wendy sta pensando…',
  'Sto analizzando il contesto…',
  'Elaboro la risposta…',
  'Un momento…',
];

const FATAL_ERRORS = ['ML_SERVICE_UNAVAILABLE', 'UNAUTHORIZED', 'FORBIDDEN'];

export interface UseWendyChatOptions {
  apiUrl?:            string;
  ttsEnabled?:        boolean;
  sttLang?:           string;
  maxRetries?:        number;
  onMessageComplete?: (message: ChatMessage) => void;
}

export interface UseWendyChatReturn {
  messages:                ChatMessage[];
  thinking:                ThinkingPhase;
  isStreaming:             boolean;
  streamError:             Error | null;
  sendMessage:             (text: string) => Promise<void>;
  sendContextualMessage:   (action: ContextualAction) => Promise<void>;
  sendFeedback:            (messageId: string, vote: 'up' | 'down', note?: string) => Promise<void>;
  stopStream:              () => void;
  clearHistory:            () => void;
  retryLast:               () => Promise<void>;
  tts:                     ReturnType<typeof useTTS>;
  ttsEnabled:              boolean;
  toggleTts:               () => void;
  openaiTts:               ReturnType<typeof useWendyOpenAITTS>;
  stt:                     ReturnType<typeof useSTT>;
  commitSTT:               () => void;
}

// ── Compressione history ────────────────────────────────────────────────────

const KEEP_RAW_TURNS = 6; // turni raw nel prompt; i precedenti diventano summary
const COMPRESS_AFTER = 8; // soglia: oltre N turni si attiva la compressione

interface CompressedHistory {
  summary?:       string;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  totalTurns:     number;
}

function buildCompressedHistory(
  rawHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingSummary?: string,
): CompressedHistory {
  const totalTurns = rawHistory.length;

  if (totalTurns <= COMPRESS_AFTER) {
    // Nessuna compressione necessaria: passa tutto
    return { summary: existingSummary, recentMessages: rawHistory, totalTurns };
  }

  // Tieni solo gli ultimi KEEP_RAW_TURNS messaggi raw
  const recentMessages = rawHistory.slice(-KEEP_RAW_TURNS);

  // Il summary dei turni vecchi viene mantenuto da fuori (sessionStorage o prop)
  // Se non c'è ancora un summary, creiamo un placeholder strutturato
  const summary = existingSummary ?? _buildFallbackSummary(rawHistory.slice(0, -KEEP_RAW_TURNS));

  return { summary, recentMessages, totalTurns };
}

/** Costruisce un summary minimale dai messaggi vecchi (nessuna LLM call). */
function _buildFallbackSummary(
  oldMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  if (oldMessages.length === 0) return '';
  const lines = oldMessages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => `• ${m.content.slice(0, 120)}`);
  return `[Riepilogo turni precedenti]\n${lines.join('\n')}`;
}

// ── Hook principale ─────────────────────────────────────────────────────────

export function useWendyChat(options: UseWendyChatOptions = {}): UseWendyChatReturn {
  const {
    apiUrl    = '/api/ai/wendy',  // nuovo entrypoint unificato
    ttsEnabled: initTts = true,
    sttLang   = 'it-IT',
    maxRetries = 2,
    onMessageComplete,
  } = options;

  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [thinking,   setThinking]   = useState<ThinkingPhase>({
    active: false, label: THINKING_LABELS[0], startedAt: 0,
  });
  const [ttsEnabled, setTtsEnabled] = useState(initTts);
  const [streamError, setStreamError] = useState<Error | null>(null);

  const lastUserMessageRef      = useRef<string>('');
  const retriesRef              = useRef(0);
  const assistantMsgIdRef       = useRef<string>('');
  const thinkingStartRef        = useRef(0);
  const firstChunkReceivedRef   = useRef(false);
  const pendingCitationsRef     = useRef<RagCitation[]>([]);

  // Mantiene la history da inviare al backend (ultime 20 coppie user/assistant)
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Summary dei turni compressi (aggiornato dal backend via SSE "summary" event)
  const threadSummaryRef = useRef<string | undefined>(undefined);

  const tts = useTTS();
  const stt = useSTT({ lang: sttLang });
  const openaiTts = useWendyOpenAITTS();

  // Global Wendy phase + page context
  let _setPhase: ((p: 'idle' | 'thinking' | 'speaking' | 'listening') => void) | null = null;
  let _wendyCtx: ReturnType<typeof useWendy> | null = null;
  try { _wendyCtx = useWendy(); _setPhase = _wendyCtx.setPhase; } catch {}

  // ─── SSE stream ──────────────────────────────────────────────────────────────

  const { start: startStream, stop: stopStream, isStreaming } = useSSEStream({
    // Intercetta eventi SSE speciali (rag_citations) prima del testo
    onRawChunk: (raw: string) => {
      try {
        const data = JSON.parse(raw);
        if (data?.type === 'rag_citations' && Array.isArray(data.citations)) {
          pendingCitationsRef.current = data.citations as RagCitation[];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, citations: data.citations }
                : m,
            ),
          );
          return true;
        }
        if (data?.type === 'ui_tool' && data?.name) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? {
                    ...m,
                    uiTool: { name: data.name as string, args: data.args as Record<string, unknown> },
                  }
                : m,
            ),
          );
          return true;
        }
        if (data?.choices?.[0]?.delta?.content !== undefined && !firstChunkReceivedRef.current) {
          firstChunkReceivedRef.current = true;
          setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
        }
      } catch {
        // ignore JSON parse errors
      }
      return false; // gestisci normalmente
    },

    onComplete: (finalContent) => {
      const thinkingMs = firstChunkReceivedRef.current
        ? Date.now() - thinkingStartRef.current : 0;

      const completedMsg: ChatMessage = {
        id:          assistantMsgIdRef.current,
        role:        'assistant',
        content:     finalContent,
        timestamp:   Date.now(),
        isStreaming: false,
        thinkingMs,
        citations:   pendingCitationsRef.current,
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgIdRef.current
            ? { ...m, content: finalContent, isStreaming: false, thinkingMs,
                citations: pendingCitationsRef.current }
            : m,
        ),
      );

      // Aggiorna history per la prossima richiesta
      const newEntries: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user',      content: lastUserMessageRef.current },
        { role: 'assistant', content: finalContent },
      ];
      historyRef.current = [
        ...historyRef.current,
        ...newEntries,
      ].slice(-40); // max 20 coppie

      pendingCitationsRef.current = [];
      setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
      retriesRef.current = 0;

      if (_setPhase) _setPhase('idle');
      if (ttsEnabled) {
        openaiTts.play(finalContent).catch(() => {
          if (tts.supported) tts.speak(finalContent, sttLang);
        });
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
      if (_setPhase) _setPhase('idle');
      setStreamError(err);
      setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'error',
          content: _friendlyError(err), timestamp: Date.now() },
      ]);
    },
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function _friendlyError(err: Error): string {
    if (err.message.includes('504') || err.message.includes('408'))
      return 'Wendy non risponde. Controlla la connessione e riprova.';
    if (err.message.includes('503'))
      return 'Il servizio AI è momentaneamente non disponibile. Riprova tra qualche istante.';
    if (err.message.includes('401') || err.message.includes('403'))
      return 'Sessione scaduta. Effettua nuovamente il login.';
    return 'Qualcosa è andato storto. Riprova o ricarica la pagina.';
  }

  async function _doStream(text: string, contextPrompt?: string) {
    const msgId = `assistant-${Date.now()}`;
    assistantMsgIdRef.current      = msgId;
    thinkingStartRef.current       = Date.now();
    firstChunkReceivedRef.current  = false;
    pendingCitationsRef.current    = [];

    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: Date.now(),
        isStreaming: true, context: contextPrompt },
    ]);

    const labelIdx = Math.floor(Math.random() * THINKING_LABELS.length);
    setThinking({ active: true, label: THINKING_LABELS[labelIdx], startedAt: Date.now() });
    setStreamError(null);

    if (_setPhase) _setPhase('thinking');

    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Comprimi la history prima di inviarla
    const compressed = buildCompressedHistory(historyRef.current, threadSummaryRef.current);

    // Page context dal WendyProvider (se disponibile)
    const currentPage = _wendyCtx?.pageContext;
    const pageContext = currentPage ? {
      page:       currentPage.page,
      entityType: (currentPage.data?.entityType as string) ?? undefined,
      entityId:   (currentPage.data?.entityId as number)   ?? undefined,
      entityName: (currentPage.data?.entityName as string) ?? undefined,
      journeyType:(currentPage.data?.journeyType as string)?? undefined,
    } : undefined;

    await startStream(apiUrl, {
      method:      'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        message:           contextPrompt ?? text,
        compressedHistory: compressed,
        pageContext,
        locale:            navigator.language?.slice(0, 2) ?? 'it',
        // threadId opzionale — da passare se si gestiscono sessioni multiple
      }),
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    lastUserMessageRef.current = trimmed;
    retriesRef.current = 0;
    tts.stop();
    openaiTts.stop();
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
    ]);
    await _doStream(trimmed);
  }, [isStreaming, tts, openaiTts]);

  /**
   * Invia un'azione contestuale: mostra il prefillText nella chat
   * come messaggio user, ma manda il prompt completo (con contesto) a Wendy.
   */
  const sendContextualMessage = useCallback(async (action: ContextualAction) => {
    if (isStreaming) return;
    tts.stop();
    openaiTts.stop();
    lastUserMessageRef.current = action.prompt;
    retriesRef.current = 0;

    // Messaggio visibile: usa prefillText o label dell'azione
    const visibleText = action.prefillText ?? action.label;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: visibleText, timestamp: Date.now() },
    ]);

    // Stream con il prompt completo (invisibile all'utente)
    await _doStream(visibleText, action.prompt);
  }, [isStreaming, tts, openaiTts]);

  /**
   * Invia il feedback 👍/👎 per un messaggio specifico.
   * Aggiorna lo stato locale immediatamente, poi fa la chiamata API.
   */
  const sendFeedback = useCallback(async (
    messageId: string,
    vote: 'up' | 'down',
    note?: string,
  ) => {
    // Ottimistic update
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, feedback: vote } : m),
    );

    try {
      await fetch('/api/v1/ai/chat/feedback', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messageId,
          vote,
          note: note ?? null,
          // Contesto: messaggio utente precedente + risposta Wendy
          context: messages
            .filter((m) => m.id === messageId || (
              m.role === 'user' &&
              messages.findIndex((x) => x.id === messageId) ===
              messages.findIndex((x) => x.id === m.id) + 1
            ))
            .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }))
            .slice(-2),
        }),
      });
    } catch (err) {
      console.warn('[useWendyChat] sendFeedback failed:', err);
      // Non rollback: il feedback ottimistic rimane visibile, non è critico
    }
  }, [messages]);

  const retryLast = useCallback(async () => {
    if (!lastUserMessageRef.current || isStreaming) return;
    retriesRef.current = 0;
    setMessages((prev) => prev.filter((m) => m.role !== 'error').slice(0, -1));
    await _doStream(lastUserMessageRef.current);
  }, [isStreaming]);

  const clearHistory = useCallback(() => {
    stopStream();
    tts.stop();
    openaiTts.stop();
    setMessages([]);
    historyRef.current = [];
    setStreamError(null);
    setThinking({ active: false, label: THINKING_LABELS[0], startedAt: 0 });
  }, [stopStream, tts, openaiTts]);

  const toggleTts = useCallback(() => {
    setTtsEnabled((v) => { if (v) { tts.stop(); openaiTts.stop(); } return !v; });
  }, [tts, openaiTts]);

  const commitSTT = useCallback(() => {
    const text = (stt.transcript + stt.interimTranscript).trim();
    stt.stop();
    stt.reset();
    if (text) sendMessage(text);
  }, [stt, sendMessage]);

  return {
    messages, thinking, isStreaming, streamError,
    sendMessage, sendContextualMessage, sendFeedback,
    stopStream, clearHistory, retryLast,
    tts, ttsEnabled, toggleTts,
    openaiTts,
    stt, commitSTT,
  };
}
