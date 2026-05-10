/**
 * DMConversationList.tsx
 *
 * Lista delle conversazioni DM a sinistra nel pannello chat.
 * Mostra avatar iniziale, nome, ultimo messaggio troncato, badge unread, tempo relativo.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DmConversation } from '@/hooks/useNetwork';

// ─── Tempo relativo (es. "2 min fa", "ieri") ──────────────────────────────
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'adesso';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ieri';
  return `${d}g`;
}

// ─── Avatar iniziale ────────────────────────────────────────────────────────
function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Avatar'}
        width={40} height={40}
        loading="lazy"
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span
      className="w-10 h-10 rounded-full bg-[#1a2a24] border border-[rgba(193,158,74,0.2)]
                 flex items-center justify-center shrink-0
                 text-[#c19e4a] text-sm font-semibold"
      aria-hidden="true"
    >
      {(name?.[0] ?? '?').toUpperCase()}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────
function EmptyConvs() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-[#7db89a]/30 mb-4" aria-hidden="true"
      >
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
      <p className="text-sm text-[#7db89a]/60 font-medium">Nessun messaggio</p>
      <p className="text-xs text-[#7db89a]/40 mt-1 max-w-[22ch]">
        Connettiti con qualcuno per iniziare a chattare
      </p>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────
export function DMConversationList({
  conversations,
  activeUserId,
  onSelect,
  loading,
}: {
  conversations: DmConversation[];
  activeUserId: number | null;
  onSelect: (userId: number) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a2a24] animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 bg-[#1a2a24] rounded animate-pulse" />
              <div className="h-2.5 w-36 bg-[#1a2a24]/70 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) return <EmptyConvs />;

  return (
    <ul role="list" className="divide-y divide-[rgba(193,158,74,0.06)]">
      <AnimatePresence initial={false}>
        {conversations.map((conv) => {
          const isActive = conv.participant.id === activeUserId;
          return (
            <motion.li
              key={conv.conversationId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              <button
                onClick={() => onSelect(conv.participant.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3',
                  'tap-highlight-none text-left transition-colors duration-150',
                  isActive
                    ? 'bg-[#1a2a24]'
                    : 'hover:bg-[#ffffff06]',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="relative">
                  <Avatar name={conv.participant.name} url={conv.participant.avatarUrl} />
                  {conv.unreadCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5
                                 bg-blue-500 rounded-full border border-[#0e1018]"
                      aria-hidden="true"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      'text-sm truncate',
                      conv.unreadCount > 0 ? 'font-semibold text-[#e6e8ed]' : 'font-medium text-[#c8cad0]',
                    )}>
                      {conv.participant.name ?? 'Utente'}
                    </span>
                    <span className="text-[10px] text-[#7db89a]/50 shrink-0">
                      {relativeTime(conv.lastMessage?.createdAt ?? null)}
                    </span>
                  </div>
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    conv.unreadCount > 0 ? 'text-[#7db89a]' : 'text-[#7db89a]/50',
                  )}>
                    {conv.lastMessage?.content ?? 'Nessun messaggio'}
                  </p>
                </div>

                {conv.unreadCount > 0 && (
                  <span className="shrink-0 min-w-[18px] h-[18px] px-1
                                   bg-blue-500 text-white text-[9px] font-bold
                                   rounded-full flex items-center justify-center">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </span>
                )}
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
