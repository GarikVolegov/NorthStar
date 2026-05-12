import { useRef, useEffect, useState, useCallback, FormEvent, KeyboardEvent } from 'react';
import { useWendyChat } from '../hooks/useWendyChat.js';
import { WendyThinkingIndicator } from './WendyThinkingIndicator.js';
import { WendyVoiceOverlay } from './wendy/WendyVoiceOverlay.js';
import { UiToolRenderer } from './wendy/UiToolRenderer.js';
import type { VoiceChatMessage } from '../hooks/useVoiceChat.js';
import { StreamErrorBoundary } from './ErrorBoundary.js';

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
}

export function WendyChat({
  apiUrl = '/api/v1/ai/chat/stream',
  className = '',
  placeholder = 'Scrivi a Wendy…',
  welcomeMessage = 'Ciao! Sono Wendy, la tua assistente di orientamento. Come posso aiutarti oggi?',
}: WendyChatProps) {
  const [inputValue, setInputValue]       = useState('');
  const [voiceOpen, setVoiceOpen]         = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);
  const inputRef                          = useRef<HTMLTextAreaElement>(null);
  const isComposingRef                    = useRef(false);

  // Shared history ref — kept in sync with useWendyChat messages
  // so voice and text turns appear in the same conversation.
  const historyRef = useRef<VoiceChatMessage[]>([]);

  const {
    messages, thinking, isStreaming, streamError,
    sendMessage, stopStream, clearHistory, retryLast,
    tts, ttsEnabled, toggleTts,
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

  return (
    <>
      {/* Voice Overlay — portal-like, rendered outside the chat box */}
      <WendyVoiceOverlay
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        apiUrl={apiUrl}
        historyRef={historyRef}
      />

      <div className={['flex flex-col bg-background border border-border rounded-2xl overflow-hidden shadow-md', className].join(' ')}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Wendy</span>
            {isStreaming && (
              <span className="text-xs text-muted-foreground animate-pulse">sta scrivendo…</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 016 0v4a3 3 0 01-6 0z" />
              </svg>
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
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-4-9l-2.5-2.5M12 3L6 9H3v6h3l6 6V3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messaggi */}
        <StreamErrorBoundary>
        <div
          role="log"
          aria-label="Conversazione con Wendy"
          aria-live="polite"
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
        >
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tl-sm bg-muted text-sm leading-relaxed">
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
                    'max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm',
                    msg.isStreaming ? 'after:content-["|_"] after:animate-pulse' : '',
                  ].join(' ')}
                >
                  {msg.uiTool ? (
                    <UiToolRenderer name={msg.uiTool.name} args={msg.uiTool.args} />
                  ) : (
                    msg.content || (msg.isStreaming ? '' : '…')
                  )}
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
        <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 pb-3 pt-2 border-t border-border">
          <textarea
            ref={inputRef}
            data-testid="wendy-chat-input"
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
              'flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
                'shrink-0 p-2 rounded-xl transition-colors',
                stt.isListening
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 016 0v4a3 3 0 01-6 0z" />
              </svg>
            </button>
          )}

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStream}
              title="Interrompi risposta"
              aria-label="Interrompi risposta"
              className="shrink-0 p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              data-testid="wendy-send-btn"
              disabled={!inputValue.trim()}
              title="Invia messaggio"
              aria-label="Invia messaggio"
              className="shrink-0 p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </>
  );
}
