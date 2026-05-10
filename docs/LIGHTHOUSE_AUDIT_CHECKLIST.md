# 🔦 Lighthouse Audit Checklist — NorthStar Mobile

> Checklist operativa per eseguire e documentare gli audit Lighthouse
> durante la Phase 0 e ad ogni milestone successivo.
> Affianca `MOBILE_BASELINE.md` per la raccolta dati.

---

## Setup pre-audit

```bash
# 1. Build production-like (più realistico di dev server)
pnpm --filter @northstar/web build
pnpm --filter @northstar/web preview
# → http://localhost:4173
```

> **Perché build + preview e non il dev server?**
> Il dev server di Vite include hot-reload overhead e sourcemaps che
> gonfiano i tempi artificialmente. Il preview riproduce un build
> ottimizzato, più vicino a ciò che vede l'utente reale.

---

## Procedura per ogni pagina

1. Apri la pagina in Chrome (nessun'altra tab, estensioni disabilitate).
2. DevTools → **Lighthouse** → Mode: **Navigation**, Device: **Mobile**.
3. Categorie: ✅ Performance ✅ Accessibility ✅ Best Practices ✅ PWA.
4. Clicca **Analyze page load**.
5. Attendi il report completo (~30–60s).
6. **Salva il report** (pulsante in alto a destra → "Save as HTML").
7. Annota i 4 score + le opportunità principali in `MOBILE_BASELINE.md`.
8. Ripeti una seconda volta → prendi la media dei due score Performance.

---

## Pagine da auditare (in ordine di priorità)

### 🔴 Alta priorità — funnel principale

- [ ] **Home** → `/`
  - È la prima cosa che vede un utente nuovo.
  - Controlla: LCP, FCP, immagini hero ottimizzate, font blocking.

- [ ] **Test RIASEC** → `/test`
  - Pagina centrale del prodotto.
  - Controlla: INP sui bottoni di risposta, CLS durante lo scorrimento.

- [ ] **Risultati** → `/risultati`
  - Pagina ricca di dati e grafici (Recharts).
  - Controlla: LCP, bundle size, lazy load dei chart.

- [ ] **Dashboard** → `/dashboard`
  - Pagina principale post-login.
  - Controlla: TTFB (auth check + fetch), INP, skeleton screens.

### 🟡 Media priorità — funnel premium

- [ ] **Settori** → `/settori`
- [ ] **Singolo settore** → `/settore/:id`
- [ ] **Percorso / Roadmap** → `/percorso`
- [ ] **News** → `/news`
- [ ] **Wiki AI** → `/wiki`
- [ ] **Grafo conoscenza** → `/grafo-conoscenza`

### 🟢 Bassa priorità — pagine statiche/secondarie

- [ ] **Login** → `/login`
- [ ] **Register** → `/register`
- [ ] **Profilo** → `/profilo`
- [ ] **Come funziona** → `/come-funziona`
- [ ] **Chi siamo** → `/chi-siamo`

---

## Cosa guardare nel report (oltre al punteggio)

### Performance

| Voce nel report | Cosa indica | Azione |
|----------------|------------|--------|
| **Eliminate render-blocking resources** | Font/CSS/JS che bloccano il primo render | Defer o async |
| **Reduce unused JavaScript** | Chunks non usati nella route corrente | Lazy load |
| **Efficiently encode images** | PNG/JPEG non compressi | Convertire in WebP/AVIF |
| **Serve static assets with efficient cache policy** | Asset senza cache header | Configurare su Vercel/server |
| **Reduce JavaScript execution time** | Bundle troppo pesante | Analisi con rollup-plugin-visualizer |

### PWA

| Voce nel report | Status attuale | Richiede |
|----------------|---------------|----------|
| Installable | ❌ Mancante | `manifest.webmanifest` + icone |
| Service Worker | ❌ Mancante | `vite-plugin-pwa` |
| Offline support | ❌ Mancante | Service Worker + Workbox |
| HTTPS | ✅ (staging/prod) | — |
| Viewport meta | ✅ (presente in index.html) | — |

### Accessibility

Fai attenzione a:
- **Buttons do not have an accessible name** → icone senza `aria-label`
- **Color contrast insufficient** → testo su sfondo scuro
- **Interactive elements have insufficient size** → tap target < 44px

---

## Comandi utili per analisi bundle

```bash
# Installa visualizer (solo se non presente)
pnpm --filter @northstar/web add -D rollup-plugin-visualizer

# Aggiungi temporaneamente in vite.config.ts:
# import { visualizer } from 'rollup-plugin-visualizer';
# plugins: [..., visualizer({ open: true, gzipSize: true })]

# Build e apre automaticamente il report bundle
pnpm --filter @northstar/web build
```

---

## Comandi per leggere i Web Vitals raccolti

```js
// In console DevTools, durante una sessione dell'app:

// Tutti i dati raccolti:
console.table(window.__northstar_vitals)

// Solo metriche per la pagina corrente:
console.table(window.__northstar_vitals.filter(v => v.route === window.location.pathname))

// INP peggiori (> 200ms):
console.table(window.__northstar_vitals.filter(v => v.name === 'INP' && v.value > 200))

// Export come JSON per MOBILE_BASELINE.md:
copy(JSON.stringify(window.__northstar_vitals, null, 2))
```

---

## CI — Lighthouse automatizzato (Fase 4)

Quando sarà il momento (Fase 4), questa checklist manuale verrà integrata
in GitHub Actions con Lighthouse CI. Il file di configurazione sarà in
`.github/workflows/lighthouse.yml` e userà questi threshold:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance":    ["warn", { "minScore": 0.75 }],
        "categories:accessibility":  ["error", { "minScore": 0.90 }],
        "categories:pwa":            ["warn", { "minScore": 0.50 }]
      }
    }
  }
}
```

---

_LIGHTHOUSE_AUDIT_CHECKLIST.md — NorthStar · Phase 0 · Maggio 2026_
