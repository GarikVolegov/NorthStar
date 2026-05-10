/**
 * amici.tsx — /amici
 *
 * Pagina Community di NorthStar.
 * Tab:
 *   0 — Messaggi     (DMPanel)
 *   1 — Connessioni  (ConnessioniPanel)
 *   2 — Richieste    (RichiestePanel)
 *   3 — Esplora      (EsploraPanel)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DMPanel } from '@/components/dm/DMPanel';
import { ConnessioniPanel }  from '@/components/community/ConnessioniPanel';
import { RichiestePanel }    from '@/components/community/RichiestePanel';
import { EsploraPanel }      from '@/components/community/EsploraPanel';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'messaggi',    label: 'Messaggi' },
  { id: 'connessioni', label: 'Connessioni' },
  { id: 'richieste',   label: 'Richieste' },
  { id: 'esplora',     label: 'Esplora' },
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

        {/* Tab bar — scroll orizzontale su mobile */}
        <div
          className="flex items-center gap-1 mb-6
                     bg-[#1a1d2a] rounded-xl p-1 w-full overflow-x-auto
                     scrollbar-hide"
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
                'relative shrink-0 px-4 py-2 text-sm font-medium rounded-lg',
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
            {tab === 'messaggi'    && <DMPanel />}
            {tab === 'connessioni' && <ConnessioniPanel />}
            {tab === 'richieste'   && <RichiestePanel />}
            {tab === 'esplora'     && <EsploraPanel />}
          </motion.div>
        </AnimatePresence>

      </div>
    </main>
  );
}
