# 📱 Mobile Optimization — Fasi 1–4

> Sommario tecnico di tutte le implementazioni mobile-first su NorthStar.
> Completato: Maggio 2026

---

## Panoramica

| Fase | Area | Stato |
|------|------|-------|
| **1** | Touch Interaction & UI | ✅ Completato |
| **2** | Performance & PWA | ✅ Completato |
| **3** | PRPL (integrato nella Fase 2) | ✅ Completato |
| **4** | Testing & QA Mobile | ✅ Completato |

---

## Fase 1 — Touch Interaction & UI

### File aggiunti
- `apps/web/src/components/layout/Navbar.tsx`
- `apps/web/src/components/layout/BottomNav.tsx`

### Cosa fa `Navbar.tsx`
- **Desktop (≥ md):** logo + link orizzontali (max 5) + pulsanti auth/premium
- **Mobile (< md):** logo + CTA "Inizia" + hamburger 44×44px → `MobileDrawer`
- Il drawer divide le voci in: menu pubblico / area personale / sezione premium
- Chiusura automatica ad ogni cambio rotta (`useMobileNav(location)`)
- Icona hamburger diventa X quando il drawer è aperto (SVG inline, zero import)
- `aria-expanded`, `aria-controls`, `aria-current="page"` su tutti gli elementi
- Safe area inset-top per iPhone notch

### Cosa fa `BottomNav.tsx`
- Fisso in basso, visibile solo su mobile (`md:hidden`)
- Nascosto su `/login`, `/register`, `/test`
- 3 voci per utenti non loggati, 5 per utenti autenticati
- Dot indicator dorato sulla voce attiva
- `padding-bottom: env(safe-area-inset-bottom)` per iPhone home indicator
- Tutti i tap target ≥ 44px, `aria-current="page"`, `aria-label` su ogni link

---

## Fase 2 — Performance & PWA

### File modificati
- `apps/web/vite.config.ts` — PWA plugin + advanced chunking + visualizer
- `apps/web/package.json` — aggiunti `web-vitals`, `vite-plugin-pwa`, `rollup-plugin-visualizer`

### File aggiunti
- `apps/web/public/icons/README.md` — istruzioni per le 3 icone PWA
- `apps/web/public/screenshots/README.md` — istruzioni per gli screenshot PWA
- `docs/PHASE2_PERFORMANCE_PWA.md` — guida tecnica completa

### PWA (vite-plugin-pwa + Workbox)

Manifest configurato con:
- `display: standalone` — senza barra browser
- `theme_color: #0e1018` — match dark theme
- 3 icone (192px, 512px, 512px maskable)
- 2 shortcuts nativi (Test, Dashboard)
- Screenshot per scheda installazione Android

Strategia Workbox:

| Risorsa | Strategia | TTL |
|---------|-----------|-----|
| Asset statici | Precache (hash) | Indefinito |
| `/api/*` | NetworkFirst (5s timeout) | 24h |
| Font Google | StaleWhileRevalidate | 1 anno |
| Immagini esterne | CacheFirst | 30 giorni |

### Advanced manualChunks

| Chunk | Contenuto |
|-------|-----------|
| `vendor-react` | react, react-dom, scheduler |
| `vendor-router` | wouter |
| `vendor-motion` | framer-motion |
| `vendor-charts` | recharts, d3 |
| `vendor-radix` | @radix-ui/* |
| `vendor-query` | @tanstack/react-query |
| `vendor-icons` | lucide-react |
| `vendor-zod` | zod |
| `vendor-misc` | resto di node_modules |

### Bundle analyzer
```bash
pnpm --filter @northstar/web analyze
# Apre dist/bundle-report.html
```

---

## Fase 3 — PRPL (integrato nella Fase 2)

- **Push/Preload:** asset critici (JS/CSS) pre-cachati dal SW
- **Render veloce:** tutte le rotte già lazy-loadate via `React.lazy` in `App.tsx`
- **Pre-cache:** Workbox gestisce la pre-cache delle rotte future
- **Lazy-load:** i chunk separati vengono scaricati on-demand

---

## Fase 4 — Testing & QA Mobile

### File aggiunti
- `.github/workflows/mobile-qa.yml`
- `lighthouserc.json`
- `e2e/mobile/onboarding.mobile.spec.ts`
- `e2e/mobile/mobile-nav.mobile.spec.ts`
- `e2e/mobile/pwa-offline.mobile.spec.ts`
- `docs/PHASE4_MOBILE_QA.md`

### GitHub Actions — `mobile-qa.yml`

Due job paralleli, attivati solo su push che toccano `apps/web/**`:

**Job `lighthouse-mobile`**
- Build produzione → `preview` su porta 5173
- Lighthouse CI su 3 URL: `/`, `/test`, `/settori`
- Emulazione: Moto G Power 2022, CPU ×4, Slow 4G (150ms RTT)
- Commento automatico con tabella risultati su ogni PR

**Job `playwright-mobile`**
- Stack completa (API + frontend statico)
- Device: Pixel 5 (Chromium) + iPhone 12 (WebKit)

### Soglie Lighthouse

| Categoria | Soglia | Tipo |
|-----------|--------|------|
| Performance | ≥ 70 | warn |
| Accessibility | ≥ 85 | **error** |
| Best Practices | ≥ 85 | **error** |
| PWA | ≥ 70 | warn |
| CLS | ≤ 0.1 | **error** |

### Test E2E — 14 test su 3 spec

**`onboarding.mobile.spec.ts`** (Pixel 5 + iPhone 12)
- Home carica, CTA visibile, tap target ≥ 44px
- Hamburger apre drawer con link di navigazione
- Chiusura drawer con pulsante X
- Navigazione verso `/register`
- BottomNav visibile con tap target corretti

**`mobile-nav.mobile.spec.ts`** (Pixel 5)
- BottomNav link raggiungono URL corretti
- Drawer si chiude automaticamente dopo navigazione
- Scroll verticale fluido (`scrollY > 0`)
- Navbar sticky dopo scroll
- Nessun overflow orizzontale (`scrollWidth === clientWidth`)

**`pwa-offline.mobile.spec.ts`** (Pixel 5, solo CI)
- `manifest.webmanifest` valido (status 200, campi obbligatori)
- Service Worker registrato
- Home offline servita dalla cache SW
- Nessun errore JS critico

---

## Checklist finale pre-deploy

- [ ] `pnpm install` per installare `vite-plugin-pwa`, `web-vitals`, `rollup-plugin-visualizer`
- [ ] Creare `apps/web/public/icons/icon-192.png` (192×192)
- [ ] Creare `apps/web/public/icons/icon-512.png` (512×512)
- [ ] Creare `apps/web/public/icons/icon-512-maskable.png` (512×512 maskable)
- [ ] Catturare `apps/web/public/screenshots/mobile-home.png` (390×844)
- [ ] `pnpm --filter @northstar/web build && pnpm --filter @northstar/web preview`
- [ ] Lighthouse PWA ≥ 70 su Chrome DevTools
- [ ] `pnpm exec playwright install webkit`
- [ ] `pnpm exec playwright test e2e/mobile/` — tutti i test verdi
- [ ] Aggiungere secret `LHCI_GITHUB_APP_TOKEN` su GitHub (opzionale, per commenti PR)

---

_MOBILE_OPTIMIZATION_SUMMARY.md — NorthStar · Maggio 2026_
