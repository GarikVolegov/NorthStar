import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  normalizeWendyAction,
  type WendyAction,
} from './useWendyActionExecutor';
import {
  parseWendySseEvent,
  type WendyContextSource,
} from './useWendyChatSse';
import type { ChatMessage, RagCitation, ThinkingPhase } from './useWendyChat.types';

interface CreateWendyRawChunkHandlerInput {
  defaultThinkingLabel: string;
  actionExecutor: { executeImmediate(action: WendyAction): WendyAction };
  assistantMsgIdRef: MutableRefObject<string>;
  firstChunkReceivedRef: MutableRefObject<boolean>;
  pendingCitationsRef: MutableRefObject<RagCitation[]>;
  lastRequestIdRef: MutableRefObject<string | undefined>;
  toolsUsedRef: MutableRefObject<string[]>;
  contextSourcesRef: MutableRefObject<WendyContextSource[]>;
  answerModeRef: MutableRefObject<ChatMessage['answerMode']>;
  recoveryRef: MutableRefObject<Record<string, unknown> | undefined>;
  adaptiveReasoningRef: MutableRefObject<ChatMessage['adaptiveReasoning']>;
  suggestedPromptsRef: MutableRefObject<ChatMessage['suggestedPrompts']>;
  streamedContentRef: MutableRefObject<string>;
  hasNonTextOutputRef: MutableRefObject<boolean>;
  hasTerminalErrorRef: MutableRefObject<boolean>;
  receivedDoneRef: MutableRefObject<boolean>;
  setThinking: Dispatch<SetStateAction<ThinkingPhase>>;
  setStreamError: Dispatch<SetStateAction<Error | null>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

export function createWendyRawChunkHandler(input: CreateWendyRawChunkHandlerInput) {
  return (raw: string) => {
    const event = parseWendySseEvent(raw);
    if (event.type === 'status') {
      if (!input.firstChunkReceivedRef.current) {
        input.setThinking((current) => ({
          active: true,
          label: event.value,
          startedAt: current.startedAt || Date.now(),
        }));
      }
      return true;
    }
    if (event.type === 'gate') {
      input.hasNonTextOutputRef.current = true;
      input.hasTerminalErrorRef.current = true;
      input.streamedContentRef.current = event.message;
      input.setThinking({ active: false, label: input.defaultThinkingLabel, startedAt: 0 });
      input.setStreamError(new Error('WENDY_GATE'));
      input.setMessages((prev) =>
        prev.map((message) =>
          message.id === input.assistantMsgIdRef.current
            ? { ...message, role: 'error', content: event.message, isStreaming: false }
            : message,
        ),
      );
      return true;
    }
    if (event.type === 'error') {
      const message = event.message || 'Wendy si è interrotta. Riprova.';
      input.hasNonTextOutputRef.current = true;
      input.hasTerminalErrorRef.current = true;
      input.streamedContentRef.current = message;
      input.setThinking({ active: false, label: input.defaultThinkingLabel, startedAt: 0 });
      input.setStreamError(new Error(event.message));
      input.setMessages((prev) =>
        prev.map((item) =>
          item.id === input.assistantMsgIdRef.current
            ? { ...item, role: 'error', content: message, isStreaming: false }
            : item,
        ),
      );
      return true;
    }
    if (event.type === 'rag_citations') {
      input.pendingCitationsRef.current = event.citations;
      input.setMessages((prev) =>
        prev.map((message) =>
          message.id === input.assistantMsgIdRef.current
            ? { ...message, citations: event.citations }
            : message,
        ),
      );
      return true;
    }
    if (event.type === 'done') {
      input.receivedDoneRef.current = true;
      if (event.requestId) input.lastRequestIdRef.current = event.requestId;
      input.contextSourcesRef.current = event.contextSources;
      input.answerModeRef.current = event.answerMode;
      input.recoveryRef.current = event.recovery;
      input.adaptiveReasoningRef.current = event.adaptiveReasoning;
      input.suggestedPromptsRef.current = event.suggestedPrompts;
      input.setMessages((prev) =>
        prev.map((message) =>
          message.id === input.assistantMsgIdRef.current
            ? {
                ...message,
                requestId: event.requestId,
                toolsUsed: [...input.toolsUsedRef.current],
                contextSources: event.contextSources,
                answerMode: event.answerMode,
                recovery: event.recovery,
                adaptiveReasoning: event.adaptiveReasoning,
                suggestedPrompts: event.suggestedPrompts,
              }
            : message,
        ),
      );
      return true;
    }
    if (event.type === 'tool_call') {
      input.hasNonTextOutputRef.current = true;
      input.toolsUsedRef.current = [...input.toolsUsedRef.current, event.name];
      const action = normalizeWendyAction({
        name: event.name,
        args: event.args,
        result: event.result,
      });
      if (action) {
        const nextAction = action.requiresConfirmation ? action : input.actionExecutor.executeImmediate(action);
        input.setMessages((prev) =>
          prev.map((message) =>
            message.id === input.assistantMsgIdRef.current
              ? { ...message, actions: [...(message.actions ?? []), nextAction] }
              : message,
          ),
        );
      }
      return true;
    }
    if (event.type === 'ui_tool') {
      input.hasNonTextOutputRef.current = true;
      input.setMessages((prev) =>
        prev.map((message) =>
          message.id === input.assistantMsgIdRef.current
            ? { ...message, uiTool: { name: event.name, args: event.args } }
            : message,
        ),
      );
      return true;
    }
    if (event.type === 'token') {
      input.streamedContentRef.current += event.value;
      if (!input.firstChunkReceivedRef.current) {
        input.firstChunkReceivedRef.current = true;
        input.setThinking({ active: false, label: input.defaultThinkingLabel, startedAt: 0 });
      }
      input.setMessages((prev) =>
        prev.map((message) =>
          message.id === input.assistantMsgIdRef.current
            ? { ...message, content: input.streamedContentRef.current }
            : message,
        ),
      );
    }
    return false;
  };
}
