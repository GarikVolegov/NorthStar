import { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalWendy } from '../contexts/WendyProvider';
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
import {
  parseWendySseEvent,
  readNumberField,
  readStringField,
  type WendyContextSource,
} from './useWendyChatSse';
import type {
  ChatMessage,
  ContextualAction,
  RagCitation,
  RetryState,
  ThinkingPhase,
  UseWendyChatOptions,
  UseWendyChatReturn,
} from './useWendyChat.types';
import {
  clearPersistedThread,
  loadPersistedThread,
  savePersistedThread,
  type WendyHistoryEntry,
} from './wendyPersistence';
import { useWendyTabRemoteSync } from './useWendyTabRemoteSync';
import { FATAL_ERRORS, THINKING_LABELS } from './wendy.config';
import { withWendySuggestedPromptFallback } from './wendySuggestedPrompts';

const RECONNECT_DELAY_MS = [1000, 2000, 4000] as const;
const WENDY_PAGE_ENTITY_TYPES = new Set(['sector', 'profession', 'article', 'news']);
const AUTH_SESSION_ERROR_PATTERNS = [
  '401',
  '403',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TOKEN',
  'SESSION_EXPIRED',
  'SESSION EXPIRED',
  'AUTH',
] as const;

function readSupportedWendyEntityType(record: Record<string, unknown> | undefined): string | undefined {
  const entityType = readStringField(record, 'entityType');
  return entityType && WENDY_PAGE_ENTITY_TYPES.has(entityType) ? entityType : undefined;
}

export type {
  ChatMessage,
  ContextualAction,
  MessageRole,
  RagCitation,
  RetryState,
  ThinkingPhase,
  UseWendyChatOptions,
  UseWendyChatReturn,
} from './useWendyChat.types';

