import { useCallback, useRef, useState } from 'react';
import { useWendy } from '../contexts/WendyProvider';
import { postJson } from '../lib/apiClient';
import { clientLogger } from '../lib/clientLogger';
import { TOKEN_STORAGE_KEY } from '../lib/storage-keys';
import { useSSEStream } from './useSSEStream.js';
import { useSTT } from './useSTT.js';
import { useTTS } from './useTTS.js';
import {
  normalizeWendyAction,
  useWendyActionExecutor,
  type WendyAction,
} from './useWendyActionExecutor';
import { buildCompressedHistory, compactPageData } from './useWendyHistoryCompression';
import { useWendyOpenAITTS } from './useWendyOpenAITTS.js';
import { FATAL_ERRORS, THINKING_LABELS } from './wendy.config';

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
  isStreaming?: boolean | undefined;
  thinkingMs?:  number | undefined;
  citations?:   RagCitation[] | undefined;
  feedback?:    'up' | 'down' | undefined;
  context?:     string | undefined;
  uiTool?:      { name: string; args: Record<string, unknown> } | undefined;
  actions?:     WendyAction[] | undefined;
  requestId?:   string | undefined;   // ID server per il feedback - arriva nel done SSE event
  toolsUsed?:   string[] | undefined; // tool chiamati durante questa risposta
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
  prefillText?: string | undefined;     // testo pre-compilato visibile nell'input
}

export interface UseWendyChatOptions {
  apiUrl?:            string | undefined;
  ttsEnabled?:        boolean | undefined;
  sttLang?:           string | undefined;
  maxRetries?:        number | undefined;
  onMessageComplete?: ((message: ChatMessage) => void) | undefined;
}

export interface UseWendyChatReturn {
  messages:                ChatMessage[];
  thinking:                ThinkingPhase;
  isStreaming:             boolean;
  streamError:             Error | null;
  sendMessage:             (text: string) => Promise<void>;
  sendContextualMessage:   (action: ContextualAction) => Promise<void>;
  sendFeedback:            (
    messageId: string,
    vote: 'up' | 'down',
    note?: 'inaccurate' | 'irrelevant' | 'too_long' | 'too_slow' | 'harmful' | 'other',
  ) => Promise<void>;
  stopStream:              () => void;
  clearHistory:            () => void;
  retryLast:               () => Promise<void>;
  confirmAction:           (messageId: string, actionId: string) => Promise<void>;
  cancelAction:            (messageId: string, actionId: string) => void;
  tts:                     ReturnType<typeof useTTS>;
  ttsEnabled:              boolean;
  toggleTts:               () => void;
  openaiTts:               ReturnType<typeof useWendyOpenAITTS>;
  stt:                     ReturnType<typeof useSTT>;
  commitSTT:               () => void;
}

