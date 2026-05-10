/**
 * ConnessioniPanel.tsx
 *
 * Tab "Connessioni" nella pagina /amici.
 * Mostra la lista degli utenti con cui sei connesso (amici accettati).
 *
 * Dati: useFriends() — GET /api/friends
 * Azioni: useRemoveFriend() — DELETE /api/friends/:id
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriends, useRemoveFriend } from '@/hooks/useNetwork';
import { cn } from '@/lib/utils';

// ─── Tipi locali (derivati dai dati API) ────────────────────────────────────────
export interface Connessione {
  friendshipId: number;
  id: string;          // userId come stringa per compatibilità UI
  nome: string;
  cognome: string;
  ruolo: string;       // journeyType
  settore: string;     // sectorName
  avatar?: string | null;
  online: boolean;
  connessoDal: string; // ISO date string
}

function networkUserToConnessione(friend: {
  friendshipId: number;
  since: string | null;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    sectorName: string | null;
    journeyType: string | null;
    totalXp: number | null;
  };
}): Connessione {
  const parts = friend.user.name.trim().split(/\s+/);
  const nome = parts[0] || '';
  const cognome = parts.slice(1).join(' ') || '';
  return {
    friendshipId: friend.friendshipId,
    id: String(friend.user.id),
    nome,
    cognome,
    ruolo: friend.user.journeyType || '---',
    settore: friend.user.sectorName || '---',
    avatar: friend.user.avatarUrl ?? undefined,
    online: false,
    connessoDal: friend.since ?? new Date().toISOString(),
  };
}

// ─── Utilità ──────────────────────────────────────────────────────────────────
function getInitials(nome: string, cognome: string) {
  return `${nome[0] ?? ''}${cognome[0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  '#4f7c5a', '#7c4f6a', '#4f6a7c', '#7c6a4f',
  '#5a4f7c', '#7c4f4f', '#4f7c6a', '#6a7c4f',
];

function avatarColor(id: string): string {
  const idx = parseInt(id, 10) % AVATAR_COLORS.length;
  return AVATAR_COLORS[isNaN(idx) ? 0 : idx];
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

// ─── Componente Avatar ────────────────────────────────────────────────────────
function Avatar({ conn }: { conn: Connessione }) {
  if (conn.avatar) {
    return (
      <div className="relative shrink-0">
        <img
          src={conn.avatar}
          alt={`${conn.nome} ${conn.cognome}`}
          className="w-10 h-10 rounded-full object-cover"
        />
        {conn.online && (
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full
                       bg-[#4dbe87] border-2 border-[#0b0d14]"
            aria-label="Online"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center
                   text-xs font-bold text-[#e6e8ed] select-none"
        style={{ background: avatarColor(conn.id) }}
        aria-hidden="true"
      >
        {getInitials(conn.nome, conn.cognome)}
      </div>
      {conn.online && (
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full
                     bg-[#4dbe87] border-2 border-[#0b0d14]"
          aria-label="Online"
        />
      )}
    </div>
  );
}

// ─── Card singola connessione ─────────────────────────────────────────────────
function ConnessioneCard({
  conn,
  onRimuovi,
  onMessaggio,
}: {
  conn: Connessione;
  onRimuovi: (friendshipId: number) => void;
  onMessaggio: (conn: Connessione) => void;
}) {
  const [menuAperto, setMenuAperto] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.18 }}
      className="relative flex items-center gap-3 px-4 py-3
                 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/10
                 hover:border-[#c19e4a]/25 hover:bg-[#1e2130]
                 transition-colors duration-150 group"
    >
      <Avatar conn={conn} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#e6e8ed] truncate">
          {conn.nome} {conn.cognome}
        </p>
        <p className="text-xs text-[#7db89a]/70 truncate">{conn.ruolo}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded
                       bg-[#c19e4a]/10 text-[#c19e4a]/80 leading-tight"
          >
            {conn.settore}
          </span>
          <span className="text-[10px] text-[#7db89a]/40">
            Dal {formatData(conn.connessoDal)}
          </span>
        </div>
      </div>

      {/* Azioni */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Bottone messaggio */}
        <button
          onClick={() => onMessaggio(conn)}
          aria-label={`Invia messaggio a ${conn.nome}`}
          className="tap-highlight-none touch-target w-9 h-9
                     rounded-lg bg-[#c19e4a]/10 text-[#c19e4a]
                     hover:bg-[#c19e4a]/20 transition-colors
                     flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Menu kebab */}
        <div className="relative">
          <button
            onClick={() => setMenuAperto(v => !v)}
            aria-label="Altre opzioni"
            aria-expanded={menuAperto}
            className="tap-highlight-none touch-target w-9 h-9
                       rounded-lg text-[#7db89a]/50
                       hover:bg-[#7db89a]/10 hover:text-[#7db89a]
                       transition-colors flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          <AnimatePresence>
            {menuAperto && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuAperto(false)}
                  aria-hidden="true"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-20
                             bg-[#1e2130] border border-[#c19e4a]/15
                             rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden"
                >
                  <button
                    onClick={() => { onMessaggio(conn); setMenuAperto(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#e6e8ed]/80
                               hover:bg-[#c19e4a]/10 hover:text-[#e6e8ed]
                               transition-colors flex items-center gap-2.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Invia messaggio
                  </button>
                  <button
                    onClick={() => { onRimuovi(conn.friendshipId); setMenuAperto(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#e57373]/80
                               hover:bg-[#e57373]/10 hover:text-[#e57373]
                               transition-colors flex items-center gap-2.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Rimuovi connessione
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyConnessioni() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-[#7db89a]/20 mb-4">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#c8cad0]">Ancora nessuna connessione</p>
      <p className="text-xs text-[#7db89a]/40 mt-1.5 max-w-[28ch]">
        Vai su <strong className="text-[#c19e4a]/70">Esplora</strong> per trovare persone con i tuoi stessi obiettivi.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function ConnessioniPanel({
  onMessaggio,
}: {
  onMessaggio?: (conn: Connessione) => void;
}) {
  const { data: friends = { friends: [] }, isLoading, error } = useFriends();
  const removeFriend = useRemoveFriend();
  const [filtro, setFiltro] = useState('');

  const connessioni: Connessione[] = friends.friends.map(networkUserToConnessione);

  const filtrate = connessioni.filter(
    (c) =>
      filtro === '' ||
      `${c.nome} ${c.cognome} ${c.ruolo} ${c.settore}`
        .toLowerCase()
        .includes(filtro.toLowerCase()),
  );

  function handleRimuovi(friendshipId: number) {
    removeFriend.mutate(friendshipId);
  }

  function handleMessaggio(conn: Connessione) {
    onMessaggio?.(conn);
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-[#1a1d2a] rounded-xl border border-[#c19e4a]/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-[#e57373]/70 text-sm">
        Errore nel caricamento delle connessioni. Riprova più tardi.
      </div>
    );
  }

  return (
    <section aria-label="Le tue connessioni">
      {/* Header contatore + search */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-xs text-[#7db89a]/50 shrink-0">
          <span className="font-semibold text-[#c19e4a]">{connessioni.length}</span> connessioni
        </p>
        <div className="relative flex-1 max-w-xs">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7db89a]/40"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Cerca tra le connessioni…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg
                       bg-[#1a1d2a] border border-[#c19e4a]/10
                       text-[#e6e8ed] placeholder:text-[#7db89a]/35
                       focus:outline-none focus:border-[#c19e4a]/35
                       transition-colors"
          />
        </div>
      </div>

      {/* Lista */}
      {filtrate.length === 0 ? (
        <EmptyConnessioni />
      ) : (
        <motion.ul
          layout
          className="flex flex-col gap-2"
          role="list"
          aria-label="Lista connessioni"
        >
          <AnimatePresence mode="popLayout">
            {filtrate.map((conn) => (
              <li key={conn.friendshipId} role="listitem">
                <ConnessioneCard
                  conn={conn}
                  onRimuovi={handleRimuovi}
                  onMessaggio={handleMessaggio}
                />
              </li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </section>
  );
}