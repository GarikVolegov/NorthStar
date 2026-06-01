# SEO · GEO · SEM — NorthStar

> Ottimizzazione per motori di ricerca tradizionali (SEO), Generative Engine Optimization (GEO) e Search Engine Marketing (SEM).

---

## 📋 Indice

1. [SEO — Search Engine Optimization](#1-seo--search-engine-optimization)
   - [Libreria SEO Core](#11-libreria-seo-core)
   - [Structured Data JSON-LD](#12-structured-data-json-ld)
   - [Open Graph e Twitter Card](#13-open-graph-e-twitter-card)
   - [Pagine Dinamiche (Settori)](#14-pagine-dinamiche-settori)
   - [Sitemap](#15-sitemap)
   - [robots.txt](#16-robotstxt)
   - [Performance e PWA](#17-performance-e-pwa)
   - [Test SEO](#18-test-seo)
2. [GEO — Generative Engine Optimization](#2-geo--generative-engine-optimization)
   - [Structured Data Avanzato](#21-structured-data-avanzato)
   - [Contenuti Conversazionali](#22-contenuti-conversazionali)
   - [Knowledge Graph](#23-knowledge-graph)
   - [i18n e Multilingua](#24-i18n-e-multilingua)
   - [AI Content Readiness](#25-ai-content-readiness)
3. [SEM — Search Engine Marketing](#3-sem--search-engine-marketing)
   - [Stato Attuale](#31-stato-attuale)
   - [Piano di Implementazione](#32-piano-di-implementazione)
4. [Lighthouse CI](#4-lighthouse-ci)
5. [Checklist Pre-Deploy SEO](#5-checklist-pre-deploy-seo)

---

## 1. SEO — Search Engine Optimization

### 1.1 Libreria SEO Core

**File:** `apps/web/src/lib/seo.ts`

Hook principale per la gestione delle meta informazioni su ogni pagina:

```typescript
usePageMeta({
  title:        string;          // Titolo pagina (appeso a " | NorthStar")
  description:  string;          // Meta description
  path?:        string;          // Path relativo (es. /test)
  canonicalPath?: string;        // Canonical override (se diverso dal path)
  type?:        "website" | "article";
  image?:       string;          // OG image URL (default: /opengraph.jpg)
  imageAlt?:    string;          // OG image alt text
  jsonLd?:      object;          // Schema.org JSON-LD aggiuntivo
  noIndex?:     boolean;         // noindex,nofollow (default: false)
})
```

**Cosa imposta automaticamente:**
- `<title>` — con suffisso `| NorthStar`
- `<meta name="description">`
- `<meta name="robots">` — `index, follow` o `noindex, nofollow`
- `<link rel="canonical">` — URL canonico assoluto
- `<meta property="og:title">`, `og:description`, `og:url`, `og:type`, `og:image`, `og:image:alt`, `og:image:width` (1200), `og:image:height` (630), `og:locale`, `og:site_name`
- `<meta name="twitter:card">` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt`
- JSON-LD `<script type="application/ld+json">` (se fornito)

**Regole:**
- Ogni pagina DEVE chiamare `usePageMeta()` con title e description
- Pagine non indicizzabili (admin, profilo, risultati test) DEVONO usare `noIndex: true`
- Pagine di settore DEVONO usare `buildSectorMeta()` per JSON-LD Occupation

### 1.2 Structured Data JSON-LD

#### Statico (index.html)
Presente nell'`index.html` per la homepage:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "url": "https://northstar.app",
      "name": "NorthStar",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://northstar.app/news?q={search_term_string}"
      }
    },
    {
      "@type": "Organization",
      "name": "NorthStar"
    },
    {
      "@type": "SoftwareApplication",
      "name": "NorthStar",
      "applicationCategory": "EducationalApplication",
      "offers": [
        { "@type": "Offer", "price": "0", "name": "Piano Free" },
        { "@type": "Offer", "price": "9.99", "name": "Piano Premium mensile" }
      ]
    }
  ]
}
```

#### Dinamico (pagine settore)
Generato da `buildSectorMeta()` in `lib/seo.ts`:

```json
{
  "@context": "https://schema.org",
  "@type": "Occupation",
  "name": "Ingegneria del Software",
  "description": "...",
  "occupationLocation": { "@type": "Continent", "name": "Europe" },
  "estimatedSalary": {
    "@type": "MonetaryAmountDistribution",
    "currency": "EUR",
    "duration": "P1Y",
    "minValue": 32000,
    "maxValue": 70000
  },
  "skills": "I, R, C"
}
```

#### Pagina Chi Siamo
JSON-LD Organization + SoftwareApplication in `apps/web/src/pages/chi-siamo.tsx:38`.

### 1.3 Open Graph e Twitter Card

**Formato standardizzato in `seo.ts`:**

| Tag | Valore |
|-----|--------|
| `og:type` | `website` o `article` (per settori) |
| `og:locale` | `it_IT` (default), dinamicamente da i18n |
| `og:image` | `https://northstar.app/opengraph.jpg` (default) o `/api/og-image/settore/:id` |
| `og:image:width` | 1200 |
| `og:image:height` | 630 |
| `twitter:card` | `summary_large_image` |

### 1.4 Pagine Dinamiche (Settori)

Ogni settore professionale ha una pagina dedicata con:
- **Title:** `{{name}} — Settore professionale | NorthStar`
- **Description:** Descrizione del settore + stipendio, trend, rischio automazione
- **Canonical:** `/settore/:id`
- **Type:** `article`
- **OG Image:** Endpoint API `/api/og-image/settore/:id`
- **JSON-LD:** Schema.org Occupation con salary range in EUR

### 1.5 Sitemap

#### XML Sitemap
- URL: `https://northstar.app/api/sitemap.xml`
- Generato server-side (endpoint API)
- Include tutte le pagine pubbliche + pagine settore

#### Pagina Sitemap HTML
**File:** `apps/web/src/pages/sitemap.tsx`
- Mappa del sito interattiva
- Raggruppata per sezioni (Principale, Settori, Brand)
- Elenca dinamicamente tutti i 21 settori con link a: settore, wiki, roadmap, grafo
- Badge "Premium" per contenuti premium
- Link al download del XML sitemap

### 1.6 robots.txt

**File:** `apps/web/public/robots.txt`

```
User-agent: *
Allow: /

# Pagine pubbliche indicizzabili
Allow: /test, /news, /settori, /confronta, /premium, /come-funziona
Allow: /chi-siamo, /contatti, /sitemap, /privacy-policy
Allow: /termini-di-servizio, /settore/

# Pagine private — NON indicizzare
Disallow: /api/, /admin/, /risultati/, /profilo, /registra
Disallow: /reset-password, /wiki/, /roadmap/, /grafo/
Disallow: /premium/successo

Sitemap: https://northstar.app/api/sitemap.xml
```

### 1.7 Performance e PWA

La velocità di caricamento è un fattore SEO. Il progetto implementa:

#### Configurazione Vite (`apps/web/vite.config.ts`):
- **Chunk splitting:** vendor-react, vendor-motion, vendor-charts, vendor-radix, vendor-query, vendor-forms, vendor-ui, vendor-i18n
- **CSS code split:** carica solo CSS della pagina attiva
- **Minify:** esbuild (veloce, output compatto)
- **Target:** ES2020
- **Resource hints in index.html:** preload (logo, hero, fonts), preconnect, dns-prefetch

#### PWA (vite-plugin-pwa):
- **Service Worker** con Workbox (auto-update)
- **Caching:** CacheFirst per fonts (1 anno), StaleWhileRevalidate per API sectors/stats, NetworkFirst per dati utente
- **Manifest:** name, description, theme_color, display standalone, icon SVG maskable
- **Include assets:** favicon.svg, hero.png, robots.txt

#### Lighthouse CI (`config/lighthouse/lighthouserc.json`):
- Threshold: Performance 0.70, Accessibility 0.85, Best Practices 0.85, PWA 0.70
- Mobile emulation (Moto G Power)
- Web Vitals targets: FCP < 3s, LCP < 4s, TBT < 600ms, CLS < 0.1

### 1.8 Test SEO

**File:** `apps/web/src/__tests__/seo.test.ts`

Test per `buildSectorMeta()`:
- Type è "article"
- Path canonico corretto
- OG image URL verso API endpoint
- JSON-LD con tipo Occupation
- Salary range in EUR
- Description non vuota
- noIndex non attivo per pagine pubbliche

---

## 2. GEO — Generative Engine Optimization

> GEO (Generative Engine Optimization) ottimizza i contenuti per essere interpretati e citati da motori di ricerca AI-generativi come ChatGPT Search, Google SGE, Perplexity, Bing Copilot.

### 2.1 Structured Data Avanzato

Il JSON-LD Schema.org è il segnale più importante per i generative engine:

| Tipo Schema | Pagina | Impatto GEO |
|---|---|---|
| `WebSite` + `SearchAction` | index.html | Citato come "sito di orientamento" |
| `Organization` | index.html, /chi-siamo | Riconosciuto come entità |
| `SoftwareApplication` | index.html, /chi-siamo | Indicazione prezzi e categoria |
| `Occupation` | /settore/:id | Dati strutturati su salari, skill, trend |

**Best practice GEO attuali:**
- Tutti i JSON-LD hanno `@id` univoci
- `occupationLocation` usa `Continent` per copertura europea
- Salary range con `MonetaryAmountDistribution` e currency EUR
- Skill espressi come stringa RIASEC (machine-readable)

### 2.2 Contenuti Conversazionali

NorthStar genera contenuti AI tramite Wendy che sono naturalmente ottimizzati per AI search:

- **Wendy AI chat** — risposte conversazionali in italiano su carriera, mindset, abitudini
- **Wiki di settore** — contenuti AI approfonditi per ogni settore professionale
- **Guide e roadmap** — piani di crescita generati dinamicamente
- **Articoli crescita** — contenuti editoriali su sviluppo personale

Per massimizzare la citazione da AI search engine:
- I contenuti Wendy usano linguaggio naturale e rispondono a domande specifiche
- Le risposte includono dati e riferimenti (salari, trend, percentuali)
- I contenuti delle wiki sono strutturati con domande/risposte implicite

### 2.3 Knowledge Graph

Il grafo della conoscenza (`/grafo-conoscenza`) collega:
- Settori professionali
- Competenze e skill
- Percorsi di carriera

Questa struttura collegata è ideale per l'AI crawling perché:
- Mostra relazioni semantiche tra entità
- Fornisce contesto ricco e interconnesso
- Può essere citato come "fonte" da AI search engine

### 2.4 i18n e Multilingua

5 lingue supportate (it, en, es, fr, de) con traduzioni complete in `apps/web/src/locales/`:

| Lingua | File | Stato SEO |
|---|---|---|
| Italiano | `it/translation.json` | Primary (default) |
| Inglese | `en/translation.json` | Secondaria |
| Spagnolo | `es/translation.json` | - |
| Francese | `fr/translation.json` | - |
| Tedesco | `de/translation.json` | - |

**Stato hreflang:** Non ancora implementato. I tag `hreflang` devono essere aggiunti per ottimizzare la presenza multilingua su motori di ricerca internazionali.

### 2.5 AI Content Readiness

Il progetto ha contenuti che i generative engine possono indicizzare:

| Contenuto | Formato | AI-friendly |
|---|---|---|
| Settori professionali (21) | Pagine strutturate con JSON-LD Occupation | ✅ Alto |
| Test RIASEC | Pagina interattiva con descrizioni | ✅ Medio |
| News | Articoli con categorie | ✅ Medio |
| Articoli crescita | Contenuto editoriale | ✅ Alto |
| Wiki AI | Contenuto generato AI per settore | ⚠️ Premium |
| Roadmap | Piani di carriera strutturati | ⚠️ Premium |

---

## 3. SEM — Search Engine Marketing

### 3.1 Stato Attuale

**Nessuna integrazione SEM è attualmente implementata.** Non sono presenti:
- Google Tag Manager (GTM)
- Google Ads / AdSense
- Facebook Pixel / Meta Ads
- LinkedIn Insight Tag
- Qualsiasi altro pixel o script di tracciamento pubblicitario

### 3.2 Piano di Implementazione

Quando si implementerà SEM, seguire queste regole:

```typescript
// ✅ Pattern corretto — caricamento differito (non blocca LCP)
useEffect(() => {
  const script = document.createElement("script");
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX";
  script.async = true;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", "G-XXXXXXX");
}, []);

// ❌ PROIBITO — script sincrono in index.html (blocca rendering)
// <script src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>
```

**Regole per l'implementazione SEM futura:**
- Tutti gli script di terze parti DEVONO essere caricati in modo asincrono o differito
- GTM/analytics NON devono bloccare il rendering (LCP)
- I cookie di tracciamento DEVONO rispettare il GDPR (consenso esplicito per utenti EU)
- NO pixel di tracciamento su pagine non pubblicitarie
- Eventi tracciati solo con `dataLayer.push()` standard

---

## 4. Lighthouse CI

**File:** `config/lighthouse/lighthouserc.json`

| Categoria | Threshold | Tipo |
|---|---|---|
| Performance | ≥ 0.70 | warn |
| Accessibility | ≥ 0.85 | error |
| Best Practices | ≥ 0.85 | error |
| PWA | ≥ 0.70 | warn |

| Web Vital | Target | Tipo |
|---|---|---|
| First Contentful Paint | ≤ 3000ms | warn |
| Largest Contentful Paint | ≤ 4000ms | warn |
| Total Blocking Time | ≤ 600ms | warn |
| Cumulative Layout Shift | ≤ 0.1 | error |
| Interactive | ≤ 7500ms | warn |

Eseguito automaticamente nel workflow `mobile-qa.yml` (GitHub Actions).

---

## 5. Checklist Pre-Deploy SEO

```markdown
## Pre-Deploy — SEO Check — [DATA]

### Meta e Structured Data
- [ ] Ogni nuova pagina chiama `usePageMeta()` con title e description
- [ ] Pagine non indicizzabili hanno `noIndex: true`
- [ ] Pagine pubbliche hanno `noIndex: false` (default)
- [ ] Pagine dinamiche (settori) usano `buildSectorMeta()` con JSON-LD Occupation
- [ ] URL canonici sono assoluti e puntano a northstar.app

### Open Graph
- [ ] OG image è definita (default o endpoint dinamico)
- [ ] OG locale corrisponde alla lingua della pagina
- [ ] OG image:width e height sono 1200x630

### robots.txt
- [ ] Nuove pagine pubbliche aggiunte agli Allow
- [ ] Nuove pagine private aggiunte ai Disallow

### Sitemap
- [ ] Nuove pagine sono incluse nel XML sitemap
- [ ] La pagina sitemap HTML riflette la struttura aggiornata

### Performance
- [ ] I nuovi chunk sono splittati correttamente (vendor-*)
- [ ] Asset statici hanno preload/preconnect hints in index.html
- [ ] Il bundle non supera i limiti di chunk size
- [ ] CSS code split funziona per la nuova pagina

### Lighthouse
- [ ] Performance ≥ 0.70 (mobile)
- [ ] Accessibility ≥ 0.85
- [ ] CLS ≤ 0.1

### GEO (se applicabile)
- [ ] JSON-LD presente su pagine con dati strutturati
- [ ] I contenuti AI generati rispondono a domande implicite
- [ ] Le entità (Occupation, Organization) hanno @id univoci
- [ ] hreflang implementato per pagine multilingua (se attivo)

### SEM (se implementato)
- [ ] Script di terze parti caricati async/differiti
- [ ] Consenso GDPR implementato per cookie di tracciamento
- [ ] Eventi standardizzati via dataLayer
```

---

## File Rilevanti

| File | Scopo |
|---|---|
| `apps/web/src/lib/seo.ts` | Libreria SEO core (usePageMeta, buildSectorMeta) |
| `apps/web/src/__tests__/seo.test.ts` | Test SEO |
| `apps/web/index.html` | Meta statici, resource hints, JSON-LD base |
| `apps/web/src/pages/sitemap.tsx` | Pagina sitemap HTML |
| `apps/web/public/robots.txt` | Robots.txt |
| `apps/web/vite.config.ts` | PWA, chunk splitting, build optimization |
| `apps/web/src/locales/*/translation.json` | Traduzioni SEO (seo.* keys) |
| `config/lighthouse/lighthouserc.json` | Lighthouse CI thresholds |
| `.github/workflows/mobile-qa.yml` | Workflow Lighthouse CI |
| `docs/PHASE2_PERFORMANCE_PWA.md` | Documentazione PWA |
| `docs/LIGHTHOUSE_AUDIT_CHECKLIST.md` | Checklist audit Lighthouse |

---

*SEO · GEO · SEM — NorthStar · Maggio 2026*