export function useWendyChat(options: UseWendyChatOptions = {}): UseWendyChatReturn {
  const {
    apiUrl    = '/api/ai/wendy',  // nuovo entrypoint unificato
    ttsEnabled: initTts = true,
    sttLang   = 'it-IT',
    maxRetries = 2,
    onMessageComplete,
  } = options;

  const defaultThinkingLabel = THINKING_LABELS[0] ?? 'Pensando...';

  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [thinking,   setThinking]   = useState<ThinkingPhase>({
    active: false, label: defaultThinkingLabel, startedAt: 0,
  });
  const [ttsEnabled, setTtsEnabled] = useState(initTts);
  const [streamError, setStreamError] = useState<Error | null>(null);

  const lastUserMessageRef      = useRef<string>('');
  const retriesRef              = useRef(0);
  const assistantMsgIdRef       = useRef<string>('');
  const thinkingStartRef        = useRef(0);
  const firstChunkReceivedRef   = useRef(false);
  const pendingCitationsRef     = useRef<RagCitation[]>([]);
  const lastRequestIdRef        = useRef<string | undefined>(undefined);
  const toolsUsedRef            = useRef<string[]>([]);
  const streamedContentRef      = useRef('');
  const hasNonTextOutputRef     = useRef(false);
  const hasTerminalErrorRef     = useRef(false);

  // Mantiene la history da inviare al backend (ultime 20 coppie user/assistant)
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Summary dei turni compressi (aggiornato dal backend via SSE "summary" event)
  const threadSummaryRef = useRef<string | undefined>(undefined);

  const tts = useTTS();
  const stt = useSTT({ lang: sttLang });
  const openaiTts = useWendyOpenAITTS();
  const actionExecutor = useWendyActionExecutor();

  // Global Wendy phase + page context
  let _setPhase: ((p: 'idle' | 'thinking' | 'speaking' | 'listening') => void) | null = null;
  let _wendyCtx: ReturnType<typeof useWendy> | null = null;
  try { _wendyCtx = useWendy(); _setPhase = _wendyCtx.setPhase; } catch {}

  // SSE stream

  const { start: startStream, stop: stopSSEStream, isStreaming } = useSSEStream({
    // Intercetta eventi SSE speciali (rag_citations) prima del testo
    onRawChunk: (raw: string) => {
      try {
        const data = JSON.parse(raw);
        if (data?.type === 'status' && typeof data.value === 'string') {
          if (!firstChunkReceivedRef.current) {
            setThinking((current) => ({
              active: true,
              label: data.value as string,
              startedAt: current.startedAt || Date.now(),
            }));
          }
          return true;
        }
        if (data?.type === 'gate') {
          const message = typeof data.message === 'string'
            ? data.message
            : 'Hai raggiunto un limite di utilizzo di Wendy.';
          hasNonTextOutputRef.current = true;
          hasTerminalErrorRef.current = true;
          setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
          setStreamError(new Error('WENDY_GATE'));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, role: 'error', content: message, isStreaming: false }
                : m,
            ),
          );
          return true;
        }
        if (data?.type === 'error') {
          const technicalMessage = typeof data.message === 'string'
            ? data.message
            : 'Wendy non ha risposto correttamente.';
          const message = 'Wendy si è interrotta. Riprova.';
          hasNonTextOutputRef.current = true;
          hasTerminalErrorRef.current = true;
          setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
          setStreamError(new Error(technicalMessage));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, role: 'error', content: message, isStreaming: false }
                : m,
            ),
          );
          return true;
        }
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
        // Cattura requestId e toolsUsed dal done event
        if (data?.type === 'done') {
          if (data.requestId) lastRequestIdRef.current = data.requestId as string;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, requestId: data.requestId as string | undefined, toolsUsed: [...toolsUsedRef.current] }
                : m,
            ),
          );
        }
        // Cattura tool_call per mostrarlo nella UI
        if (data?.type === 'tool_call' && typeof data.name === 'string') {
          hasNonTextOutputRef.current = true;
          toolsUsedRef.current = [...toolsUsedRef.current, data.name as string];
          const action = normalizeWendyAction({
            name: data.name as string,
            args: data.args as Record<string, unknown> | undefined,
            result: data.result,
          });
          if (action) {
            const nextAction = action.requiresConfirmation ? action : actionExecutor.executeImmediate(action);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgIdRef.current
                  ? { ...m, actions: [...(m.actions ?? []), nextAction] }
                  : m,
              ),
            );
          }
          return true;
        }
        if (data?.type === 'ui_tool' && data?.name) {
          hasNonTextOutputRef.current = true;
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
        const tokenChunk =
          data?.type === 'token' && typeof data.value === 'string'
            ? data.value
            : data?.type === 'token' && typeof data.content === 'string'
              ? data.content
            : data?.type === 'token' && typeof data.text === 'string'
              ? data.text
            : typeof data?.choices?.[0]?.delta?.content === 'string'
              ? data.choices[0].delta.content
              : '';

        if (tokenChunk) {
          streamedContentRef.current += tokenChunk;
          if (!firstChunkReceivedRef.current) {
            firstChunkReceivedRef.current = true;
            setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, content: streamedContentRef.current }
                : m,
            ),
          );
        }
      } catch {
        // ignore JSON parse errors
      }
      return false; // gestisci normalmente
    },

    onComplete: (finalContent) => {
      const completedContent = finalContent || streamedContentRef.current;
      const hasNonTextOutput = hasNonTextOutputRef.current;
      const emptyWithoutOutput = !completedContent.trim() && !hasNonTextOutput;
      const thinkingMs = firstChunkReceivedRef.current
        ? Date.now() - thinkingStartRef.current : 0;

      const completedMsg: ChatMessage = {
        id:          assistantMsgIdRef.current,
        role:        emptyWithoutOutput ? 'error' : 'assistant',
        content:     emptyWithoutOutput
          ? 'Wendy non ha prodotto una risposta. Riprova tra un attimo.'
          : completedContent || '[Azione Wendy proposta o completata]',
        timestamp:   Date.now(),
        isStreaming: false,
        thinkingMs,
        citations:   pendingCitationsRef.current,
      };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgIdRef.current
            ? {
                ...m,
                role: emptyWithoutOutput ? 'error' : m.role,
                content: emptyWithoutOutput
                  ? 'Wendy non ha prodotto una risposta. Riprova tra un attimo.'
                  : completedContent || m.content,
                isStreaming: false,
                thinkingMs,
                citations: pendingCitationsRef.current,
              }
            : m,
        ),
      );

      // Aggiorna history per la prossima richiesta
      if (!emptyWithoutOutput && !hasTerminalErrorRef.current) {
        const assistantHistory = completedContent.trim() || '[Azione Wendy proposta o completata]';
        const newEntries: Array<{ role: 'user' | 'assistant'; content: string }> = [
          { role: 'user',      content: lastUserMessageRef.current },
          { role: 'assistant', content: assistantHistory },
        ];
        historyRef.current = [
          ...historyRef.current,
          ...newEntries,
        ].slice(-40); // max 20 coppie
      } else if (emptyWithoutOutput) {
        setStreamError(new Error('EMPTY_WENDY_RESPONSE'));
      }

      pendingCitationsRef.current = [];
      streamedContentRef.current = '';
      hasNonTextOutputRef.current = false;
      hasTerminalErrorRef.current = false;
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      retriesRef.current = 0;

      if (_setPhase) _setPhase('idle');
      if (ttsEnabled && completedContent.trim()) {
        openaiTts.play(completedContent).catch(() => {
          if (tts.supported) tts.speak(completedContent, sttLang);
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
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      setMessages((prev) => {
        const assistantId = assistantMsgIdRef.current;
        if (assistantId && prev.some((message) => message.id === assistantId && message.isStreaming)) {
          return prev.map((message) =>
            message.id === assistantId
              ? { ...message, role: 'error', content: _friendlyError(err), isStreaming: false }
              : message,
          );
        }
        return [
          ...prev,
          { id: `err-${Date.now()}`, role: 'error',
            content: _friendlyError(err), timestamp: Date.now() },
        ];
      });
    },
  });

  const stopStream = useCallback(() => {
    stopSSEStream();
    setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantMsgIdRef.current
          ? { ...m, isStreaming: false }
          : m,
      ),
    );
    if (_setPhase) _setPhase('idle');
  }, [stopSSEStream, _setPhase]);

  // Helpers

  function _friendlyError(err: Error): string {
    if (err.message.includes('504') || err.message.includes('408'))
      return 'Wendy non risponde. Controlla la connessione e riprova.';
    if (err.message.includes('503'))
      return 'Il servizio AI è momentaneamente non disponibile. Riprova tra qualche istante.';
    if (err.message.includes('401') || err.message.includes('403'))
      return 'Sessione scaduta. Effettua nuovamente il login.';
    return 'Wendy si è interrotta. Riprova.';
  }

  async function _doStream(text: string, contextPrompt?: string) {
    const msgId = `assistant-${Date.now()}`;
    assistantMsgIdRef.current      = msgId;
    thinkingStartRef.current       = Date.now();
    firstChunkReceivedRef.current  = false;
    pendingCitationsRef.current    = [];
    lastRequestIdRef.current       = undefined;
    toolsUsedRef.current           = [];
    streamedContentRef.current     = '';
    hasNonTextOutputRef.current    = false;
    hasTerminalErrorRef.current    = false;

    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: Date.now(),
        isStreaming: true, context: contextPrompt },
    ]);

    const labelIdx = Math.floor(Math.random() * THINKING_LABELS.length);
    setThinking({ active: true, label: THINKING_LABELS[labelIdx] ?? defaultThinkingLabel, startedAt: Date.now() });
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
      data:       compactPageData(currentPage.data),
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
        // threadId opzionale - da passare se si gestiscono sessioni multiple
      }),
    });
  }

  // Public API

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
   * Invia il feedback positivo/negativo per un messaggio specifico.
   * Aggiorna lo stato locale immediatamente, poi fa la chiamata API.
   */
  const sendFeedback = useCallback(async (
    messageId: string,
    vote: 'up' | 'down',
    reason?: 'inaccurate' | 'irrelevant' | 'too_long' | 'too_slow' | 'harmful' | 'other',
  ) => {
    // Ottimistic update locale
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, feedback: vote } : m),
    );

    // Trova il requestId del messaggio (arriva dal done SSE)
    const msg = messages.find((m) => m.id === messageId);
    const requestId = msg?.requestId;
    if (!requestId) {
      clientLogger.warn('[useWendyChat] sendFeedback missing requestId', { messageId });
      return;
    }

    try {
      const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await postJson('/api/ai/wendy/feedback', {
        requestId,
        rating:    vote,
        reason:    reason ?? undefined,
        toolsUsed: msg?.toolsUsed ?? [],
      }, {
        headers,
        credentials: 'include',
      });
    } catch (err) {
      clientLogger.warn('[useWendyChat] sendFeedback failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [messages]);

  const retryLast = useCallback(async () => {
    if (!lastUserMessageRef.current || isStreaming) return;
    retriesRef.current = 0;
    setMessages((prev) => prev.filter((m) => m.role !== 'error').slice(0, -1));
    await _doStream(lastUserMessageRef.current);
  }, [isStreaming]);

  const updateMessageAction = useCallback((
    messageId: string,
    actionId: string,
    update: WendyAction | ((action: WendyAction) => WendyAction),
  ) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          actions: (message.actions ?? []).map((action) => {
            if (action.id !== actionId) return action;
            return typeof update === 'function' ? update(action) : update;
          }),
        };
      }),
    );
  }, []);

  const confirmAction = useCallback(async (messageId: string, actionId: string) => {
    const action = messages
      .find((message) => message.id === messageId)
      ?.actions?.find((item) => item.id === actionId);
    if (!action) return;
    updateMessageAction(messageId, actionId, { ...action, status: 'running', error: undefined });
    const confirmed = await actionExecutor.confirm(action);
    updateMessageAction(messageId, actionId, confirmed);
  }, [actionExecutor, messages, updateMessageAction]);

  const cancelAction = useCallback((messageId: string, actionId: string) => {
    const action = messages
      .find((message) => message.id === messageId)
      ?.actions?.find((item) => item.id === actionId);
    if (!action) return;
    updateMessageAction(messageId, actionId, actionExecutor.cancel(action));
  }, [actionExecutor, messages, updateMessageAction]);

  const clearHistory = useCallback(() => {
    stopStream();
    tts.stop();
    openaiTts.stop();
    setMessages([]);
    historyRef.current = [];
    setStreamError(null);
    setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
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
    stopStream, clearHistory, retryLast, confirmAction, cancelAction,
    tts, ttsEnabled, toggleTts,
    openaiTts,
    stt, commitSTT,
  };
}
