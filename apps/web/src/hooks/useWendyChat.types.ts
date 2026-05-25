import type { WendyAction } from './useWendyActionExecutor';
import type { WendyContextSource } from './useWendyChatSse';
import type { useSTT } from './useSTT.js';
import type { useTTS } from './useTTS.js';
import type { useWendyOpenAITTS } from './useWendyOpenAITTS.js';

export type MessageRole = 'user' | 'assistant' | 'error';

export interface RagCitation {
  nodeId: number;
  title: string;
  type: string;
  score: number;
  url: string | null;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean | undefined;
  thinkingMs?: number | undefined;
  citations?: RagCitation[] | undefined;
  feedback?: 'up' | 'down' | undefined;
  context?: string | undefined;
  uiTool?: { name: string; args: Record<string, unknown> } | undefined;
  actions?: WendyAction[] | undefined;
  requestId?: string | undefined;
  toolsUsed?: string[] | undefined;
  contextSources?: WendyContextSource[] | undefined;
}

export interface ThinkingPhase {
  active: boolean;
  label: string;
  startedAt: number;
}

export interface ContextualAction {
  id: string;
  label: string;
  prompt: string;
  prefillText?: string | undefined;
}

export interface UseWendyChatOptions {
  apiUrl?: string | undefined;
  ttsEnabled?: boolean | undefined;
  sttLang?: string | undefined;
  maxRetries?: number | undefined;
  /** Hard cap on a single SSE stream in ms. Default 60_000. Pass 0 to disable. */
  streamTimeoutMs?: number | undefined;
  /** If false, skips loading any persisted thread from localStorage at mount. Default true. */
  restorePersisted?: boolean | undefined;
  onMessageComplete?: ((message: ChatMessage) => void) | undefined;
}

export interface RetryState {
  active: boolean;
  attempt: number;
  max: number;
}

export interface UseWendyChatReturn {
  messages: ChatMessage[];
  thinking: ThinkingPhase;
  isStreaming: boolean;
  streamError: Error | null;
  /** Surface retry attempts so the UI can show a "Riprovo..." pill. */
  retryState: RetryState;
  /** True if a previous conversation was restored from localStorage at mount. */
  restoredFromPersistence: boolean;
  sendMessage: (text: string) => Promise<void>;
  sendContextualMessage: (action: ContextualAction) => Promise<void>;
  sendFeedback: (
    messageId: string,
    vote: 'up' | 'down',
    note?: 'inaccurate' | 'irrelevant' | 'too_long' | 'too_slow' | 'harmful' | 'other',
  ) => Promise<void>;
  stopStream: () => void;
  clearHistory: () => void;
  retryLast: () => Promise<void>;
  confirmAction: (messageId: string, actionId: string) => Promise<void>;
  cancelAction: (messageId: string, actionId: string) => void;
  tts: ReturnType<typeof useTTS>;
  ttsEnabled: boolean;
  toggleTts: () => void;
  openaiTts: ReturnType<typeof useWendyOpenAITTS>;
  stt: ReturnType<typeof useSTT>;
  commitSTT: () => void;
}
