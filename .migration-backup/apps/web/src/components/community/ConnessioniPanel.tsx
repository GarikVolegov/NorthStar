/**
 * ConnessioniPanel.tsx
 *
 * Tab "Connessioni" nella pagina /amici.
 * Mostra la lista degli utenti con cui sei connesso (amici accettati).
 * Ogni card ha: avatar, nome, ruolo/titolo, badge settore, azione
 * "Invia messaggio" e menu contestuale per rimuovere connessione.
 *
 * Dati: mock statici — sostituire con useQuery('/api/connections') in Step 4.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Tipi ─────────────────────────────────────────────────────────────────────
export interface Connessione {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  settore: string;
  avatar?: string;
  online: boolean;
  connessoDal: string; // ISO date string
}

// ─── Mock data (Step 4: sostituire con fetch) ─────────────────────────────────
const MOCK_CONNESSIONI: Connessione[] = [
  { id: '1', nome: 'Giulia',  cognome: 'Ferretti', ruolo: 'UX Designer',          settore: 'Design',        online: true,  connessoDal: '2026-03-10' },
  { id: '2', nome: 'Marco',   cognome: 'Rossi',    ruolo: 'Backend Developer',    settore: 'Tecnologia',    online: false, connessoDal: '2026-02-14' },
  { id: '3', nome: 'Sara',    cognome: 'Bianchi',  ruolo: 'Product Manager',      settore: 'Prodotto',      online: true,  connessoDal: '2026-04-01' },
  { id: '4', nome: 'Luca',    cognome: 'Conti',    ruolo: 'Data Scientist',       settore: 'Data & AI',     online: false, connessoDal: '2026-01-22' },
  { id: '5', nome: 'Chiara',  cognome: 'Gallo',    ruolo: 'Marketing Strategist', settore: 'Marketing',     online: false, connessoDal: '2026-03-28' },
  { id: '6', nome: 'Andrea',  cognome: 'Marini',   ruolo: 'DevOps Engineer',      settore: 'Tecnologia',    online: true,  connessoDal: '2026-04-15' },
  { id: '7', nome: 'Elena',   cognome: 'Romano',   ruolo: 'Graphic Designer',     settore: 'Design',        online: false, connessoDal: '2026-05-02' },
  { id: '8', nome: 'Matteo',  cognome: 'Greco',    ruolo: 'Full Stack Developer',  settore: 'Tecnologia',    online: true,  connessoDal: '2026-05-05' },
];

// ─── Utilità ──────────────────────────────────────────────────────────────────
function getInitials(nome: string, cognome: string) {
  return `${nome[0]}${cognome[0]}`.toUpperCase();
}

const AVATAR_COLORS = [
  '#4f7c5a', '#7c4f6a', '#4f6a7c', '#7c6a4f',
  '#5a4f7c', '#7c4f4f', '#4f7c6a', '#6a7c4f',
];

function avatarColor(id: string): string {
  const idx = parseInt(id, 10) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function formatData(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
}

// ─── Componente Avatar ────────────────────────────────────────────────────────
function Avatar({ conn }: { conn: Connessione }) {
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
      {/* Indicatore online */}
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
  onRimuovi: (id: string) => void;
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
                {/* Overlay per chiudere */}
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
                    onClick={() => { onRimuovi(conn.id); setMenuAperto(false); }}
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
  const [connessioni, setConnessioni] = useState<Connessione[]>(MOCK_CONNESSIONI);
  const [filtro, setFiltro] = useState('');

  const filtrate = connessioni.filter(
    (c) =>
      filtro === '' ||
      `${c.nome} ${c.cognome} ${c.ruolo} ${c.settore}`
        .toLowerCase()
        .includes(filtro.toLowerCase()),
  );

  function handleRimuovi(id: string) {
    setConnessioni((prev) => prev.filter((c) => c.id !== id));
  }

  function handleMessaggio(conn: Connessione) {
    onMessaggio?.(conn);
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
              <li key={conn.id} role="listitem">
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
