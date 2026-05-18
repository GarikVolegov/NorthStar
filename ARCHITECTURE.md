# NorthStar — Architettura e Pattern

Guida di riferimento per sviluppatori. Ogni nuovo file deve seguire i pattern descritti qui.

Per la mappa fisica del monorepo e le regole di posizionamento dei file, vedi
[`docs/REPOSITORY_STRUCTURE.md`](./docs/REPOSITORY_STRUCTURE.md).

---

## Stack tecnologico effettivo

| Layer | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Router | wouter |
| State | React Context + TanStack Query v5 |
| Realtime | EventBus (BroadcastChannel) + WebSocket |
| Backend | Express + Node.js + TypeScript |
| DB | PostgreSQL (Neon) + Drizzle ORM |
| Cache | Redis (ioredis) |
| AI | OpenRouter / Groq / OpenAI via SSE |

---

## Pilastro 1 — Costanti Centralizzate

**File**: `apps/web/src/lib/constants.ts`

Tutte le URL `/api/...` devono passare da `API_ENDPOINTS`. Mai stringhe letterali nelle pagine.

```typescript
// ✅ CORRETTO
import { API_ENDPOINTS, withParams } from "@/lib/constants";
const res = await apiFetch(API_ENDPOINTS.briefings.list);
const url = withParams(API_ENDPOINTS.briefings.markRead, { id: 42 });

// ❌ SBAGLIATO — stringa hardcoded
const res = await apiFetch("/api/briefings");
```

Quando aggiungi una nuova route backend, aggiungi subito la costante:

```typescript
// In API_ENDPOINTS (constants.ts):
myFeature: {
  list:   "/api/my-feature",
  detail: "/api/my-feature/:id",
  create: "/api/my-feature",
},
```

---

## Pilastro 2 — Data Fetching (React Query)

**Non** usare `fetch()` direttamente nei componenti. Usa sempre `apiFetch` (inietta JWT + gestisce 401).

```typescript
// ✅ CORRETTO
import { apiFetch } from "@/lib/api-fetch";
const res = await apiFetch(API_ENDPOINTS.auth.me);

// ❌ SBAGLIATO — bypass del JWT
const res = await fetch("/api/auth/me");
```

Query con React Query:

```typescript
const { data } = useQuery({
  queryKey: ["feature", id],
  queryFn:  () => apiFetch(withParams(API_ENDPOINTS.myFeature.detail, { id })).then(r => r.json()),
  staleTime: 5 * 60 * 1000, // default globale in App.tsx
  enabled:  !!user,
});
```

---

## Pilastro 3 — Comunicazione inter-pagina (Observer)

**File**: `apps/web/src/hooks/usePageBus.ts`, `usePageModule.ts`

Ogni pagina si registra nel sistema di messaging globale tramite `usePageModule`.

```typescript
// Ogni pagina (template obbligatorio):
export default function MyPage() {
  usePageModule({ pageId: "my-page" });
  // ...
}

// Comunicazione da una pagina all'altra:
const { bus } = usePageModule({ pageId: "dashboard" });
bus.emit("page:message", { to: "wendy-chat", body: "apri modale" });

// Ricezione messaggi:
usePageModule({
  pageId:    "wendy-chat",
  onMessage: (e) => console.log("ricevuto:", e.payload),
});
```

**`usePageBus`** è il livello basso — usa `usePageModule` nelle pagine.

---

## Pilastro 4 — Error Handling

**Lato server**: `ExecutionMonitor` in `apps/server/src/lib/execution-monitor.ts`

```typescript
import { captureError } from "../lib/execution-monitor";

try {
  await riskyOperation();
} catch (err) {
  captureError(err, { file: "routes/my-route.ts", function: "POST /api/my" });
  throw err; // re-throw per Express error handler
}
```

Report disponibile in: `GET /api/admin/error-report` (richiede `x-admin-key`).

**Lato client**: `ErrorBoundary` in `apps/web/src/components/ErrorBoundary.tsx`

