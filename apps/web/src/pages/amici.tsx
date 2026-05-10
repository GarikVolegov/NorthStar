/**
 * amici.tsx — /amici
 *
 * Pagina Community di NorthStar.
 * Tab:
 *   0 — Messaggi (DMPanel)
 *   1 — Connessioni (lista amici accettati) — placeholder per Step 4
 *   2 — Richieste (pending) — placeholder per Step 4
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DMPanel } from '@/components/dm/DMPanel';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'messaggi',    label: 'Messaggi' },
  { id: 'connessioni', label: 'Connessioni' },
  { id: 'richieste',   label: 'Richieste' },
] as const;

type Tab = typeof TABS[number]['id'];

export default function AmiciPage() {
  const [tab, setTab] = useState<Tab>('messaggi');

  return (
    <main className="min-h-screen bg-[#0b0d14] px-4 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto pt-6 md:pt-10">

        {/* Intestazione */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#e6e8ed] tracking-tight">Community</h1>
          <p className="text-sm text-[#7db89a]/70 mt-0.5">
            Connettiti con altri utenti, scambia messaggi, costruisci la tua rete.
          </p>
        </div>

        {/* Tab bar */}
        <div
          className="flex items-center gap-1 mb-6
                     bg-[#1a1d2a] rounded-xl p-1 w-fit"
          role="tablist"
          aria-label="Sezioni Community"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative px-4 py-2 text-sm font-medium rounded-lg',
                'transition-colors duration-150 tap-highlight-none',
                tab === t.id
                  ? 'text-[#0e1018]'
                  : 'text-[#7db89a]/70 hover:text-[#7db89a]',
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 bg-[#c19e4a] rounded-lg"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Pannelli */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={tab}
          >
            {tab === 'messaggi' && <DMPanel />}

            {tab === 'connessioni' && (
              <PlaceholderPanel
                icon={
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                }
                title="Le tue connessioni"
                subtitle="Qui vedrai tutti gli utenti con cui sei connesso. Disponibile nello Step 4."
              />
            )}

            {tab === 'richieste' && (
              <PlaceholderPanel
                icon={
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                }
                title="Richieste di connessione"
                subtitle="Accetta o rifiuta le richieste in arrivo. Disponibile nello Step 4."
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

// ─── Placeholder per tab non ancora sviluppate ────────────────────────────────
function PlaceholderPanel({
  icon, title, subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-[#7db89a]/25 mb-4">{icon}</div>
      <p className="text-sm font-semibold text-[#c8cad0]">{title}</p>
      <p className="text-xs text-[#7db89a]/40 mt-1.5 max-w-[32ch]">{subtitle}</p>
    </div>
  );
}
