/**
 * EsploraPanel.tsx
 *
 * Tab "Esplora" nella pagina /amici.
 * Funzionalità:
 *   - Search bar con debounce
 *   - Suggestion chips (settori)
 *   - Griglia di profili suggeriti
 *   - Skeleton loading
 *   - Stato vuoto personalizzato
 *
 * Dati: useSuggestions() — GET /api/friends/suggestions
 *        useSearchUsers(q) — GET /api/friends/search?q=
 * Azioni: useSendRequest() — POST /api/friends/request/:id
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuggestions, useSearchUsers, useSendRequest } from '@/hooks/useNetwork';

// ─── Tipi locali (derivati dai dati API) ────────────────────────────────────────
export interface UtenteEsplora {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  settore: string;
  bio?: string;
  connessioniInComune: number;
  isConnesso: boolean;
}

function networkUserToUtente(
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    sectorName: string | null;
    journeyType: string | null;
    totalXp: number | null;
    matchScore?: number;
  },
  { isConnesso = false }: { isConnesso?: boolean } = {},
): UtenteEsplora {
  const parts = user.name.trim().split(/\s+/);
  const nome = parts[0] || '';
  const cognome = parts.slice(1).join(' ') || '';
  const connessioniInComune = user.matchScore ? Math.floor(user.matchScore / 20) : 0;
  return {
    id: String(user.id),
    nome,
    cognome,
    ruolo: user.journeyType || '---',
    settore: user.sectorName || '---',
    bio: user.journeyType ? `${user.journeyType} · ~${user.totalXp ?? 0} XP` : undefined,
    connessioniInComune,
    isConnesso,
  };
}

// ─── Dati statici per suggerimenti settori ──────────────────────────────────────
const SUGGERIMENTI_SETTORE = [
  'Tecnologia', 'Design', 'Marketing', 'Data & AI',
  'Finance', 'Web3', 'Management', 'HR', 'Coaching', 'Imprenditoria',
];

// ─── Utilità ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#4f7c5a', '#7c4f6a', '#4f6a7c', '#7c6a4f',
  '#5a4f7c', '#7c4f4f', '#4f7c6a', '#6a7c4f',
  '#7c704f', '#4f6a7c',
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function getInitials(nome: string, cognome: string) {
  return `${nome[0] ?? ''}${cognome[0] ?? ''}`.toUpperCase();
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#1a1d2a] rounded-xl p-4 border border-[#c19e4a]/8 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#2a2d3a] shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-[#2a2d3a] rounded w-2/3" />
          <div className="h-2.5 bg-[#2a2d3a] rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="h-2 bg-[#2a2d3a] rounded w-full" />
        <div className="h-2 bg-[#2a2d3a] rounded w-3/4" />
      </div>
      <div className="h-7 bg-[#2a2d3a] rounded-lg w-full" />
    </div>
  );
}

// ─── Card utente ──────────────────────────────────────────────────────────────
interface UtenteCardProps {
  utente: UtenteEsplora;
  onConnetti: (id: string) => void;
  isLoading?: boolean;
}

function UtenteCard({ utente, onConnetti, isLoading = false }: UtenteCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col bg-[#1a1d2a] rounded-xl p-4
                 border border-[#c19e4a]/10
                 hover:border-[#c19e4a]/25 hover:bg-[#1e2130]
                 transition-colors duration-150"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2.5">
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
                     text-xs font-bold text-[#e6e8ed]"
          style={{ background: avatarColor(utente.id) }}
          aria-hidden="true"
        >
          {getInitials(utente.nome, utente.cognome)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#e6e8ed] truncate">
            {utente.nome} {utente.cognome}
          </p>
          <p className="text-xs text-[#7db89a]/65 truncate">{utente.ruolo}</p>
        </div>
      </div>

      {/* Bio */}
      {utente.bio && (
        <p className="text-xs text-[#c8cad0]/60 leading-relaxed mb-2.5 line-clamp-2">
          {utente.bio}
        </p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded
                     bg-[#c19e4a]/10 text-[#c19e4a]/80"
        >
          {utente.settore}
        </span>
        {utente.connessioniInComune > 0 && (
          <span className="text-[10px] text-[#7db89a]/40">
            {utente.connessioniInComune} in comune
          </span>
        )}
      </div>

      {/* CTA */}
      {utente.isConnesso ? (
        <span
          className="w-full py-2 text-xs font-medium rounded-lg text-center
                     bg-[#4dbe87]/10 text-[#4dbe87]/70 border border-[#4dbe87]/20"
        >
          Connesso
        </span>
      ) : isLoading ? (
        <span
          className="w-full py-2 text-xs font-medium rounded-lg text-center
                     bg-[#c19e4a]/8 text-[#c19e4a]/50 border border-[#c19e4a]/15"
        >
          Invio…
        </span>
      ) : (
        <button
          onClick={() => onConnetti(utente.id)}
          className="tap-highlight-none w-full py-2 text-xs font-semibold rounded-lg
                     bg-[#c19e4a]/15 text-[#c19e4a]
                     hover:bg-[#c19e4a]/25 active:scale-[0.97]
                     transition-all duration-150 border border-[#c19e4a]/20"
        >
          + Connetti
        </button>
      )}
    </motion.div>
  );
}

// ─── Empty state ricerca ──────────────────────────────────────────────────────
function EmptyRicerca({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center col-span-full">
      <div className="text-[#7db89a]/20 mb-3">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#c8cad0]">
        Nessun risultato per &ldquo;{query}&rdquo;
      </p>
      <p className="text-xs text-[#7db89a]/35 mt-1 max-w-[28ch]">
        Prova con un nome, ruolo o settore diverso.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function EsploraPanel() {
  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [settoreFiltro, setSettore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState<Set<string>>(new Set());

  const { data: suggeritiData, isLoading: suggeritiLoading } = useSuggestions();
  const { data: ricercaData, isLoading: ricercaLoading } = useSearchUsers(debouncedQ);
  const sendRequest = useSendRequest();

  // Debounce ricerca 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Lista utenti da mostrare
  const utentiBase: UtenteEsplora[] = debouncedQ
    ? (ricercaData?.results ?? []).map((u) => networkUserToUtente(u))
    : (suggeritiData?.suggestions ?? []).map((u) => networkUserToUtente(u));

  // Filtro lato client per settore
  const filtrati = utentiBase.filter((u) => {
    if (settoreFiltro !== null && u.settore !== settoreFiltro) return false;
    return true;
  });

  const isLoading = suggeritiLoading || (debouncedQ.length >= 2 && ricercaLoading);

  const handleConnetti = useCallback(async (userId: string) => {
    if (invioInCorso.has(userId)) return;
    setInvioInCorso((prev) => new Set(prev).add(userId));

    try {
      // Trova l'utente nella lista per ottenere l'id numerico
      const utentiDisponibili =
        debouncedQ ? (ricercaData?.results ?? []) : (suggeritiData?.suggestions ?? []);
      const target = utentiDisponibili.find((u) => String(u.id) === userId);
      if (target) {
        sendRequest.mutate(target.id);
      }
    } finally {
      setInvioInCorso((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }, [sendRequest, ricercaData, suggeritiData, debouncedQ, invioInCorso]);

  return (
    <section aria-label="Esplora utenti">
      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7db89a]/40"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <input
          type="search"
          placeholder="Cerca per nome, ruolo o settore…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cerca utenti"
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl
                     bg-[#1a1d2a] border border-[#c19e4a]/10
                     text-[#e6e8ed] placeholder:text-[#7db89a]/30
                     focus:outline-none focus:border-[#c19e4a]/35
                     transition-colors"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              onClick={() => setQuery('')}
              aria-label="Cancella ricerca"
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-[#7db89a]/40 hover:text-[#7db89a]
                         transition-colors tap-highlight-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Suggestion chips settore */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 mb-5
                   scrollbar-hide snap-x snap-mandatory"
        role="group"
        aria-label="Filtra per settore"
      >
        <button
          onClick={() => setSettore(null)}
          className={`tap-highlight-none shrink-0 px-3 py-1.5 text-xs font-medium rounded-full
                      snap-start transition-colors duration-150 ${
                        settoreFiltro === null
                          ? 'bg-[#c19e4a] text-[#0b0d14]'
                          : 'bg-[#1a1d2a] text-[#7db89a]/60 border border-[#c19e4a]/10 hover:border-[#c19e4a]/25'
                      }`}
        >
          Tutti
        </button>
        {SUGGERIMENTI_SETTORE.map((s) => (
          <button
            key={s}
            onClick={() => setSettore(settoreFiltro === s ? null : s)}
            className={`tap-highlight-none shrink-0 px-3 py-1.5 text-xs font-medium rounded-full
                        snap-start transition-colors duration-150 ${
                          settoreFiltro === s
                            ? 'bg-[#c19e4a] text-[#0b0d14]'
                            : 'bg-[#1a1d2a] text-[#7db89a]/60 border border-[#c19e4a]/10 hover:border-[#c19e4a]/25'
                        }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Titolo sezione */}
      <p className="text-xs text-[#7db89a]/40 uppercase tracking-wider mb-3">
        {debouncedQ || settoreFiltro ? 'Risultati' : 'Suggeriti per te'}
      </p>

      {/* Skeleton loading */}
      {isLoading && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={`sk-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <SkeletonCard />
            </motion.div>
          ))}
        </div>
      )}

      {/* Griglia risultati */}
      {!isLoading && (
        <div
          className="grid gap-3
                     grid-cols-1
                     sm:grid-cols-2
                     lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {filtrati.length === 0 ? (
              <EmptyRicerca query={debouncedQ || settoreFiltro || ''} />
            ) : (
              filtrati.map((u, i) => (
                <motion.div
                  key={u.id}
                  layoutId={`user-${u.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04, duration: 0.18 }}
                >
                  <UtenteCard
                    utente={u}
                    onConnetti={handleConnetti}
                    isLoading={invioInCorso.has(u.id)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}