```tsx
// In App.tsx (già in uso):
<ErrorBoundary>
  <Suspense fallback={<PageLoader />}>
    <MyPage />
  </Suspense>
</ErrorBoundary>
```

---

## Pilastro 5 — Dead Code Analysis

Rileva file/export non usati prima di ogni release:

```bash
pnpm audit:dead-code          # report compatto (stdout)
pnpm audit:dead-code:detail   # report dettagliato
```

Config in `knip.json` (root). Output è solo report — nessun delete automatico.

---

## Pilastro 6 — Design Pattern Espliciti

I pattern OOP sono documentati con `@pattern` nei file chiave:

| Pattern | File | Uso |
|---|---|---|
| **Singleton + Observer + BroadcastChannel** | `lib/event-bus.ts` | Cross-tab sync, messaging inter-pagina |
| **Factory + Registry** | `growth-agent/specialist-agent.ts` | Creazione/lookup agenti AI per dominio |
| **Template Method** | `components/ErrorBoundary.tsx` | Lifecycle React (getDerivedStateFromError → render) |
| **Singleton + Ring Buffer** | `lib/execution-monitor.ts` | Aggregazione errori server |
| **Observer + cleanup** | `hooks/usePageBus.ts` | Sottoscrizione con unsubscribe automatico |

---

## Struttura directory `apps/web/src/`

```
lib/
  constants.ts       ← API_ENDPOINTS, ROUTES, withParams()
  event-bus.ts       ← Singleton EventBus (Observer)
  api-fetch.ts       ← fetch wrapper con JWT auto-inject
  storage-keys.ts    ← chiavi localStorage costanti
  error-codes.ts     ← codici errore strutturati

hooks/
  usePageBus.ts      ← Observer wrapper (livello basso)
  usePageModule.ts   ← Lifecycle + messaging inter-pagina
  useSubscription.ts ← Piano abbonamento corrente
  useProactiveInsights.ts ← Insight proattivi Wendy

contexts/
  AuthContext.tsx     ← Auth global (login/logout/user)
  WendyProvider.tsx   ← Stato Wendy AI (open/close/ask)
  AppStateContext.tsx ← State cross-pagina (profilo, notifiche)

components/ui/
  UpgradeGate.tsx     ← Gate feature per piano (free/pro/team)
  ...shadcn/          ← Componenti Radix/shadcn (non modificare)

components/subscription/
  SubscriptionStatus.tsx ← Chip/Card/Banner piano corrente
```

---

## Checklist per nuove pagine

Prima di fare merge di una nuova pagina:

- [ ] Importa `usePageModule` e chiama `usePageModule({ pageId: "nome-pagina" })` all'inizio del componente
- [ ] Tutte le URL API passano da `API_ENDPOINTS` (nessuna stringa `/api/...` letterale)
- [ ] Usa `apiFetch` (non `fetch()` nudo) per tutte le chiamate che richiedono auth
- [ ] Usa `useQuery`/`useMutation` da React Query (non `useState` + `useEffect` per fetch)
- [ ] Lazy import in `App.tsx`: `const MyPage = lazy(() => import("@/pages/my-page"))`
- [ ] `tsc --noEmit` passa senza errori (`pnpm typecheck`)
- [ ] Nessun `any` esplicito introdotto

---

## Convenzioni di naming

| Tipo | Convention | Esempio |
|---|---|---|
| Pagine | `kebab-case.tsx` | `admin-rag.tsx` |
| Componenti | `PascalCase.tsx` | `ProactiveInsightCard.tsx` |
| Hook | `camelCase.ts` con prefisso `use` | `usePageModule.ts` |
| Costanti | `UPPER_SNAKE_CASE` | `API_ENDPOINTS`, `ROUTES` |
| Route backend | `kebab-case.ts` | `rag-admin.ts` |
| Schema DB | `camelCase.ts` con suffix `Table` | `ragChunksTable` |
