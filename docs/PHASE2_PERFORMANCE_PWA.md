# ⚡ Phase 2 — Performance & PWA

> Documento tecnico dei cambiamenti implementati nella Fase 2.
> Stato: **IMPLEMENTATO** — Maggio 2026

---

## File modificati / aggiunti

| File | Tipo | Scopo |
|------|------|-------|
| `apps/web/vite.config.ts` | Aggiornato | PWA plugin, advanced chunks, visualizer, ES2020 target |
| `apps/web/package.json` | Aggiornato | Aggiunto `web-vitals`, `vite-plugin-pwa`, `rollup-plugin-visualizer` |
| `apps/web/public/icons/README.md` | Nuovo | Istruzioni per creare le icone PWA |
| `apps/web/public/screenshots/README.md` | Nuovo | Istruzioni per gli screenshot PWA |

---

## 1. PWA (`vite-plugin-pwa` + Workbox)

### Manifest configurato

Il manifest viene **generato automaticamente** da `vite-plugin-pwa` al build.
Contiene:
- Nome, short_name, descrizione in italiano
- `display: standalone` — l'app appare senza barra del browser
- `theme_color` e `background_color`: `#0e1018` (match dark theme)
- 3 icone (192, 512, 512 maskable)
- 2 screenshot per la scheda di installazione Android
- 2 `shortcuts` (Test, Dashboard) — accessibili tenendo premuta l'icona

### Strategia di caching Workbox

| Risorsa | Strategia | Cache TTL |
|---------|-----------|----------|
| Asset statici (JS/CSS/HTML) | Precache | Indefinito (hash-based) |
| `/api/*` | NetworkFirst (timeout 5s) | 24 ore |
| Font Google | StaleWhileRevalidate | 1 anno |
| Immagini esterne | CacheFirst | 30 giorni |

**NetworkFirst per le API**: prova sempre la rete prima.
Se la rete non risponde entro 5 secondi, serve dalla cache.
Questo garantisce dati freschi ma degrada bene offline.

### Come testare la PWA

```bash
# Build + preview (il SW non gira in dev)
pnpm --filter @northstar/web build
pnpm --filter @northstar/web preview
# → http://localhost:5173

# Poi in Chrome: DevTools → Application → Service Workers
# Verifica: Status = "running", no errori
# DevTools → Application → Manifest → nessun warning
# Lighthouse → PWA: dovrebbe essere verde
```

### Installazione su device reale

1. Apri l'app su Chrome mobile (Android) o Safari (iOS 16.4+)
2. Android: banner "Aggiungi a schermata Home" appare automaticamente
3. iOS: Share → "Aggiungi a schermata Home"
4. L'app si apre in modalità standalone (senza barra browser)

---

## 2. Bundle Analysis

### Comando

```bash
pnpm --filter @northstar/web analyze
# Apre automaticamente dist/bundle-report.html nel browser
```

### Cosa guardare nel report

- **vendor-charts** (Recharts + D3): spesso il chunk più grosso.
  Se supera 300kB gz, valuta lazy-load dei grafici.
- **vendor-motion** (framer-motion): ~100kB gz.
  Accettabile. Se vuoi ridurlo, usa solo `motion.div` senza AnimatePresence
  sulle pagine meno importanti.
- **vendor-react**: dovrebbe essere stabile ~45kB gz.
- Chunk app > 200kB: candidati per ulteriore code-splitting.

### Chunks configurati

| Chunk | Contenuto | Note |
|-------|-----------|------|
| `vendor-react` | react, react-dom, scheduler | Cache lunghissima, non cambia |
| `vendor-router` | wouter | Piccolo, ~5kB |
| `vendor-motion` | framer-motion | ~100kB gz, scaricato una volta |
| `vendor-charts` | recharts, d3 | Pesante, solo su pagine con grafici |
| `vendor-radix` | @radix-ui/* | Accessibilità primitives |
| `vendor-query` | @tanstack/react-query | Data fetching |
| `vendor-icons` | lucide-react | Tree-shakeable ma spesso importato in blocco |
| `vendor-zod` | zod | Validazione schema |
| `vendor-misc` | altri node_modules | Tutto il resto |

---

## 3. Lazy Loading (già presente + consigli)

Il `App.tsx` di `apps/web` usa già `React.lazy` su tutte le pagine.
Per massimizzare il guadagno:

### Componenti da lazy-loadare se non lo sono già

```tsx
// Grafici (Recharts) — importa solo quando la pagina viene aperta
const LazyChart = lazy(() => import('@/components/features/MyChart'));

// Editor complessi, form multi-step
const LazyEditor = lazy(() => import('@/components/features/RoadmapEditor'));

// Sezioni "below the fold" della home page
const LazyHowItWorks = lazy(() => import('@/components/features/HowItWorks'));
```

### Preload su hover (anticipare il click)

```tsx
// In DrawerNavLink o DesktopNavLink: precarica il chunk al hover
const handleMouseEnter = () => {
  import('@/pages/dashboard'); // Pre-fetch silenzioso
};

<Link href="/dashboard" onMouseEnter={handleMouseEnter}>...</Link>
```

---

## 4. React Query — cache ottimale

Configura `queryClient` con staleTime e gcTime ragionevoli per ridurre
le richieste duplicate:

```ts
// apps/web/src/lib/queryClient.ts (o dove è definito)
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   60 * 1000,      // 1 min: non re-fetch se dati freschi
      gcTime:      5 * 60 * 1000,  // 5 min: mantieni in memoria
      retry:       1,              // 1 retry su errore rete
      refetchOnWindowFocus: false, // Evita re-fetch su alt+tab
    },
  },
});
```

---

## 5. Checklist Phase 2

### PWA
- [ ] Creare `apps/web/public/icons/icon-192.png` (192×192)
- [ ] Creare `apps/web/public/icons/icon-512.png` (512×512)
- [ ] Creare `apps/web/public/icons/icon-512-maskable.png` (512×512 maskable)
- [ ] Catturare `apps/web/public/screenshots/mobile-home.png` (390×844)
- [ ] Eseguire `pnpm build` + `pnpm preview`
- [ ] Verificare Lighthouse PWA ≥ 80
- [ ] Testare installazione su Android reale

### Performance
- [ ] Eseguire `pnpm analyze` e documentare i chunk più grossi
- [ ] Verificare che nessun chunk superi 500kB (warning in build)
- [ ] Aggiornare `MOBILE_BASELINE.md` con i nuovi score Lighthouse
- [ ] Verificare Web Vitals dopo build: LCP < 2500ms, INP < 200ms

### React Query
- [ ] Aggiornare `queryClient.ts` con `staleTime` e `gcTime` configurati
- [ ] Verificare che non ci siano chiamate duplicate in DevTools → Network

---

_PHASE2_PERFORMANCE_PWA.md — NorthStar · Phase 2 · Maggio 2026_
