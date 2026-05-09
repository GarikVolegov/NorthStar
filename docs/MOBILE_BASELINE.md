# 📱 Mobile Baseline — Phase 0

> **Istruzioni**: compila questa tabella PRIMA di iniziare qualsiasi ottimizzazione mobile.
> Questo documento è il punto di riferimento per misurare i miglioramenti delle Fasi 1–4.
> Aggiorna la colonna "Dopo" al termine di ogni fase.

---

## Come eseguire la baseline

### 1. Avvia l'app in development

```bash
cd NorthStar
pnpm install
pnpm --filter @northstar/web dev
# → http://localhost:5173
```

### 2. Configura Chrome DevTools per mobile

1. Apri `http://localhost:5173` in Chrome.
2. `F12` → **Toggle Device Toolbar** (icona telefono).
3. Seleziona device: **Pixel 5** o **iPhone 12**.
4. Rete: **Slow 3G** per il test pessimistico, **Fast 3G** per quello realistico.

### 3. Leggi i Web Vitals dalla console

Nell'app, apri la console DevTools e filtra per **[WebVitals]**.
Ripeti ogni navigazione 2–3 volte e annota i valori.

Per leggere tutti i dati accumulati in sessione:

```js
// Incolla in console DevTools:
JSON.stringify(window.__northstar_vitals, null, 2)
```

### 4. Esegui Lighthouse in modalità Mobile

1. DevTools → tab **Lighthouse**.
2. Mode: **Navigation**, Device: **Mobile**.
3. Categorie: Performance, Accessibility, Best Practices, PWA.
4. Clicca **Analyze page load**.
5. Ripeti su ogni pagina nella tabella sottostante.

---

## 📊 Tabella Lighthouse Score

Compila per ogni pagina critica. Esegui l'audit 2 volte per pagina e prendi la media.

| Pagina | Route | Perf | A11y | Best Practices | PWA | Data audit |
|--------|-------|------|------|----------------|-----|------------|
| Home / Landing | `/` | — | — | — | — | |
| Test RIASEC | `/test` | — | — | — | — | |
| Risultati | `/risultati` | — | — | — | — | |
| Dashboard | `/dashboard` | — | — | — | — | |
| Settori | `/settori` | — | — | — | — | |
| Percorso | `/percorso` | — | — | — | — | |
| Wiki AI | `/wiki` | — | — | — | — | |
| News | `/news` | — | — | — | — | |
| Grafo | `/mappa` | — | — | — | — | |
| Profilo | `/profilo` | — | — | — | — | |
| Login | `/login` | — | — | — | — | |

---

## 📐 Tabella Web Vitals (console)

Annota i valori letti da console filtrando per `[WebVitals]`.

| Metrica | Target (Good) | `/` | `/test` | `/dashboard` | Note |
|---------|--------------|-----|---------|--------------|------|
| LCP | < 2500ms | — | — | — | |
| FID | < 100ms | — | — | — | |
| INP | < 200ms | — | — | — | |
| CLS | < 0.1 | — | — | — | |
| FCP | < 1800ms | — | — | — | |
| TTFB | < 800ms | — | — | — | |

---

## 👆 Tabella Test Manuale Touch & UX

Esegui su device reale (o Pixel 5 simulato, rete Fast 3G) ogni flusso utente chiave.
Valuta ogni area da 1 (pessimo) a 5 (ottimo).

| Area | Flusso testato | Score (1–5) | Problema riscontrato | Priorità |
|------|---------------|-------------|----------------------|----------|
| Primo render | Apertura home | — | | |
| Tap target | Bottoni CTA home | — | | |
| Navigazione mobile | Menu / BottomNav | — | | |
| Onboarding / Test RIASEC | Compilazione test | — | | |
| Loading states | Navigazione dashboard | — | | |
| Flash visivi | Switch tra pagine | — | | |
| Scroll | News feed / settori | — | | |
| Auth flow | Login → redirect | — | | |
| Streaming AI | Wiki / Coach | — | | |
| Offline | Aprire app senza rete | — | | |

---

## 🐛 Issue identificate

Usa questa sezione per annotare i problemi trovati durante la baseline.
Ogni issue andrà poi trasformata in un task per le Fasi 1–4.

### Touch & UI
- [ ] _(da compilare dopo il test manuale)_

### Performance & Loading
- [ ] _(da compilare dopo Lighthouse + Web Vitals)_

### PWA & Installabilità
- [ ] Nessun `manifest.webmanifest` configurato → PWA score = 0
- [ ] Nessun Service Worker → offline non supportato
- [ ] _(aggiungere altri problemi)_

### Accessibilità
- [ ] _(da compilare dopo Lighthouse A11y score)_

---

## 🎯 Obiettivi post-ottimizzazione

Definisci i target PRIMA di iniziare le fasi di sviluppo.

| Metrica | Baseline | Target Fase 1 | Target Fase 3 (PWA) |
|---------|----------|---------------|---------------------|
| Lighthouse Performance (mobile) | — | ≥ 75 | ≥ 85 |
| Lighthouse PWA | — | — | ≥ 90 |
| Lighthouse Accessibility | — | ≥ 90 | ≥ 95 |
| LCP | — | < 2500ms | < 2000ms |
| INP | — | < 200ms | < 200ms |
| CLS | — | < 0.1 | < 0.05 |

---

## 📋 Checklist Phase 0 completata

- [ ] Web Vitals logging attivo e visibile in console
- [ ] Lighthouse audit eseguito su tutte le pagine critiche
- [ ] Tabella Lighthouse compilata con dati reali
- [ ] Tabella Web Vitals compilata
- [ ] Test manuale touch completato
- [ ] Issue identificate e documentate
- [ ] Target post-ottimizzazione definiti
- [ ] Questo file committato su `main` con i dati baseline

---

_MOBILE_BASELINE.md — NorthStar · Phase 0 · Maggio 2026_
_Aggiorna dopo ogni fase di ottimizzazione._
