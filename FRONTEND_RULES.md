# ⚡ FRONTEND_RULES.md — Frontend Engineering Policy

## NorthStar / Orientamento SaaS

**Stack: React 19 · Vite · Tailwind CSS v4 · TanStack Query · Wouter · Radix UI**

> ⚠️ **LEGGI QUESTO FILE INTEGRALMENTE** prima di aggiungere un componente, una pagina, un hook o un pattern UI. Queste regole esistono per garantire: **zero lag, zero flash, zero bug visivi, codice mantenibile.** Non esistono eccezioni stilistiche. La coerenza è una feature.

---

## 📋 INDICE

1. [Principi Fondamentali](#1-principi-fondamentali)
2. [Architettura Componenti](#2-architettura-componenti)
3. [Regole di Performance](#3-regole-di-performance)
4. [Pattern SSE Streaming AI](#4-pattern-sse-streaming-ai)
5. [Regole Tailwind CSS v4](#5-regole-tailwind-css-v4)
6. [Regole React Query](#6-regole-react-query)
7. [Regole Grafo SVG](#7-regole-grafo-svg)
8. [Regole Auth e Route Protette](#8-regole-auth-e-route-protette)
9. [Regole Gestione Stato](#9-regole-gestione-stato)
10. [Regole Recharts](#10-regole-recharts)
11. [Regole Accessibilità e UX Base](#11-regole-accessibilit%C3%A0-e-ux-base)
12. [Regole TypeScript](#12-regole-typescript)
13. [Struttura File e Naming](#13-struttura-file-e-naming)
14. [Operazioni Proibite](#14-operazioni-proibite)
15. [Checklist Pre-Commit](#15-checklist-pre-commit)
16. [Pattern di Riferimento](#16-pattern-di-riferimento)

---

## 1. PRINCIPI FONDAMENTALI

### Il Manifesto del Frontend Sano

1. **Il lag è un bug, non un'opinione estetica.**
   Se qualcosa sembra lento, lo è. Si misura, si fixa.

2. **Ogni re-render non necessario è un debito tecnico.**
   React renderizza veloce, ma non è gratis. Ogni setState ha un costo.

3. **L'utente non vede il tuo codice, vede il risultato.**
   Una feature implementata male è peggio di una feature non implementata.

4. **La coerenza batte la creatività locale.**
   Usare il pattern sbagliato "solo per questa pagina" inquina il codebase.

5. **Se stai copiando codice, stai creando un problema futuro.**
   Estrai in hook o componente condiviso.

### La Regola dei 3 Secondi

Prima di aggiungere qualsiasi codice UI chiediti:

- ✅ Questo componente causa re-render inutili nel padre?
- ✅ Questo fetch viene deduplicato da React Query?
- ✅ Questo effetto visivo funziona su mobile con GPU debole?

→ Se anche solo UNA risposta è "non lo so": **leggi la sezione pertinente.**

---

## 2. ARCHITETTURA COMPONENTI

### 2.1 Gerarchia Obbligatoria

```
artifacts/orientamento/src/
├── pages/          ← Una per route. Solo orchestrazione, zero logica business.
├── components/
│   ├── ui/         ← Primitivi puri: Button, Input, Badge, Card, Spinner
│   │               Nessuno stato interno oltre hover/focus
│   │               Nessuna chiamata API
│   ├── features/   ← Componenti con logica: AgentSection, SectorCard, RoadmapPath
│   │               Possono avere useState locale
│   │               Possono usare hook custom
│   └── layout/     ← Navbar, Sidebar, PageLayout, ProtectedRoute
├── hooks/          ← Tutta la logica riusabile: useSSEStream, useAgentAnalysis...
├── lib/            ← Utility pure: formatDate, cn(), calcMatchScore
└── stores/         ← Stato globale (se necessario, solo con Zustand o Context)
```

### 2.2 Regola della Responsabilità Singola

```typescript
// ❌ SBAGLIATO — pagina che fa tutto
function RoadmapPage() {
  const [paths, setPaths] = useState([]);
  const [selected, setSelected] = useState(null);
  const [streaming, setStreaming] = useState('');
  // 200 righe di logica, fetch, UI...
}

// ✅ CORRETTO — pagina che orchestra
function RoadmapPage() {
  return (
    <PageLayout>
      <RoadmapHeader sectorId={sectorId} />
      <RoadmapPathSelector onSelect={setSelected} />
      <RoadmapPathDetail pathId={selected} />
    </PageLayout>
  );
}

// La logica di fetch sta in useRoadmap()
// La logica di streaming sta in useSSEStream()
// L'UI della singola fase sta in RoadmapPhaseCard
```

### 2.3 Quando Creare un Nuovo Componente

**Crea un componente se:**
- ✅ La stessa struttura JSX appare 2+ volte
- ✅ Un blocco di JSX supera 50 righe
- ✅ Un componente ha più di 3 `useState` indipendenti
- ✅ La logica è riusabile in pagine diverse

**NON creare un componente se:**
- ❌ È un wrapper di un singolo elemento con una className
- ❌ Esiste già in Radix UI o Lucide
- ❌ Verrà usato solo in un posto e non supera 20 righe

### 2.4 Props Typing Obbligatorio

```typescript
// ✅ SEMPRE tipare le props esplicitamente — mai usare any o oggetti non tipati
interface SectorCardProps {
  sector: Sector;                          // tipo dal DB schema
  matchScore: number;
  isSelected?: boolean;                    // opzionale con ?
  onSelect: (sectorId: number) => void;   // callback tipata
  className?: string;                      // sempre accettare className per composability
}

function SectorCard({ sector, matchScore, isSelected = false, onSelect, className }: SectorCardProps) {
  // ...
}

// ❌ MAI fare questo:
function SectorCard(props: any) { ... }
function SectorCard({ sector, ...rest }: { sector: any, [key: string]: any }) { ... }
```

---

## 3. REGOLE DI PERFORMANCE

### 3.1 Code Splitting — Obbligatorio per Tutte le Pagine

```typescript
// App.tsx — TUTTE le pagine devono essere lazy
// ❌ PROIBITO per pagine non-critiche:
import GrafoConoscenza from './pages/grafo-conoscenza';

// ✅ OBBLIGATORIO:
import { lazy, Suspense } from 'react';
const GrafoConoscenza = lazy(() => import('./pages/grafo-conoscenza'));
const Roadmap         = lazy(() => import('./pages/roadmap'));
const WikiAI          = lazy(() => import('./pages/wiki'));
const AdminReview     = lazy(() => import('./pages/admin-review'));
const Dashboard       = lazy(() => import('./pages/dashboard'));
const GrafoSettore    = lazy(() => import('./pages/grafo'));
const News            = lazy(() => import('./pages/news'));

// Unico PageLoader centralizzato — non creare spinner locali per il lazy loading
function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

// Ogni Route wrappata:
<Suspense fallback={<PageLoader />}>
  <Route path="/grafo" component={GrafoConoscenza} />
</Suspense>
```

**Eccezioni al lazy loading** (import statico consentito):
- `Landing`, `Login`, `Register` — sono la prima cosa che vede l'utente
- `NotFound` — file piccolo
- Componenti `layout/` — sempre presenti

### 3.2 Memoizzazione — Quando Usarla e Quando No

```typescript
// ✅ USA React.memo se:
// - Il componente è costoso da renderizzare (chart, SVG complesso, liste lunghe)
// - Il componente padre si aggiorna spesso per ragioni non correlate
// - Le props cambiano raramente

const SectorChart = memo(({ data, color }: ChartProps) => {
  // ... Recharts component
}, (prev, next) => {
  return prev.color === next.color && prev.data.length === next.data.length;
});

const GraphNode = memo(({ node, isSelected }: NodeProps) => {
  // ... SVG element
}, (prev, next) =>
  prev.node.x === next.node.x &&
  prev.node.y === next.node.y &&
  prev.isSelected === next.isSelected
);

// ✅ USA useMemo se:
// - Calcolo costoso (es: filtro/sort di array lungo, calcolo match score)
// - Il risultato viene passato come prop a un componente memoizzato
const filteredNodes = useMemo(() =>
  nodes.filter(n => n.type === activeFilter),
  [nodes, activeFilter]
);

// ✅ USA useCallback se:
// - La funzione viene passata come prop a un componente memoizzato
// - La funzione è usata come dipendenza di useEffect/useMemo
const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
  // ...
}, [/* dipendenze stabili */]);

// ❌ NON usare memo/useMemo/useCallback per:
// - Componenti semplici che renderizzano pochi elementi
// - Calcoli O(1) o array < 10 elementi
// - Funzioni che vengono comunque ricreate perché le loro dipendenze cambiano sempre
```

### 3.3 Regole sugli Effetti Visivi Costosi

```css
/* AUDIT OBBLIGATORIO: grep -r "backdrop-blur" src/ prima di ogni deploy */

/* ❌ PROIBITO su elementi che appaiono in lista (card multiple) */
.news-card {
  backdrop-filter: blur(20px) saturate(1.8); /* troppo costoso × N card */
}

/* ✅ CONSENTITO con valori ridotti */
.glass-panel {
  backdrop-filter: blur(8px);
  /* MAI superiore a blur(12px) su elementi non-unici */
}

/* ✅ OBBLIGATORIO su mobile: disabilitare backdrop-filter */
@media (max-width: 768px) {
  .glass-panel {
    backdrop-filter: none;
    background: rgba(10, 10, 20, 0.88);
  }
}

/* ✅ will-change SOLO su elementi che stanno per animarsi */
.animating-element {
  will-change: transform;
}

/* ✅ contain per isolare il reflow di sezioni indipendenti */
.stats-section,
.chart-container {
  contain: layout paint;
}

/* ✅ Usare sempre transform invece di left/top */
.moving-element {
  transform: translateX(var(--x)) translateY(var(--y)); /* GPU */
  /* NON: left: var(--x); top: var(--y); ← CPU, causa reflow */
}
```

### 3.4 Regola dei Virtual List

```typescript
// Quando la lista supera 50 elementi, usare virtualizzazione
import { FixedSizeList } from 'react-window';

// ✅ OBBLIGATORIO per:
// - Lista nodi nel pannello laterale del grafo (può crescere illimitatamente)
// - Lista professioni nei risultati agente (6 in premium, ma può espandersi)
// - Audit log admin (può avere migliaia di righe)
// - Feed notizie con paginazione infinita

// ❌ NON necessario per:
// - Lista settori (max 20)
// - Tab categorie news (< 10)
// - Steps della roadmap (< 10)
```

---

## 4. PATTERN SSE STREAMING AI

### 4.1 Hook Obbligatorio — useSSEStream

> **Questo hook è l'UNICO modo autorizzato per gestire lo streaming SSE nel progetto. Non implementare logica SSE inline nelle pagine.**

```typescript
// hooks/useSSEStream.ts — implementazione canonica
import { useState, useRef, useCallback, useTransition } from 'react';

interface UseSSEStreamOptions {
  onComplete?: (finalContent: string) => void;
  onError?: (error: Error) => void;
  flushIntervalMs?: number; // default 50ms
}

interface UseSSEStreamReturn {
  content: string;
  isStreaming: boolean;
  isPending: boolean;
  error: Error | null;
  start: (url: string, body?: object) => void;
  stop: () => void;
  reset: () => void;
}

export function useSSEStream(options: UseSSEStreamOptions = {}): UseSSEStreamReturn {
  const { onComplete, onError, flushIntervalMs = 50 } = options;

  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  const bufferRef      = useRef('');
  const controllerRef  = useRef<AbortController | null>(null);
  const flushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const snapshot = bufferRef.current;
      startTransition(() => setContent(snapshot));
    }, flushIntervalMs);
  }, [flushIntervalMs]);

  const start = useCallback(async (url: string, body?: object) => {
    bufferRef.current = '';
    setContent('');
    setError(null);
    setIsStreaming(true);
    controllerRef.current = new AbortController();

    try {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta  = parsed.choices?.[0]?.delta?.content ?? parsed.delta ?? '';
            bufferRef.current += delta;
            flushBuffer();
          } catch {
            // Chunk non-JSON (es: heartbeat) — ignorare silenziosamente
          }
        }
      }

      startTransition(() => setContent(bufferRef.current));
      onComplete?.(bufferRef.current);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsStreaming(false);
    }
  }, [flushBuffer, onComplete, onError]);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    bufferRef.current = '';
    startTransition(() => setContent(''));
    setError(null);
  }, [stop]);

  return { content, isStreaming, isPending, error, start, stop, reset };
}
```

### 4.2 Utilizzo nelle Pagine

```typescript
function WikiPage({ sectorId }: { sectorId: string }) {
  const { content, isStreaming, error, start, reset } = useSSEStream({
    onComplete: (text) => console.log('[wiki] streaming complete, length:', text.length),
    onError: (err) => toast.error('Errore durante la generazione'),
  });

  const handleAsk = useCallback((question: string) => {
    reset();
    start(`/api/wiki/${sectorId}/ask`, { message: question });
  }, [sectorId, start, reset]);

  return (
    <div>
      <StreamingContent content={content} isStreaming={isStreaming} />
      {error && <ErrorBanner message={error.message} />}
      <ChatInput onSubmit={handleAsk} disabled={isStreaming} />
    </div>
  );
}
```

### 4.3 Componente StreamingContent — Centralizzato

```typescript
// components/features/StreamingContent.tsx
// Unico componente per visualizzare testo in streaming
// NON creare varianti locali in ogni pagina

interface StreamingContentProps {
  content: string;
  isStreaming: boolean;
  className?: string;
}

export function StreamingContent({ content, isStreaming, className }: StreamingContentProps) {
  return (
    <div className={cn('prose prose-invert max-w-none', className)}>
      <MarkdownRenderer content={content} />
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-indigo-400 ml-0.5" />
      )}
    </div>
  );
}
```

---

## 5. REGOLE TAILWIND CSS V4

### 5.1 Classi Dinamiche — Regola Fondamentale

```typescript
// ❌ PROIBITO — classi interpolate non rilevate dal purger
const color = 'indigo';
<div className={`bg-${color}-500 text-${color}-100`} />

// ✅ OBBLIGATORIO — usare cva con classi complete
import { cva, type VariantProps } from 'class-variance-authority';

const badge = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      color: {
        indigo:  'bg-indigo-900/60 text-indigo-200 border border-indigo-700',
        emerald: 'bg-emerald-900/60 text-emerald-200 border border-emerald-700',
        violet:  'bg-violet-900/60 text-violet-200 border border-violet-700',
        amber:   'bg-amber-900/60 text-amber-200 border border-amber-700',
        rose:    'bg-rose-900/60 text-rose-200 border border-rose-700',
        slate:   'bg-slate-800/60 text-slate-300 border border-slate-600',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: { color: 'indigo', size: 'md' },
  }
);
```

### 5.2 Utility cn() — Obbligatoria per Classi Condizionali

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ✅ Usare cn() per tutte le classi condizionali
<div className={cn(
  'rounded-xl border p-4 transition-all',
  isSelected && 'border-indigo-500 bg-indigo-900/20',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className
)} />

// ❌ NON usare template literals per condizionali
<div className={`rounded-xl ${isSelected ? 'border-indigo-500' : 'border-slate-700'}`} />
```

### 5.3 Colori — Palette Ufficiale NorthStar

Usare SOLO questi colori per elementi semantici. Non inventare nuovi colori.

```
Primario:    indigo-500 / indigo-600    (#6366f1 / #4f46e5)
Secondario:  violet-500 / violet-600    (#8b5cf6 / #7c3aed)
Successo:    emerald-500 / emerald-600  (#10b981 / #059669)
Warning:     amber-500 / amber-600      (#f59e0b / #d97706)
Errore:      rose-500 / rose-600        (#f43f5e / #e11d48)
Neutro:      slate-700 / slate-800      (#334155 / #1e293b)
Background:  slate-950 / zinc-950       (#020617 / #09090b)
Testo:       slate-100 / slate-300      (#f1f5f9 / #cbd5e1)

RIASEC Colors (standardizzati):
  R (Realistico):      amber-500
  I (Investigativo):   indigo-500
  A (Artistico):       violet-500
  S (Sociale):         emerald-500
  E (Imprenditoriale): rose-500
  C (Convenzionale):   slate-400

Spirits Colors:
  Shen: yellow-400
  Hun:  blue-400
  Po:   orange-400
  Yi:   cyan-400
  Zhi:  red-400
```

### 5.4 Animazioni — Regole

```css
/* ✅ CONSENTITE — CSS-only, GPU-accelerated */
animate-spin             /* spinner */
animate-pulse            /* skeleton, cursor streaming */
animate-bounce           /* feedback discreto */
transition-all duration-200    /* hover states */
transition-colors duration-150 /* cambio colore */

/* ❌ PROIBITE su elementi in lista */
/* Causa layout thrashing durante lo scroll */

/* ❌ PROIBITE senza will-change */
/* Animare top/left/width/height causa reflow */
```

---

## 6. REGOLE REACT QUERY

### 6.1 Configurazione Globale Obbligatoria

```typescript
// main.tsx — configurazione QueryClient centralizzata
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            2 * 60 * 1000,  // 2 minuti default
      gcTime:               10 * 60 * 1000, // 10 minuti in cache
      retry:                2,
      refetchOnWindowFocus: false,           // ❌ MAI refetch al focus
      refetchOnReconnect:   true,
    },
    mutations: {
      retry: 0, // le mutations non si riprovano automaticamente
    },
  },
});
```

### 6.2 Naming Convention per queryKey

```typescript
// ✅ CORRETTO — array gerarchico
['sectors']                          // lista settori
['sectors', sectorId]                // settore singolo
['sectors', sectorId, 'stats']       // stats di un settore
['users', userId]                    // profilo utente
['test-sessions', sessionId]         // sessione test
['agent-analysis', sessionId]        // analisi agente
['news', category]                   // news per categoria
['knowledge-graph', userId]          // grafo personale
['knowledge-nodes', nodeId]          // nodo specifico

// ❌ SBAGLIATO — stringhe piatte, non invalidabili parzialmente
['getSectorData']
['userProfile123']
```

### 6.3 staleTime per Tipo di Dato

```typescript
// Dati quasi statici
useQuery({ queryKey: ['sectors'],           staleTime: 30 * 60 * 1000 }) // 30 min
useQuery({ queryKey: ['education-paths'],   staleTime: 60 * 60 * 1000 }) // 1h

// Dati utente
useQuery({ queryKey: ['users', userId],     staleTime: 5 * 60 * 1000  }) // 5 min
useQuery({ queryKey: ['user-objectives'],   staleTime: 2 * 60 * 1000  }) // 2 min

// Dati AI costosi da generare
useQuery({ queryKey: ['agent-analysis', id], staleTime: 10 * 60 * 1000 }) // 10 min
useQuery({ queryKey: ['knowledge-graph', uid], staleTime: 3 * 60 * 1000 }) // 3 min

// Dati real-time
useQuery({ queryKey: ['news', cat],         staleTime: 5 * 60 * 1000  }) // 5 min
useQuery({ queryKey: ['stripe', 'subscription', uid], staleTime: 60 * 1000 }) // 1 min
```

### 6.4 Evitare Flash di Loading

```typescript
// ✅ SEMPRE usare placeholderData per switch tra dati correlati
const { data } = useQuery({
  queryKey: ['news', category],
  queryFn: () => fetchNews(category),
  staleTime: 5 * 60 * 1000,
  placeholderData: keepPreviousData,
});

// ✅ Prefetch proattivo al hover
queryClient.prefetchQuery({
  queryKey: ['sectors', sector.id],
  queryFn: () => fetchSector(sector.id),
  staleTime: 30 * 60 * 1000,
});
```

### 6.5 Invalidazione Mutations — Regola dell'Albero

```typescript
// ✅ CORRETTO — invalida solo ciò che è cambiato
const updateObjective = useMutation({
  mutationFn: (data) => patchObjective(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['user-objectives'] });
  },
});

// ✅ Per mutations ottimistiche
const toggleFavorite = useMutation({
  mutationFn: (sectorId) => toggleFavoriteSector(sectorId),
  onMutate: async (sectorId) => {
    await queryClient.cancelQueries({ queryKey: ['user-favorites'] });
    const previous = queryClient.getQueryData(['user-favorites']);
    queryClient.setQueryData(['user-favorites'], (old) => /* aggiorna ottimisticamente */);
    return { previous };
  },
  onError: (err, variables, context) => {
    queryClient.setQueryData(['user-favorites'], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['user-favorites'] });
  },
});
```

---

## 7. REGOLE GRAFO SVG

### 7.1 Separazione Drag State — Regola Critica

```typescript
// PROBLEMA: usare setState durante mousemove causa re-render ad ogni pixel
// SOLUZIONE: useRef per stato temporaneo, setState solo al mouseup

const dragRef = useRef<{
  nodeId: string;
  startMouseX: number;
  startMouseY: number;
  startNodeX: number;
  startNodeY: number;
} | null>(null);

// Durante il drag: aggiornare il DOM direttamente — zero re-render React
const handleMouseMove = useCallback((e: MouseEvent) => {
  if (!dragRef.current) return;
  const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = dragRef.current;
  const newX = startNodeX + (e.clientX - startMouseX);
  const newY = startNodeY + (e.clientY - startMouseY);
  const el = document.querySelector(`[data-node-id="${nodeId}"]`) as SVGGElement;
  if (el) el.setAttribute('transform', `translate(${newX}, ${newY})`);
}, []);

// Solo al mouseup: committare stato React + salvare
const handleMouseUp = useCallback((e: MouseEvent) => {
  if (!dragRef.current) return;
  const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = dragRef.current;
  const newX = startNodeX + (e.clientX - startMouseX);
  const newY = startNodeY + (e.clientY - startMouseY);
  setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: newX, y: newY } : n));
  debouncedSavePositions();
  dragRef.current = null;
}, [debouncedSavePositions]);
```

### 7.2 Memoizzazione dei Nodi SVG

```typescript
const GraphNode = memo(({ node, isSelected, isLinkMode, onMouseDown, onContextMenu }: GraphNodeProps) => {
  return (
    <g
      data-node-id={node.id}
      transform={`translate(${node.x}, ${node.y})`}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onContextMenu={(e) => onContextMenu(e, node.id)}
      style={{ cursor: isLinkMode ? 'crosshair' : 'grab' }}
    >
      <circle
        r={28}
        className={cn(
          'transition-colors duration-150',
          isSelected ? 'fill-indigo-500 stroke-indigo-300' : 'fill-slate-700 stroke-slate-500',
          isLinkMode && 'hover:fill-violet-600'
        )}
        strokeWidth={2}
      />
      <text
        textAnchor="middle"
        dy={4}
        className="fill-white text-[11px] pointer-events-none select-none"
      >
        {node.title.length > 14 ? node.title.slice(0, 13) + '…' : node.title}
      </text>
    </g>
  );
}, (prev, next) =>
  prev.node.x     === next.node.x     &&
  prev.node.y     === next.node.y     &&
  prev.node.title === next.node.title &&
  prev.isSelected === next.isSelected &&
  prev.isLinkMode === next.isLinkMode
);
```

### 7.3 Soglia per Migrazione a Canvas

Se il grafo raggiunge uno di questi valori, migrare a `react-force-graph-2d` (Canvas WebGL):

```
├─ > 50 nodi totali dell'utente
├─ > 100 edges totali
└─ FPS < 45 durante drag misurato con Chrome DevTools
```

```bash
pnpm --filter @workspace/orientamento add react-force-graph-2d
```

---

## 8. REGOLE AUTH E ROUTE PROTETTE

### 8.1 ProtectedRoute — Pattern Unico

```typescript
// components/layout/ProtectedRoute.tsx
export function ProtectedRoute({ component: Component, requirePremium = false }: ProtectedRouteProps) {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (requirePremium && !user.stripeSubscriptionId) {
    return <Redirect to="/premium" />;
  }

  return <Component />;
}

// Utilizzo in App.tsx:
<Route path="/wiki/:sectorId">
  <Suspense fallback={<PageLoader />}>
    <ProtectedRoute component={WikiAI} requirePremium />
  </Suspense>
</Route>
```

### 8.2 useAuth — Regole di Utilizzo

```typescript
// ✅ CORRETTO
function Header() {
  const { user, authReady } = useAuth();
  if (!authReady) return <HeaderSkeleton />;
  return <span>{user?.email ?? 'Accedi'}</span>;
}

// ❌ PROIBITO — non usare user?.xxx senza controllare authReady
// Causa flash di stato vuoto mentre il JWT viene validato
function Header() {
  const { user } = useAuth();
  return <span>{user?.email ?? 'Caricamento...'}</span>; // ← flash visibile
}
```

### 8.3 Gestione Token JWT

```typescript
// ❌ PROIBITO nei componenti
const token = localStorage.getItem('jwt_token');

// ✅ Il token viene gestito solo in:
// - AuthContext (lettura/scrittura)
// - api-fetch.ts (allegato automaticamente alle richieste)
// - auth-jwt.ts (backend)

import { apiFetch } from '@/lib/api-fetch';
const data = await apiFetch('/api/user-objectives'); // token allegato automaticamente
```

---

## 9. REGOLE GESTIONE STATO

### 9.1 Decision Tree — Dove Mettere lo Stato

```
Il dato serve a più componenti non-parent/child?
│
├─ SÌ → È un dato server (API)?
│       ├─ SÌ → React Query (useQuery / useMutation)
│       └─ NO → Context API o Zustand (solo per stato globale UI)
│
└─ NO → È uno stato temporaneo dell'interazione (hover, modal aperto, input)?
        ├─ SÌ → useState locale nel componente
        └─ NO → È un valore computato da altri stati?
                ├─ SÌ → useMemo
                └─ NO → useState locale + useCallback se passato in basso
```

### 9.2 Regole useState

```typescript
// ✅ Raggruppare stati correlati in un oggetto
const [uiState, setUiState] = useState({
  isModalOpen: false,
  activeTab: 'overview',
  selectedNodeId: null as string | null,
});

setUiState(prev => ({ ...prev, isModalOpen: true }));

// ❌ NON creare 5+ useState separati che si aggiornano sempre insieme
```

### 9.3 Regole useEffect

```typescript
// ✅ Un useEffect = una responsabilità
// SOLO: sincronizzazione con sistemi esterni (DOM, EventSource, WebSocket)

// ❌ PROIBITO — useEffect per derivare stato
useEffect(() => {
  setFilteredNodes(nodes.filter(n => n.type === activeFilter));
}, [nodes, activeFilter]);
// → Usare useMemo invece

// ❌ PROIBITO — fetch in useEffect senza cleanup
useEffect(() => { fetch('/api/data').then(r => r.json()).then(setData) }, []);
// → Usare React Query

// ✅ OBBLIGATORIO — cleanup in useEffect con listener
useEffect(() => {
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [handleMouseMove, handleMouseUp]);
```

---

## 10. REGOLE RECHARTS

### 10.1 Wrapper Obbligatorio

```typescript
// components/features/charts/ — tutti i chart devono essere qui
// NON implementare Recharts inline nelle pagine

const GrowthChart = memo(({ data, color = '#6366f1' }: GrowthChartProps) => (
  <ResponsiveContainer width="100%" height={260} debounce={200}>
    <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
        labelStyle={{ color: '#f1f5f9' }}
      />
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        fill={`url(#grad-${color.replace('#', '')})`}
        dot={false}
        activeDot={{ r: 4, fill: color }}
      />
    </AreaChart>
  </ResponsiveContainer>
), (prev, next) => prev.color === next.color && prev.data === next.data);
```

### 10.2 Regole Tooltip

```typescript
// ✅ Tooltip personalizzato — usare contentStyle scuro (coerente con il tema)
<Tooltip
  contentStyle={{
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)',
  }}
  labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
  itemStyle={{ color: '#94a3b8' }}
/>

// ❌ Non lasciare il tooltip default di Recharts — è bianco su tema scuro
```

---

## 11. REGOLE ACCESSIBILITÀ E UX BASE

### 11.1 Interattività — Standard Minimi

```typescript
// ✅ Ogni elemento cliccabile deve avere:
// 1. Stato hover visibile
// 2. Stato focus visibile (per keyboard navigation)
// 3. Cursore appropriato
// 4. Feedback visivo al click (active state)

<button
  className={cn(
    'rounded-lg px-4 py-2 transition-all duration-150',
    'hover:bg-indigo-600 active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
  )}
  disabled={isLoading}
>
  {isLoading ? <Spinner size="sm" /> : 'Conferma'}
</button>

// ❌ PROIBITO — elemento cliccabile senza hover/focus
<div onClick={handleClick} className="p-4">Click qui</div>
```

### 11.2 Loading States — Standard

```typescript
// 4 stati obbligatori in ogni sezione che fetcha dati:

// STATO 1: Loading iniziale
if (isLoading) return <ComponentSkeleton />;

// STATO 2: Errore
if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;

// STATO 3: Dati vuoti
if (!data || data.length === 0) return (
  <EmptyState
    icon={<IconName />}
    title="Nessun risultato"
    description="Messaggio contestuale specifico"
  />
);

// STATO 4: Dati presenti
return <ComponentWithData data={data} />;
```

### 11.3 Feedback Mutations

```typescript
const mutation = useMutation({
  mutationFn: saveObjective,
  onSuccess: () => { toast.success('Obiettivo salvato'); },
  onError: (error) => { toast.error(`Errore: ${error.message}`); },
});

<button disabled={mutation.isPending}>
  {mutation.isPending ? <Spinner size="sm" /> : 'Salva'}
</button>
```

### 11.4 Responsive — Breakpoint Standard

```
mobile:  < 640px   → layout stack verticale, niente grafo SVG, menu hamburger
tablet:  640-1024px → layout ibrido, sidebar collassabile
desktop: > 1024px  → layout completo
```

- Testare **SEMPRE** mobile prima del deploy (viewport 375px)
- Il grafo SVG ha un fallback su mobile (lista nodi invece del canvas)
- Le tabelle admin hanno `overflow-x: auto` su mobile

---

## 12. REGOLE TYPESCRIPT

### 12.1 No Any — Politica Zero Toleranza

```typescript
// ❌ PROIBITO in qualsiasi forma:
const data: any = response.json();
function process(input: any) { }
const handler = (e: any) => { };

// ✅ Usare tipi specifici o unknown con type guard
const data: unknown = response.json();
if (typeof data === 'object' && data !== null && 'id' in data) { ... }

// ✅ Per event handler, usare i tipi React corretti
const handleClick  = (e: React.MouseEvent<HTMLButtonElement>) => { };
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { };
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { };
```

### 12.2 Tipi dal DB — Source of Truth

```typescript
// ✅ Importare dal client generato
import type { Sector, Profession, TestSession } from '@workspace/api-client-react';

// ✅ Per tipi parziali, usare le utility TypeScript
type SectorPreview   = Pick<Sector, 'id' | 'name' | 'slug' | 'riasecTypes'>;
type CreateObjective = Omit<UserObjective, 'id' | 'createdAt' | 'userId'>;

// ❌ Non creare tipi paralleli con strutture simili
interface MySectorType { sectorId: number; sectorName: string; } // naming inconsistente
```

### 12.3 Return Type Obbligatorio per Hook Custom

```typescript
// ✅ OBBLIGATORIO — tipare il return type di ogni hook custom
interface UseSSEStreamReturn {
  content: string;
  isStreaming: boolean;
  error: Error | null;
  start: (url: string, body?: object) => void;
  stop: () => void;
  reset: () => void;
}

export function useSSEStream(): UseSSEStreamReturn { ... }
```

---

## 13. STRUTTURA FILE E NAMING

### 13.1 Naming Convention

```
File componenti:  PascalCase.tsx         → SectorCard.tsx
File hook:        camelCase.ts           → useSSEStream.ts
File utility:     camelCase.ts           → formatDate.ts
File costanti:    UPPER_SNAKE_CASE.ts    → RIASEC_COLORS.ts
File tipi:        camelCase.types.ts     → sector.types.ts
File test:        ComponentName.test.tsx → SectorCard.test.tsx

Componenti:     PascalCase    → function SectorCard()
Hook:           useXxx        → function useSSEStream()
Utility pure:   verbNoun      → function formatMatchScore()
Costanti:       UPPER_SNAKE   → const SPIRIT_COLORS = {}
Event handler:  handleXxx     → const handleNodeDrag = ...
Boolean state:  is/has/can    → isLoading, hasError, canEdit
```

### 13.2 Lunghezza File — Limiti

```
Componente pagina (/pages):     MAX 150 righe  (solo orchestrazione)
Componente feature (/features): MAX 200 righe
Componente UI (/ui):            MAX 100 righe
Hook custom (/hooks):           MAX 150 righe
File utility (/lib):            MAX 100 righe
```

Se superi questi limiti → il componente fa troppo → spacca in componenti figli.

### 13.3 Import Order

```typescript
// 1. React e librerie React
import { useState, useCallback, memo } from 'react';
// 2. Librerie di terze parti
import { useQuery } from '@tanstack/react-query';
import { AreaChart } from 'recharts';
// 3. Moduli interni assoluti (@/...)
import { cn } from '@/lib/utils';
import { useSSEStream } from '@/hooks/useSSEStream';
// 4. Componenti locali relativi
import { SectorCard } from './SectorCard';
// 5. Tipi (sempre in fondo agli import)
import type { Sector } from '@workspace/api-client-react';
```

---

## 14. OPERAZIONI PROIBITE

### 🚫 Performance — Proibiti Assoluti

```typescript
// ❌ setState dentro un loop
items.forEach(item => setState(prev => [...prev, item])); // N re-render
// ✅ setState([...items])

// ❌ useEffect con array di dipendenze vuoto che fetcha dati
useEffect(() => { fetch(...).then(setData) }, []);
// ✅ React Query

// ❌ Oggetti/array/funzioni inline come props di componenti memoizzati
<MemoizedComponent style={{ color: 'red' }} onClick={() => doThing()} />
// ✅ useMemo/useCallback

// ❌ Import di librerie intere
import _ from 'lodash';
// ✅ import debounce from 'lodash/debounce'

// ❌ Scroll listener senza passive
window.addEventListener('scroll', handler);
// ✅ window.addEventListener('scroll', handler, { passive: true })

// ❌ backdrop-filter: blur(>12px) su elementi in lista
// ❌ will-change su elementi statici
// ❌ Animare top/left invece di transform
```

### 🚫 Codice — Proibiti Assoluti

```typescript
// ❌ console.log committati
console.log('debug:', data);

// ❌ Hardcoded URL API
fetch('http://localhost:3000/api/sectors');
// ✅ fetch(`${import.meta.env.VITE_API_URL}/api/sectors`)

// ❌ Accesso diretto a localStorage nei componenti
const token = localStorage.getItem('token');
// ✅ useAuth() o il wrapper apiFetch

// ❌ Manipolazione diretta del DOM fuori dal grafo SVG
document.getElementById('element').style.color = 'red';
// ✅ useRef o React state

// ❌ Key su indice array in liste che cambiano ordine
{items.map((item, index) => <Item key={index} />)}
// ✅ {items.map((item) => <Item key={item.id} />)}
```

---

## 15. CHECKLIST PRE-COMMIT

```markdown
## Pre-Commit — [NOME FEATURE] — [DATA]

### Performance
- [ ] Non ho introdotto setState in loop
- [ ] Non ho fetch in useEffect (uso React Query)
- [ ] I componenti costosi sono memoizzati con React.memo
- [ ] Ho usato useCallback per handler passati come props
- [ ] Nessun backdrop-filter > blur(12px) su elementi in lista
- [ ] Ho controllato con React DevTools Profiler per re-render inattesi?

### Streaming SSE
- [ ] Ho usato useSSEStream invece di implementare SSE inline?
- [ ] Lo streaming usa startTransition per non bloccare l'input?
- [ ] L'EventSource viene chiuso nel cleanup (useEffect return)?

### Tailwind
- [ ] Nessuna classe interpolata (bg-${var}-500)?
- [ ] Ho usato cva() per varianti di componenti?
- [ ] Ho usato cn() per classi condizionali?

### React Query
- [ ] Ho usato queryKey gerarchico?
- [ ] Ho impostato staleTime appropriato?
- [ ] Ho usato placeholderData: keepPreviousData dove serve?
- [ ] Le mutations invalidano solo le query pertinenti?

### Auth e Route
- [ ] Le nuove route protette usano ProtectedRoute?
- [ ] I componenti con dati utente controllano authReady?

### TypeScript
- [ ] Nessun any nel codice?
- [ ] I tipi delle entità vengono da api-client-react?
- [ ] I hook custom hanno return type esplicito?

### UX Base
- [ ] I bottoni hanno stato loading durante mutation?
- [ ] Le sezioni con fetch hanno: loading / error / empty / data states?
- [ ] Gli elementi cliccabili hanno hover + focus-visible styles?
- [ ] Ho testato su viewport mobile (375px)?

### Codice
- [ ] Nessun console.log residuo?
- [ ] Nessun URL hardcoded?
- [ ] Le key nelle liste usano ID stabili (non index)?
- [ ] I file rispettano i limiti di lunghezza?
```

---

## 16. PATTERN DI RIFERIMENTO

### Pattern A — Pagina con Dati Asincroni (Standard)

```typescript
function SectorPage({ sectorId }: { sectorId: string }) {
  const { data: sector, isLoading, error, refetch } = useQuery({
    queryKey: ['sectors', sectorId],
    queryFn: () => fetchSector(sectorId),
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <SectorPageSkeleton />;
  if (error)     return <ErrorState message={error.message} onRetry={refetch} />;
  if (!sector)   return <EmptyState title="Settore non trovato" />;

  return (
    <PageLayout title={sector.name}>
      <SectorHeader sector={sector} />
      <SectorTabs sector={sector} />
    </PageLayout>
  );
}
```

### Pattern B — Componente con Mutation Ottimistica (Standard)

```typescript
function ObjectiveCard({ objective }: { objective: UserObjective }) {
  const queryClient = useQueryClient();

  const updateProgress = useMutation({
    mutationFn: (progress: number) => patchObjective(objective.id, { progress }),
    onMutate: async (progress) => {
      await queryClient.cancelQueries({ queryKey: ['user-objectives'] });
      const prev = queryClient.getQueryData(['user-objectives']);
      queryClient.setQueryData(['user-objectives'], (old: UserObjective[]) =>
        old.map(o => o.id === objective.id ? { ...o, progress } : o)
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['user-objectives'], ctx?.prev);
      toast.error('Errore nel salvataggio');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-objectives'] });
    },
  });

  return (
    <div className="rounded-xl border border-slate-700 p-4">
      <h3 className="text-slate-100">{objective.text}</h3>
      <ProgressSlider
        value={objective.progress}
        onChange={(v) => updateProgress.mutate(v)}
        disabled={updateProgress.isPending}
      />
    </div>
  );
}
```

### Pattern C — Sezione AI con Streaming (Standard)

```typescript
function WikiChatSection({ sectorId }: { sectorId: string }) {
  const [question, setQuestion] = useState('');
  const { content, isStreaming, error, start, reset } = useSSEStream({
    onError: () => toast.error('Errore durante la generazione AI'),
  });

  const handleSubmit = useCallback(() => {
    if (!question.trim() || isStreaming) return;
    reset();
    start(`/api/wiki/${sectorId}/ask`, { message: question });
    setQuestion('');
  }, [question, isStreaming, sectorId, start, reset]);

  return (
    <div className="flex flex-col gap-4">
      {content && <StreamingContent content={content} isStreaming={isStreaming} />}
      {error && <ErrorBanner message={error.message} />}
      <div className="flex gap-2">
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Fai una domanda..."
          className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-slate-100"
          disabled={isStreaming}
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !question.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-500 disabled:opacity-50"
        >
          {isStreaming ? <Spinner size="sm" /> : 'Invia'}
        </button>
      </div>
    </div>
  );
}
```

---

## ✍️ FIRMA DI LETTURA

```
Ho letto e compreso questo documento integralmente.
Mi impegno a rispettare tutti i pattern e le regole descritte.
In caso di dubbio, leggo prima di implementare.

Data: ________________
Feature in sviluppo: ________________
```

---

*FRONTEND_RULES.md — NorthStar / Orientamento SaaS · Versione 1.0 — Maggio 2026 · Da leggere prima di ogni nuova feature, componente o pagina. Tenere affianco a DB_RULES.md nella root del repo.*
