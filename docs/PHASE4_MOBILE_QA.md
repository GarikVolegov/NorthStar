# 🧪 Phase 4 — Mobile Testing & QA

> Documento tecnico della pipeline di QA mobile.
> Stato: **IMPLEMENTATO** — Maggio 2026

---

## File creati

| File | Tipo | Scopo |
|------|------|-------|
| `.github/workflows/mobile-qa.yml` | Workflow GHA | Lighthouse CI + Playwright mobile |
| `config/lighthouse/lighthouserc.json` | Config | Soglie e emulazione Pixel 5 |
| `e2e/mobile/onboarding.mobile.spec.ts` | Test E2E | Onboarding su Pixel 5 + iPhone 12 |
| `e2e/mobile/mobile-nav.mobile.spec.ts` | Test E2E | Drawer, BottomNav, scroll, overflow |
| `e2e/mobile/pwa-offline.mobile.spec.ts` | Test E2E | Service Worker, manifest, offline |

---

## 1. Lighthouse CI — `mobile-qa.yml` job `lighthouse-mobile`

### Quando si attiva
- Push su `main` o `develop` che toccano `apps/web/**`
- Ogni PR verso `main`
- `workflow_dispatch` manuale

### Emulazione mobile configurata (`config/lighthouse/lighthouserc.json`)

| Parametro | Valore | Equivale a |
|-----------|--------|------------|
| Device | Moto G Power (2022) | Low-end Android |
| CPU slowdown | 4x | Device economico |
| Rete | Slow 4G (150ms RTT) | Connessione mobile reale |
| Risoluzione | 412×915 @ 2.625x DPR | Android standard |

### Soglie di build

| Categoria | Soglia | Livello |
|-----------|--------|--------|
| Performance | ≥ 70 | `warn` (non blocca) |
| Accessibility | ≥ 85 | `error` (blocca build) |
| Best Practices | ≥ 85 | `error` (blocca build) |
| PWA | ≥ 70 | `warn` (non blocca) |
| CLS | ≤ 0.1 | `error` (blocca build) |

> **Perché Performance è `warn` e non `error`?**
> All'inizio del progetto il punteggio su low-end mobile può essere < 70.
> Con la Fase 2 (PWA + chunking) dovrebbe superare 70. Una volta stabile,
> alza a `error`.

### Commento automatico su PR

Ogni PR riceve un commento con tabella dei risultati Lighthouse:

```
## ⚡ Lighthouse CI — Mobile

| URL        | Perf | A11y | Best Pract. | PWA  |
|------------|------|------|-------------|------|
| /          | 🟢 82 | 🟢 92 | 🟢 87        | 🟡 72 |
| /test      | 🟡 74 | 🟢 90 | 🟢 89        | 🟡 70 |
| /settori   | 🟢 78 | 🟢 91 | 🟢 86        | 🟡 71 |
```

---

## 2. Playwright Mobile — job `playwright-mobile`

### Device targets

| Device | Engine | OS |
|--------|--------|----|
| Pixel 5 | Chromium | Android 11 |
| iPhone 12 | WebKit | iOS 14 |

### Test implementati

#### `onboarding.mobile.spec.ts` (Pixel 5 + iPhone 12)

| Test | Verifica |
|------|----------|
| Home carica e mostra CTA | Titolo + CTA visibili, tap target ≥ 44px |
| Hamburger apre drawer | Menu visibile con link navigazione |
| Chiusura drawer con X | Links non visibili dopo chiusura |
| Navigazione verso /register | URL cambia a /register |
| BottomNav visibile | Navigation role presente + tap target |

#### `mobile-nav.mobile.spec.ts` (Pixel 5)

| Test | Verifica |
|------|----------|
| BottomNav link raggiungono pagina | URL cambia correttamente |
| Hamburger → naviga → drawer chiude | Chiusura auto post-navigazione |
| Scroll verticale fluido | `scrollY > 0` dopo scroll |
| Navbar sticky dopo scroll | Header ancora visibile |
| Nessun overflow orizzontale | `scrollWidth === clientWidth` |

#### `pwa-offline.mobile.spec.ts` (Pixel 5, solo CI)

| Test | Verifica |
|------|----------|
| manifest.webmanifest valido | Status 200 + campi obbligatori |
| Service Worker registrato | `navigator.serviceWorker.getRegistration()` |
| Home offline da cache SW | Pagina visibile con `context.setOffline(true)` |
| Nessun errore JS critico | `page.on('pageerror')` vuoto |

> I test PWA si attivano solo in CI (`ENABLE_PWA_TESTS=true`) perché
> richiedono la build di produzione (il Service Worker non gira in dev).

---

## 3. Come eseguire in locale

```bash
# Solo Lighthouse (richiede build)
pnpm --filter @northstar/web build
pnpm --filter @northstar/web preview &
npx lhci autorun --config=config/lighthouse/lighthouserc.json \
  --collect.url="http://localhost:5173"

# Solo Playwright mobile
pnpm exec playwright test e2e/mobile/ --project="Pixel 5"

# Con report HTML
pnpm exec playwright test e2e/mobile/ --reporter=html
pnpm exec playwright show-report

# Con UI (modalità visuale interattiva)
pnpm exec playwright test e2e/mobile/ --ui
```

---

## 4. Checklist Phase 4

### GitHub Actions
- [ ] Aggiungere `LHCI_GITHUB_APP_TOKEN` come secret (opzionale, per commenti PR automatici)
- [ ] Verificare che la pipeline `mobile-qa.yml` si attivi al prossimo push
- [ ] Controllare il primo run e aggiustare le soglie se necessario

### Playwright
- [ ] Installare browser aggiuntivi: `pnpm exec playwright install webkit`
- [ ] Eseguire `pnpm exec playwright test e2e/mobile/` localmente
- [ ] Aggiustare selettori se i test falliscono (basati su aria-label definiti in Navbar/BottomNav)

### Progressive Enhancement
- [ ] Una volta che le icone PWA sono pronte (cfr. PHASE2), rimuovere lo skip del test manifest
- [ ] Alza soglia Performance da `warn` a `error` quando score > 80 stabile

---

_PHASE4_MOBILE_QA.md — NorthStar · Phase 4 · Maggio 2026_
