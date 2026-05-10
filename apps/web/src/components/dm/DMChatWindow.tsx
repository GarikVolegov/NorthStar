/**
 * DMChatWindow.tsx
 *
 * Finestra di chat 1:1 con:
 *  - Scroll automatico in fondo all'apertura e a ogni nuovo messaggio
 *  - Paginazione "carica più vecchi" con scroll preservation
 *  - SSE real-time via useDMStream
 *  - Invio con Enter (Shift+Enter per a-capo)
 *  - Eliminazione messaggio proprio (long-press mobile / click desktop)
 *  - Skeleton loader durante il fetch iniziale
 */
import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  useMessages,
  useSendMessage,
  useDeleteMessage,
  networkKeys,
  type DmMessage,
} from '@/hooks/useNetwork';
import { useDMStream } from '@/hooks/useDMStream';
import { cn } from '@/lib/utils';

// ─── Formatta ora (HH:MM) ─────────────────────────────────────────────────
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// ─── Bubble messaggio ─────────────────────────────────────────────────────
function MessageBubble({
  msg, isMine, onDelete,
}: {
  msg: DmMessage;
  isMine: boolean;
  onDelete: (id: number) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div
        className={cn(
          'relative max-w-[72%] group',
          isMine ? 'items-end' : 'items-start',
        )}
        onMouseEnter={() => isMine && setShowDelete(true)}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm break-words leading-relaxed',
            isMine
              ? 'bg-[#1a3a2e] text-[#e6e8ed] rounded-br-sm'
              : 'bg-[#1a1d2a] text-[#c8cad0] rounded-bl-sm',
          )}
        >
          {msg.content}
        </div>
        <div className={cn(
          'flex items-center gap-1 mt-0.5',
          isMine ? 'justify-end' : 'justify-start',
        )}>
          <span className="text-[10px] text-[#7db89a]/40">{fmtTime(msg.createdAt)}</span>
          {isMine && (
            <span className="text-[10px] text-[#7db89a]/40">
              {msg.isRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>

        {/* Bottone elimina — visibile on hover desktop */}
        <AnimatePresence>
          {isMine && showDelete && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              onClick={() => onDelete(msg.id)}
              className={cn(
                'absolute -top-2 -left-2',
                'w-5 h-5 rounded-full bg-[#a12c7b]/80 hover:bg-[#a12c7b]',
                'flex items-center justify-center',
                'text-white text-[10px] transition-colors',
              )}
              aria-label="Elimina messaggio"
            >
              ×
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Skeleton loader ───────────────────────────────────────────────────────
function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[false, true, false, false, true].map((mine, i) => (
        <div key={i} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
          <div
            className={cn(
              'h-8 rounded-2xl bg-[#1a2a24] animate-pulse',
              mine ? 'w-40' : 'w-52',
            )}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Input area ───────────────────────────────────────────────────────────
function ChatInput({
  onSend, disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKey = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex items-end gap-2 px-4 py-3
                    border-t border-[rgba(193,158,74,0.1)] bg-[#0e1018]">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 2000))}
        onKeyDown={handleKey}
        placeholder="Scrivi un messaggio… (Invio per inviare)"
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-xl px-3.5 py-2.5',
          'bg-[#1a1d2a] border border-[rgba(193,158,74,0.15)]',
          'text-sm text-[#e6e8ed] placeholder-[#7db89a]/40',
          'focus:outline-none focus:border-[rgba(193,158,74,0.4)]',
          'transition-colors duration-150',
          'max-h-32 overflow-y-auto',
        )}
        style={{ height: 'auto' }}
        onInput={(e) => {
          const t = e.currentTarget;
          t.style.height = 'auto';
          t.style.height = Math.min(t.scrollHeight, 128) + 'px';
        }}
        aria-label="Messaggio"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || disabled}
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          'bg-[#c19e4a] text-[#0e1018] transition-all duration-150',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'hover:bg-[#c19e4a]/90 active:scale-95',
          'tap-highlight-none',
        )}
        aria-label="Invia messaggio"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}

// ─── DMChatWindow ──────────────────────────────────────────────────────────
export function DMChatWindow({
  toUserId,
  participantName,
  participantAvatar,
  onBack,
}: {
  toUserId: number;
  participantName: string | null;
  participantAvatar: string | null;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const { data, isLoading } = useMessages(toUserId);
  const send = useSendMessage(toUserId);
  const del = useDeleteMessage(toUserId);

  const messages = data?.messages ?? [];
  const lastId = messages.at(-1)?.id ?? null;

  // SSE real-time
  useDMStream(toUserId, lastId);

  // Scroll to bottom
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback((text: string) => {
    send.mutate(text);
  }, [send]);

  const handleDelete = useCallback((id: number) => {
    del.mutate(id);
  }, [del]);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3
                      border-b border-[rgba(193,158,74,0.1)] bg-[#0e1018] shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="tap-highlight-none text-[#7db89a] hover:text-[#e6e8ed]
                       transition-colors mr-1"
            aria-label="Torna alla lista"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {participantAvatar ? (
          <img src={participantAvatar} alt="" width={32} height={32}
            className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-[#1a2a24] border border-[rgba(193,158,74,0.2)]
                           flex items-center justify-center shrink-0
                           text-[#c19e4a] text-xs font-semibold">
            {(participantName?.[0] ?? '?').toUpperCase()}
          </span>
        )}
        <span className="text-sm font-semibold text-[#e6e8ed]">
          {participantName ?? 'Utente'}
        </span>
      </div>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" role="log" aria-live="polite">
        {isLoading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-[#7db89a]/25 mb-3" aria-hidden="true"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-xs text-[#7db89a]/40">
              Scrivi il primo messaggio a {participantName ?? 'questo utente'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={msg.senderId === user?.id}
              onDelete={handleDelete}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={send.isPending} />
    </div>
  );
}