export function useWendyChat(options: UseWendyChatOptions = {}): UseWendyChatReturn {
  const {
    apiUrl    = '/api/ai/wendy',  // nuovo entrypoint unificato
    ttsEnabled: initTts = true,
    sttLang   = 'it-IT',
    maxRetries = 2,
    streamTimeoutMs = 60_000,
    restorePersisted = true,
    buildRequestBody,
    onMessageComplete,
  } = options;

  const defaultThinkingLabel = THINKING_LABELS[0] ?? 'Pensando...';

  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [thinking,   setThinking]   = useState<ThinkingPhase>({
    active: false, label: defaultThinkingLabel, startedAt: 0,
  });
  const [ttsEnabled, setTtsEnabled] = useState(initTts);
  const [streamError, setStreamError] = useState<Error | null>(null);
  const [retryState, setRetryState] = useState<RetryState>({ active: false, attempt: 0, max: maxRetries });
  const [restoredFromPersistence, setRestoredFromPersistence] = useState(false);

  const lastUserMessageRef      = useRef<string>('');
  const retriesRef              = useRef(0);
  const assistantMsgIdRef       = useRef<string>('');
  const thinkingStartRef        = useRef(0);
  const firstChunkReceivedRef   = useRef(false);
  const pendingCitationsRef     = useRef<RagCitation[]>([]);
  const lastRequestIdRef        = useRef<string | undefined>(undefined);
  const toolsUsedRef            = useRef<string[]>([]);
  const contextSourcesRef       = useRef<WendyContextSource[]>([]);
  const answerModeRef           = useRef<ChatMessage['answerMode']>(undefined);
  const recoveryRef             = useRef<Record<string, unknown> | undefined>(undefined);
  const adaptiveReasoningRef    = useRef<ChatMessage['adaptiveReasoning']>(undefined);
  const suggestedPromptsRef     = useRef<ChatMessage['suggestedPrompts']>(undefined);
  const streamedContentRef      = useRef('');
  const hasNonTextOutputRef     = useRef(false);
  const hasTerminalErrorRef     = useRef(false);
  const receivedDoneRef         = useRef(false);
  const lastContextPromptRef    = useRef<string | undefined>(undefined);
  const lastIsPredefinedRef     = useRef(false);

  const historyRef = useRef<WendyHistoryEntry[]>([]);

  const threadSummaryRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!restorePersisted) return;
    const persisted = loadPersistedThread();
    if (!persisted || persisted.history.length === 0) return;
    historyRef.current = persisted.history;
    if (persisted.summary) threadSummaryRef.current = persisted.summary;
    if (persisted.messages?.length) {
      setMessages((current) => (current.length === 0 ? persisted.messages ?? [] : current));
    }
    setRestoredFromPersistence(true);
  }, [restorePersisted]);

  const tts = useTTS();
  const stt = useSTT({ lang: sttLang });
  const openaiTts = useWendyOpenAITTS();
  const actionExecutor = useWendyActionExecutor();

  const wendyCtx = useOptionalWendy();
  const setWendyPhase = wendyCtx?.setPhase;

  const { start: startStream, stop: stopSSEStream, isStreaming } = useSSEStream({
    timeoutMs: streamTimeoutMs,
    resetTimeoutOnChunk: true,
    onRawChunk: (raw: string) => {
      const event = parseWendySseEvent(raw);
      if (event.type === 'status') {
          if (!firstChunkReceivedRef.current) {
            setThinking((current) => ({
              active: true,
              label: event.value,
              startedAt: current.startedAt || Date.now(),
            }));
          }
          return true;
        }
        if (event.type === 'gate') {
          hasNonTextOutputRef.current = true;
          hasTerminalErrorRef.current = true;
          streamedContentRef.current = event.message;
          setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
          setStreamError(new Error('WENDY_GATE'));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, role: 'error', content: event.message, isStreaming: false }
                : m,
            ),
          );
          return true;
        }
        if (event.type === 'error') {
          const message = event.message || 'Wendy si è interrotta. Riprova.';
          hasNonTextOutputRef.current = true;
          hasTerminalErrorRef.current = true;
          streamedContentRef.current = message;
          setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
          setStreamError(new Error(event.message));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, role: 'error', content: message, isStreaming: false }
                : m,
            ),
          );
          return true;
        }
        if (event.type === 'rag_citations') {
          pendingCitationsRef.current = event.citations;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? { ...m, citations: event.citations }
                : m,
            ),
          );
          return true;
        }
        if (event.type === 'done') {
          receivedDoneRef.current = true;
          if (event.requestId) lastRequestIdRef.current = event.requestId;
          contextSourcesRef.current = event.contextSources;
          answerModeRef.current = event.answerMode;
          recoveryRef.current = event.recovery;
          adaptiveReasoningRef.current = event.adaptiveReasoning;
          suggestedPromptsRef.current = event.suggestedPrompts;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? {
                    ...m,
                    requestId: event.requestId,
                    toolsUsed: [...toolsUsedRef.current],
                    contextSources: event.contextSources,
                    answerMode: event.answerMode,
                    recovery: event.recovery,
                    adaptiveReasoning: event.adaptiveReasoning,
                    suggestedPrompts: event.suggestedPrompts,
                  }
                : m,
            ),
          );
          return true;
        }
        if (event.type === 'tool_call') {
          hasNonTextOutputRef.current = true;
          toolsUsedRef.current = [...toolsUsedRef.current, event.name];
          const action = normalizeWendyAction({
            name: event.name,
            args: event.args,
            result: event.result,
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
        if (event.type === 'ui_tool') {
          hasNonTextOutputRef.current = true;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgIdRef.current
                ? {
                    ...m,
                    uiTool: { name: event.name, args: event.args },
                  }
                : m,
            ),
          );
          return true;
        }
        if (event.type === 'token') {
          streamedContentRef.current += event.value;
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
      return false; // gestisci normalmente
    },

    onComplete: (finalContent) => {
      if (!receivedDoneRef.current && !hasTerminalErrorRef.current) {
        if (retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          setRetryState({ active: true, attempt: retriesRef.current, max: maxRetries });
          const delay = RECONNECT_DELAY_MS[Math.min(retriesRef.current - 1, RECONNECT_DELAY_MS.length - 1)] ?? 4000;
          setTimeout(() => {
            void _doStream(lastUserMessageRef.current, lastContextPromptRef.current, lastIsPredefinedRef.current);
          }, delay);
          return;
        }

        const interrupted = new Error('SSE_CLOSED_WITHOUT_DONE');
        setStreamError(interrupted);
        setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgIdRef.current
              ? { ...m, role: 'error', content: _friendlyError(interrupted), isStreaming: false }
              : m,
          ),
        );
        setWendyPhase?.('idle');
        return;
      }

      const completedContent = finalContent || streamedContentRef.current;
      const hasNonTextOutput = hasNonTextOutputRef.current;
      const completedHasTerminalError = hasTerminalErrorRef.current;
      const emptyWithoutOutput = !completedContent.trim() && !hasNonTextOutput;
      const thinkingMs = firstChunkReceivedRef.current
        ? Date.now() - thinkingStartRef.current : 0;
      const completedCitations = pendingCitationsRef.current;
      const completedToolsUsed = [...toolsUsedRef.current];
      const completedRequestId = lastRequestIdRef.current;
      const completedContextSources = [...contextSourcesRef.current];
      const completedAnswerMode = answerModeRef.current;
      const completedRecovery = recoveryRef.current;
      const completedAdaptiveReasoning = adaptiveReasoningRef.current;
      const completedSuggestedPrompts = emptyWithoutOutput
        ? []
        : withWendySuggestedPromptFallback(
            suggestedPromptsRef.current,
            completedContent,
            wendyCtx?.pageContext,
          );

      const completedMsg: ChatMessage = {
        id:          assistantMsgIdRef.current,
        role:        emptyWithoutOutput ? 'error' : 'assistant',
        content:     emptyWithoutOutput
          ? 'Wendy non ha prodotto una risposta. Riprova tra un attimo.'
          : completedContent || '[Azione Wendy proposta o completata]',
        timestamp:   Date.now(),
        isStreaming: false,
        thinkingMs,
        citations:   completedCitations,
        toolsUsed: completedToolsUsed,
        requestId: completedRequestId,
        contextSources: completedContextSources,
        answerMode: completedAnswerMode,
        recovery: completedRecovery,
        adaptiveReasoning: completedAdaptiveReasoning,
        suggestedPrompts: completedSuggestedPrompts,
      };

      if (!emptyWithoutOutput && !completedHasTerminalError) {
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

      let completedVisibleMessage: ChatMessage = completedMsg;
      setMessages((prev) => {
        const finalizedMessages = prev.map((m) =>
          m.id === assistantMsgIdRef.current
            ? {
                ...m,
                role: emptyWithoutOutput ? 'error' : m.role,
                content: emptyWithoutOutput
                  ? 'Wendy non ha prodotto una risposta. Riprova tra un attimo.'
                  : completedContent || m.content || '[Azione Wendy proposta o completata]',
                isStreaming: false,
                thinkingMs,
                citations: completedCitations,
                toolsUsed: completedToolsUsed,
                contextSources: completedContextSources,
                answerMode: completedAnswerMode,
                recovery: completedRecovery,
                adaptiveReasoning: completedAdaptiveReasoning,
                suggestedPrompts: completedSuggestedPrompts,
                requestId: completedRequestId,
              }
            : m,
        );

        const finalizedAssistant = finalizedMessages.find((m) => m.id === assistantMsgIdRef.current);
        if (finalizedAssistant) completedVisibleMessage = finalizedAssistant;
        if (!emptyWithoutOutput && !completedHasTerminalError) {
          savePersistedThread(historyRef.current, threadSummaryRef.current, finalizedMessages);
        }
        return finalizedMessages;
      });

      pendingCitationsRef.current = [];
      contextSourcesRef.current = [];
      answerModeRef.current = undefined;
      recoveryRef.current = undefined;
      adaptiveReasoningRef.current = undefined;
      suggestedPromptsRef.current = undefined;
      streamedContentRef.current = '';
      hasNonTextOutputRef.current = false;
      hasTerminalErrorRef.current = false;
      receivedDoneRef.current = false;
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      retriesRef.current = 0;
      setRetryState({ active: false, attempt: 0, max: maxRetries });

      setWendyPhase?.('idle');
      if (ttsEnabled && completedContent.trim() && !completedHasTerminalError) {
        openaiTts.play(completedContent).catch(() => {
          if (tts.supported) tts.speak(completedContent, sttLang);
        });
      }
      onMessageComplete?.(completedVisibleMessage);
    },

    onError: (err) => {
      const isFatal = _isNonRetryableStreamError(err);
      if (!isFatal && retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        setRetryState({ active: true, attempt: retriesRef.current, max: maxRetries });
        setTimeout(() => _doStream(lastUserMessageRef.current, lastContextPromptRef.current, lastIsPredefinedRef.current), 1000 * retriesRef.current);
        return;
      }
      setRetryState({ active: false, attempt: retriesRef.current, max: maxRetries });
      setWendyPhase?.('idle');
      setStreamError(err);
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      setMessages((prev) => {
        const assistantId = assistantMsgIdRef.current;
        const errorContent = _friendlyError(err);
        const suggestedPrompts = withWendySuggestedPromptFallback(undefined, errorContent, wendyCtx?.pageContext);
        if (assistantId && prev.some((message) => message.id === assistantId && message.isStreaming)) {
          return prev.map((message) =>
            message.id === assistantId
              ? { ...message, role: 'error', content: errorContent, isStreaming: false, suggestedPrompts }
              : message,
          );
        }
        return [
          ...prev,
          { id: `err-${Date.now()}`, role: 'error',
            content: errorContent, timestamp: Date.now(), suggestedPrompts },
        ];
      });
    },
  });

  const { broadcastUnlessRemote } = useWendyTabRemoteSync({
    onRemoteStop: () => {
      stopSSEStream();
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      setWendyPhase?.('idle');
    },
    onRemoteClear: () => {
      stopSSEStream();
      setMessages([]);
      historyRef.current = [];
      threadSummaryRef.current = undefined;
      setRestoredFromPersistence(false);
      setStreamError(null);
      setRetryState({ active: false, attempt: 0, max: maxRetries });
      setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
      setWendyPhase?.('idle');
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
    setWendyPhase?.('idle');
    setRetryState({ active: false, attempt: 0, max: maxRetries });
    retriesRef.current = 0;
    broadcastUnlessRemote({ kind: 'stop' });
  }, [stopSSEStream, setWendyPhase, defaultThinkingLabel, maxRetries, broadcastUnlessRemote]);

  // Helpers

  function _friendlyError(err: Error): string {
    if (err.message.includes('504') || err.message.includes('408'))
      return 'Wendy non risponde. Controlla la connessione e riprova.';
    if (err.message.includes('503'))
      return 'Il servizio AI è momentaneamente non disponibile. Riprova tra qualche istante.';
    if (_isAuthSessionError(err))
      return 'Sessione scaduta. Effettua nuovamente il login.';
    return 'Wendy si è interrotta. Riprova.';
  }

  function _isAuthSessionError(err: Error): boolean {
    const message = err.message.toUpperCase();
    return AUTH_SESSION_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
  }

  function _isNonRetryableStreamError(err: Error): boolean {
    return _isAuthSessionError(err) || FATAL_ERRORS.some((code) => err.message.includes(code));
  }

  async function _doStream(text: string, contextPrompt?: string, isPredefined = false) {
    const msgId = `assistant-${Date.now()}`;
    assistantMsgIdRef.current      = msgId;
    thinkingStartRef.current       = Date.now();
    firstChunkReceivedRef.current  = false;
    pendingCitationsRef.current    = [];
    lastRequestIdRef.current       = undefined;
    toolsUsedRef.current           = [];
    contextSourcesRef.current      = [];
    answerModeRef.current          = undefined;
    recoveryRef.current            = undefined;
    adaptiveReasoningRef.current   = undefined;
    suggestedPromptsRef.current    = undefined;
    streamedContentRef.current     = '';
    hasNonTextOutputRef.current    = false;
    hasTerminalErrorRef.current    = false;
    receivedDoneRef.current        = false;
    lastContextPromptRef.current   = contextPrompt;
    lastIsPredefinedRef.current    = isPredefined;

    setMessages((prev) => [
      ...prev,
      { id: msgId, role: 'assistant', content: '', timestamp: Date.now(),
        isStreaming: true, context: contextPrompt },
    ]);

    const labelIdx = Math.floor(Math.random() * THINKING_LABELS.length);
    setThinking({ active: true, label: THINKING_LABELS[labelIdx] ?? defaultThinkingLabel, startedAt: Date.now() });
    setStreamError(null);
    setRetryState({ active: retriesRef.current > 0, attempt: retriesRef.current, max: maxRetries });

    setWendyPhase?.('thinking');

    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Comprimi la history prima di inviarla
    const compressed = buildCompressedHistory(historyRef.current, threadSummaryRef.current);

    // Page context dal WendyProvider (se disponibile)
    const currentPage = wendyCtx?.pageContext;
    const pageContext = currentPage ? {
      page:       currentPage.page,
      entityType: readSupportedWendyEntityType(currentPage.data),
      entityId:   readNumberField(currentPage.data, 'entityId'),
      entityName: readStringField(currentPage.data, 'entityName'),
      journeyType: readStringField(currentPage.data, 'journeyType'),
      data:       compactPageData(currentPage.data),
    } : undefined;

    const normalizedContextPrompt = contextPrompt?.trim();
    const requestBody = {
      message:           text,
      ...(normalizedContextPrompt ? { contextPrompt: normalizedContextPrompt } : {}),
      compressedHistory: compressed,
      pageContext,
      locale:            navigator.language?.slice(0, 2) ?? 'it',
      isPredefined,
      // threadId opzionale - da passare se si gestiscono sessioni multiple
    };

    await startStream(apiUrl, {
      method:      'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(buildRequestBody ? buildRequestBody(requestBody) : requestBody),
    });
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    lastUserMessageRef.current = trimmed;
    retriesRef.current = 0;
    setRetryState({ active: false, attempt: 0, max: maxRetries });
    tts.stop();
    openaiTts.stop();
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
    ]);
    await _doStream(trimmed, undefined, false);
  }, [isStreaming, tts, openaiTts]);

  const sendContextualMessage = useCallback(async (action: ContextualAction) => {
    if (isStreaming) return;
    tts.stop();
    openaiTts.stop();
    const visibleText = action.prefillText ?? action.label;
    const operationalContext = [action.prompt, action.contextPrompt]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join("\n\n");
    lastUserMessageRef.current = visibleText;
    retriesRef.current = 0;
    setRetryState({ active: false, attempt: 0, max: maxRetries });

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: visibleText, timestamp: Date.now() },
    ]);

    await _doStream(visibleText, operationalContext || undefined, action.isPredefined ?? true);
  }, [isStreaming, tts, openaiTts]);

  const sendFeedback = useCallback(async (
    messageId: string,
    vote: 'up' | 'down',
    reason?: 'inaccurate' | 'irrelevant' | 'too_long' | 'too_slow' | 'harmful' | 'other',
  ) => {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, feedback: vote } : m),
    );

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
    await _doStream(lastUserMessageRef.current, lastContextPromptRef.current, lastIsPredefinedRef.current);
  }, [isStreaming]);

  const updateMessageAction = useCallback((
    messageId: string,
    actionId: string,
    update: WendyAction | ((action: WendyAction) => WendyAction),
  ) => {
    setMessages((prev) => {
      const updatedMessages = prev.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          actions: (message.actions ?? []).map((action) => {
            if (action.id !== actionId) return action;
            return typeof update === 'function' ? update(action) : update;
          }),
        };
      });
      savePersistedThread(historyRef.current, threadSummaryRef.current, updatedMessages);
      return updatedMessages;
    });
  }, []);

  const confirmAction = useCallback(async (messageId: string, actionId: string, confirmationText?: string) => {
    const action = messages
      .find((message) => message.id === messageId)
      ?.actions?.find((item) => item.id === actionId);
    if (!action) return;
    updateMessageAction(messageId, actionId, { ...action, status: 'running', error: undefined });
    const confirmed = await actionExecutor.confirm(action, confirmationText);
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
    threadSummaryRef.current = undefined;
    clearPersistedThread();
    setRestoredFromPersistence(false);
    setStreamError(null);
    setRetryState({ active: false, attempt: 0, max: maxRetries });
    setThinking({ active: false, label: defaultThinkingLabel, startedAt: 0 });
    broadcastUnlessRemote({ kind: 'cleared' });
  }, [stopStream, tts, openaiTts, maxRetries, defaultThinkingLabel, broadcastUnlessRemote]);

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
    retryState, restoredFromPersistence,
    sendMessage, sendContextualMessage, sendFeedback,
    stopStream, clearHistory, retryLast, confirmAction, cancelAction,
    tts, ttsEnabled, toggleTts,
    openaiTts,
    stt, commitSTT,
  };
}
