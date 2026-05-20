import { Mic, RotateCcw, Send, Sparkles, Square, Volume2, VolumeX } from 'lucide-react';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useWendy } from '../contexts/WendyProvider';
import type { VoiceChatMessage } from '../hooks/useVoiceChat.js';
import { useWendyChat } from '../hooks/useWendyChat.js';
import { StreamErrorBoundary } from './ErrorBoundary.js';
import { WendyThinkingIndicator } from './WendyThinkingIndicator.js';
import { UiToolRenderer } from './wendy/UiToolRenderer.js';
import { WendyActionCard } from './wendy/WendyActionCard.js';
import { WendyVoiceOverlay } from './wendy/WendyVoiceOverlay.js';

/**
 * WendyChat v2 — aggiunte:
 *   ✓ Pulsante 🎙️ nell'header apre WendyVoiceOverlay (fullscreen)
 *   ✓ History condivisa tra chat testuale e vocale via historyRef
 *   ✓ Zero breaking changes sulla chat testuale
 */

export interface WendyChatProps {
  apiUrl?: string;
  className?: string;
  placeholder?: string;
  welcomeMessage?: string;
  quickActions?: Array<{ label: string; icon?: string }>;
}

export function WendyChat({
  apiUrl = '/api/ai/wendy',
  className = '',
  placeholder = 'Scrivi a Wendy…',
  welcomeMessage = 'Ciao! Sono Wendy, la tua assistente di orientamento. Come posso aiutarti oggi?',
  quickActions = [],
}: WendyChatProps) {
  const [inputValue, setInputValue]       = useState('');
  const [voiceOpen, setVoiceOpen]         = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);
  const isComposingRef                    = useRef(false);
  const wendy                             = useWendy();

  // Shared history ref — kept in sync with useWendyChat messages
  // so voice and text turns appear in the same conversation.
  const historyRef = useRef<VoiceChatMessage[]>([]);

  const {
    messages, thinking, isStreaming, streamError,
    sendMessage, stopStream, clearHistory, retryLast,
    confirmAction, cancelAction,
    ttsEnabled, toggleTts,
    stt, commitSTT,
  } = useWendyChat({ apiUrl });

  // Keep historyRef in sync with messages state
  useEffect(() => {
    historyRef.current = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking.active]);

  // STT → input
  useEffect(() => {
    if (stt.isListening) {
      setInputValue(stt.transcript + stt.interimTranscript);
    }
  }, [stt.transcript, stt.interimTranscript, stt.isListening]);

  useEffect(() => {
    if (!wendy.isOpen || isStreaming) return;
    const pending = wendy.consumePendingAsk();
    if (!pending) return;
    void sendMessage(pending);
  }, [wendy.isOpen, isStreaming, sendMessage, wendy]);

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const text = inputValue.trim();
      if (!text || isStreaming) return;
      setInputValue('');
      await sendMessage(text);
      inputRef.current?.focus();
    },
    [inputValue, isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isComposingRef.current) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleMicClick = useCallback(() => {
    if (stt.isListening) commitSTT();
    else stt.start();
  }, [stt, commitSTT]);

  const handleQuickAction = useCallback((label: string) => {
    setInputValue(label);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <>
      {/* Voice Overlay — portal-like, rendered outside the chat box */}
      <WendyVoiceOverlay
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        apiUrl={apiUrl}
        historyRef={historyRef}
      />

      <div className={['flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-background/90 shadow-2xl backdrop-blur-xl', className].join(' ')}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-semibold text-sm">Wendy</span>
            {isStreaming && (
              <span className="text-xs text-muted-foreground animate-pulse">sta scrivendo...</span>
            )}
          </div>
          <div className="flex gap-1">

            {/* 🎙️ Voice mode toggle */}
            <button
              onClick={() => setVoiceOpen(true)}
              title="Modalità vocale"
              aria-label="Apri conversazione vocale"
              data-testid="wendy-voice-mode-toggle"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Mute TTS */}
            <button
              onClick={toggleTts}
              title={ttsEnabled ? 'Disattiva voce' : 'Attiva voce'}
              aria-label={ttsEnabled ? 'Disattiva voce' : 'Attiva voce'}
              aria-pressed={ttsEnabled}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {ttsEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            {/* Nuova conversazione */}
            <button
              onClick={clearHistory}
              title="Nuova conversazione"
              aria-label="Nuova conversazione"
              disabled={messages.length === 0}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messaggi */}
        <StreamErrorBoundary>
        <div
          role="log"
          aria-label="Conversazione con Wendy"
          aria-live="polite"
          className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        >
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[86%] px-4 py-3 rounded-3xl rounded-tl-md bg-muted/70 text-sm leading-relaxed">
                {welcomeMessage}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={['flex', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
            >
              {msg.role === 'error' ? (
                <div className="max-w-[85%] flex flex-col gap-1.5">
                  <div className="px-3 py-2 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {msg.content}
                  </div>
                  <button
                    onClick={retryLast}
                    className="self-start text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    Riprova
                  </button>
                </div>
              ) : (
                <div
                  data-testid={msg.role === 'assistant' ? 'wendy-message-assistant' : undefined}
                  className={[
                    'max-w-[86%] px-4 py-3 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-md'
                      : 'bg-muted/70 rounded-tl-md',
                    msg.isStreaming ? 'after:content-["|_"] after:animate-pulse' : '',
                  ].join(' ')}
                >
                  {msg.uiTool ? (
                    <UiToolRenderer name={msg.uiTool.name} args={msg.uiTool.args} />
                  ) : (
                    msg.content || (msg.isStreaming ? '' : '…')
                  )}
                  {msg.role === 'assistant' && msg.actions?.map((action) => (
                    <WendyActionCard
                      key={action.id}
                      action={action}
                      onConfirm={() => void confirmAction(msg.id, action.id)}
                      onCancel={() => cancelAction(msg.id, action.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          <WendyThinkingIndicator thinking={thinking} />
          <div ref={messagesEndRef} />
        </div>
        </StreamErrorBoundary>

        {/* Error banner */}
        {streamError && !messages.some((m) => m.role === 'error') && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2">
            <span>{streamError.message}</span>
            <button onClick={retryLast} className="shrink-0 underline underline-offset-2">Riprova</button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-white/10 bg-background/55 px-3 pb-3 pt-2 backdrop-blur">
          {quickActions.length > 0 && messages.length === 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.label)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {action.icon ? `${action.icon} ` : ''}
                  {action.label}
                </button>
              ))}
            </div>
          )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-3xl border border-input bg-background/90 p-2 shadow-sm">
          <textarea
            ref={inputRef}
            data-testid="wendy-chat-input"
            data-wendy-input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            rows={1}
            placeholder={stt.isListening ? '🎤 In ascolto…' : placeholder}
            disabled={isStreaming && !stt.isListening}
            aria-label="Messaggio per Wendy"
            className={[
              'flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-2 text-sm',
              'placeholder:text-muted-foreground focus-visible:outline-none',
              'max-h-32 overflow-y-auto transition-colors',
              stt.isListening ? 'border-primary ring-1 ring-primary' : '',
            ].join(' ')}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />

          {stt.supported && (
            <button
              type="button"
              onClick={handleMicClick}
              title={stt.isListening ? 'Invia trascrizione' : 'Registra messaggio vocale'}
              aria-label={stt.isListening ? 'Invia trascrizione' : 'Registra messaggio vocale'}
              aria-pressed={stt.isListening}
              className={[
                'shrink-0 p-2 rounded-full transition-colors',
                stt.isListening
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Mic className="h-5 w-5" />
            </button>
          )}

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStream}
              title="Interrompi risposta"
              aria-label="Interrompi risposta"
              className="shrink-0 p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square className="h-5 w-5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              data-testid="wendy-send-btn"
              disabled={!inputValue.trim()}
              title="Invia messaggio"
              aria-label="Invia messaggio"
              className="shrink-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          )}
        </form>
        </div>
      </div>
    </>
  );
}
