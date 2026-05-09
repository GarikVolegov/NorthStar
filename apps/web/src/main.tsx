import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Tailwind 4: import diretto del CSS invece di tailwind.config.js
import './index.css';

// App principale (router + layout)
import App from './App';

// ─── Phase 0 — Web Vitals Baseline ───────────────────────────────────────────
// Attivo SOLO in development e staging. NON invia dati in produzione.
// Rimuovere o collegare a un endpoint analytics nella Fase 2.
import { reportWebVitals } from './lib/reportWebVitals';

if (import.meta.env.MODE !== 'production') {
  reportWebVitals();
}
// ─────────────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (!root) throw new Error('[NorthStar] #root element not found in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
