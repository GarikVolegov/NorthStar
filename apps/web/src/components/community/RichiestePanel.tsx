/**
 * RichiestePanel.tsx
 *
 * Tab "Richieste" nella pagina /amici.
 * Due sezioni:
 *   - Ricevute: richieste in arrivo → accetta / rifiuta
 *   - Inviate:  richieste in uscita  → annulla
 *
 * Dati: useRequests() — GET /api/friends/requests
 *        useSentRequests() — GET /api/friends/requests/sent
 * Azioni: useAcceptRequest() — PUT /api/friends/:id/accept
 *         useRemoveFriend() — DELETE /api/friends/:id
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRequests, useSentRequests, useAcceptRequest, useRemoveFriend } from '@/hooks/useNetwork';

// ─── Tipi locali (derivati dai dati API) ────────────────────────────────────────
export interface RichiestaConnessione {
  friendshipId: number;
  id: string;          // userId come stringa
  nome: string;
  cognome: string;
  ruolo: string;
  settore: string;
  avatar?: string | null;
  messaggio?: string;
  dataRichiesta: string; // ISO date
}

function networkUserToRichiesta(
  req: {
    friendshipId: number;
    sentAt: string | null;
    user: {
      id: number;
      name: string;
      avatarUrl: string | null;
      sectorName: string | null;
      journeyType: string | null;
      totalXp: number | null;
    };
  },
): RichiestaConnessione {
  const parts = req.user.name.trim().split(/\s+/);
  const nome = parts[0] || '';
  const cognome = parts.slice(1).join(' ') || '';
  return {
    friendshipId: req.friendshipId,
    id: String(req.user.id),
    nome,
    cognome,
    ruolo: req.user.journeyType || '---',
    settore: req.user.sectorName || '---',
    avatar: req.user.avatarUrl ?? undefined,
    messaggio: undefined,
    dataRichiesta: req.sentAt ?? new Date().toISOString(),
  };
}

// ─── Utilità ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#4f7c5a', '#7c4f6a', '#4f6a7c', '#7c6a4f',
  '#5a4f7c', '#7c4f4f', '#4f7c6a', '#6a7c4f',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash += userId.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(nome: string, cognome: string) {
  return `${nome[0] ?? ''}${cognome[0] ?? ''}`.toUpperCase();
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  return `${days} giorni fa`;
}

// ─── Card richiesta ricevuta ──────────────────────────────────────────────────
function CardRicevuta({
  richiesta,
  onAccetta,
  onRifiuta,
}: {
  richiesta: RichiestaConnessione;
  onAccetta: (friendshipId: number) => void;
  onRifiuta: (friendshipId: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.18 }}
      className="flex gap-3 px-4 py-3.5
                 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/10"
    >
      {/* Avatar */}
      {richiesta.avatar ? (
        <img
          src={richiesta.avatar}
          alt={`${richiesta.nome} ${richiesta.cognome}`}
          className="w-10 h-10 rounded-full shrink-0 object-cover"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
                     text-xs font-bold text-[#e6e8ed]"
          style={{ background: avatarColor(richiesta.id) }}
          aria-hidden="true"
        >
          {getInitials(richiesta.nome, richiesta.cognome)}
        </div>
      )}

      {/* Info + azioni */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#e6e8ed] truncate">
              {richiesta.nome} {richiesta.cognome}
            </p>
            <p className="text-xs text-[#7db89a]/60 truncate">{richiesta.ruolo}</p>
          </div>
          <span className="text-[10px] text-[#7db89a]/30 shrink-0 mt-0.5">
            {formatRelative(richiesta.dataRichiesta)}
          </span>
        </div>

        {/* Messaggio opzionale */}
        {richiesta.messaggio && (
          <p className="mt-1.5 text-xs text-[#c8cad0]/70 leading-relaxed
                        bg-[#0e1018]/50 rounded-lg px-3 py-2 border-l-2 border-[#c19e4a]/20">
            &ldquo;{richiesta.messaggio}&rdquo;
          </p>
        )}

        {/* Badge settore */}
        <span
          className="inline-block mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded
                     bg-[#c19e4a]/10 text-[#c19e4a]/80"
        >
          {richiesta.settore}
        </span>

        {/* Bottoni */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onAccetta(richiesta.friendshipId)}
            className="tap-highlight-none flex-1 py-2 text-xs font-semibold rounded-lg
                       bg-[#c19e4a] text-[#0b0d14]
                       hover:bg-[#d4aa52] active:scale-[0.97]
                       transition-all duration-150"
          >
            Accetta
          </button>
          <button
            onClick={() => onRifiuta(richiesta.friendshipId)}
            className="tap-highlight-none flex-1 py-2 text-xs font-semibold rounded-lg
                       border border-[#7db89a]/20 text-[#7db89a]/60
                       hover:border-[#e57373]/30 hover:text-[#e57373]/70
                       active:scale-[0.97] transition-all duration-150"
          >
            Rifiuta
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Card richiesta inviata ───────────────────────────────────────────────────
function CardInviata({
  richiesta,
  onAnnulla,
}: {
  richiesta: RichiestaConnessione;
  onAnnulla: (friendshipId: number) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-3 px-4 py-3
                 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/10"
    >
      {richiesta.avatar ? (
        <img
          src={richiesta.avatar}
          alt={`${richiesta.nome} ${richiesta.cognome}`}
          className="w-9 h-9 rounded-full shrink-0 object-cover"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center
                     text-xs font-bold text-[#e6e8ed]"
          style={{ background: avatarColor(richiesta.id) }}
          aria-hidden="true"
        >
          {getInitials(richiesta.nome, richiesta.cognome)}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#e6e8ed] truncate">
          {richiesta.nome} {richiesta.cognome}
        </p>
        <p className="text-xs text-[#7db89a]/55 truncate">{richiesta.ruolo}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px] text-[#7db89a]/30">
          {formatRelative(richiesta.dataRichiesta)}
        </span>
        <button
          onClick={() => onAnnulla(richiesta.friendshipId)}
          className="tap-highlight-none text-[10px] font-medium px-2.5 py-1 rounded-lg
                     border border-[#7db89a]/15 text-[#7db89a]/40
                     hover:border-[#e57373]/25 hover:text-[#e57373]/60
                     transition-colors"
        >
          Annulla
        </button>
      </div>
    </motion.div>
  );
}

// ─── Sezione con titolo ────────────────────────────────────────────────────────
function Sezione({
  titolo, count, children,
}: {
  titolo: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold text-[#7db89a]/60 uppercase tracking-wider">
          {titolo}
        </h2>
        {count > 0 && (
          <span
            className="inline-flex items-center justify-center w-5 h-5
                       rounded-full bg-[#c19e4a] text-[10px] font-bold text-[#0b0d14]"
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Empty sezione ────────────────────────────────────────────────────────────
function EmptySezione({ messaggio }: { messaggio: string }) {
  return (
    <p className="text-xs text-[#7db89a]/30 text-center py-6">{messaggio}</p>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function RichiestePanel({
  onConnessioneAccettata,
}: {
  onConnessioneAccettata?: (richiesta: RichiestaConnessione) => void;
}) {
  const { data: ricevuteData, isLoading: ricevuteLoading } = useRequests();
  const { data: inviateData, isLoading: inviateLoading } = useSentRequests();
  const acceptMutation = useAcceptRequest();
  const removeMutation = useRemoveFriend();

  const ricevute: RichiestaConnessione[] = (ricevuteData?.requests ?? []).map(networkUserToRichiesta);
  const inviate: RichiestaConnessione[] = (inviateData?.requests ?? []).map(networkUserToRichiesta);

  const isLoading = ricevuteLoading || inviateLoading;

  function handleAccetta(friendshipId: number) {
    const richiesta = ricevute.find((r) => r.friendshipId === friendshipId);
    acceptMutation.mutate(friendshipId);
    if (richiesta) onConnessioneAccettata?.(richiesta);
  }

  function handleRifiuta(friendshipId: number) {
    removeMutation.mutate(friendshipId);
  }

  function handleAnnulla(friendshipId: number) {
    removeMutation.mutate(friendshipId);
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Richieste di connessione">
      <Sezione titolo="Ricevute" count={ricevute.length}>
        {ricevute.length === 0 ? (
          <EmptySezione messaggio="Nessuna richiesta in arrivo" />
        ) : (
          <motion.div layout className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {ricevute.map((r) => (
                <CardRicevuta
                  key={r.friendshipId}
                  richiesta={r}
                  onAccetta={handleAccetta}
                  onRifiuta={handleRifiuta}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </Sezione>

      <Sezione titolo="Inviate" count={inviate.length}>
        {inviate.length === 0 ? (
          <EmptySezione messaggio="Nessuna richiesta in attesa" />
        ) : (
          <motion.div layout className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {inviate.map((r) => (
                <CardInviata
                  key={r.friendshipId}
                  richiesta={r}
                  onAnnulla={handleAnnulla}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </Sezione>
    </section>
  );
}