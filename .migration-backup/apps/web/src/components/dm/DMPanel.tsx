/**
 * DMPanel.tsx
 *
 * Layout split: lista conversazioni (sinistra) | finestra chat (destra).
 * Su mobile: lista a schermo intero, chat scorre a destra (sliding).
 *
 * Gestisce:
 *  - Selezione conversazione attiva
 *  - Transizione lista→chat su mobile
 *  - Empty state quando nessuna chat è aperta su desktop
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConversations } from '@/hooks/useNetwork';
import { DMConversationList } from './DMConversationList';
import { DMChatWindow } from './DMChatWindow';
import { cn } from '@/lib/utils';

export function DMPanel() {
  const { data, isLoading } = useConversations();
  const conversations = data?.conversations ?? [];

  const [activeUserId, setActiveUserId] = useState<number | null>(null);

  const activeConv = conversations.find((c) => c.participant.id === activeUserId) ?? null;

  // Su mobile, se è selezionata una conv mostriamo solo la chat
  const showChatMobile = activeUserId !== null;

  return (
    <div
      className={cn(
        'flex h-[calc(100vh-11rem)] rounded-xl overflow-hidden',
        'border border-[rgba(193,158,74,0.1)] bg-[#0e1018]',
      )}
    >
      {/* ── Lista conversazioni (è nascosta su mobile quando chat è aperta) ── */}
      <div
        className={cn(
          'flex flex-col border-r border-[rgba(193,158,74,0.1)]',
          'w-full md:w-72 lg:w-80 shrink-0',
          showChatMobile ? 'hidden md:flex' : 'flex',
        )}
      >
        {/* Header lista */}
        <div className="px-4 py-3 border-b border-[rgba(193,158,74,0.1)] shrink-0">
          <h2 className="text-sm font-semibold text-[#e6e8ed]">Messaggi</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DMConversationList
            conversations={conversations}
            activeUserId={activeUserId}
            onSelect={setActiveUserId}
            loading={isLoading}
          />
        </div>
      </div>

      {/* ── Chat window ── */}
      <div
        className={cn(
          'flex-1 min-w-0',
          !showChatMobile ? 'hidden md:flex' : 'flex',
          'flex-col',
        )}
      >
        <AnimatePresence mode="wait">
          {activeUserId && activeConv ? (
            <motion.div
              key={activeUserId}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex-1 flex flex-col h-full"
            >
              <DMChatWindow
                toUserId={activeUserId}
                participantName={activeConv.participant.name}
                participantAvatar={activeConv.participant.avatarUrl}
                onBack={() => setActiveUserId(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden md:flex flex-col items-center justify-center h-full text-center px-8"
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                className="text-[#7db89a]/20 mb-4" aria-hidden="true"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p className="text-sm text-[#7db89a]/50 font-medium">Seleziona una conversazione</p>
              <p className="text-xs text-[#7db89a]/30 mt-1 max-w-[28ch]">
                Scegli un contatto dalla lista per iniziare a chattare
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
