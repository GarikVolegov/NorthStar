# Fix: Search system — funzionante anche senza dati

## Problemi

1. **Hybrid search fallisce** quando la colonna `embedding` non esiste nel DB
2. **Suggest endpoint** richiede auth non necessaria
3. **DB vuoto** → search non trova nulla (sectors sono hardcoded, non in DB)
4. **Frontend** mostra "Nessun risultato" senza alternative utili

## Fix

### 1. Hybrid search — query fallback senza embedding

**File:** `apps/server/src/routes/search-hybrid.ts`

Sostituire l'intero `router.post("/", ...)` handler con uno che:

- Prova le query con colonna `embedding` 
- Se falliscono (colonna inesistente), riprova senza `embedding`
- Helper `queryWithFallback(tryQuery: (useEmbedding: boolean) => Promise<T[]>)`
- Stessa logica RRF per ranking

### 2. Suggest senza requireAuth

**File:** `apps/server/src/routes/search.ts:151`

Cambiare:
```ts
router.get("/suggest", requireAuth, async (req, res) => {
```
in:
```ts
router.get("/suggest", async (req, res) => {
```

### 3. Fallback dati hardcodati per DB vuoto

**File:** `apps/server/src/routes/search.ts:24-48`

Nella route `GET /` (basic search), dopo la query DB, se results.length === 0, aggiungere fallback con dati hardcodati:

```ts
const STATIC_FALLBACKS = [
  { type: "sector", id: 1, title: "Tecnologia", description: "Settore tecnologico e informatico", url: "/settore/1", icon: "layers", color: "#6366f1" },
  { type: "sector", id: 2, title: "Marketing", description: "Settore del marketing e della comunicazione", url: "/settore/2", icon: "layers", color: "#6366f1" },
  { type: "sector", id: 3, title: "Finanza", description: "Settore finanziario e bancario", url: "/settore/3", icon: "layers", color: "#6366f1" },
  { type: "sector", id: 4, title: "Sanità", description: "Settore sanitario e farmaceutico", url: "/settore/4", icon: "layers", color: "#6366f1" },
  { type: "sector", id: 5, title: "Istruzione", description: "Settore dell'istruzione e della formazione", url: "/settore/5", icon: "layers", color: "#6366f1" },
];
```

Aggiungere dopo la sezione `const results = [...]`:
```ts
const results: SearchResult[] = [...sectors.map(...), ...roles.map(...), ...articles.map(...), ...newsItems.map(...)];

// Se DB vuoto, usa fallback statici
if (results.length === 0) {
  results.push(...STATIC_FALLBACKS);
}
```

**N.b.:** Anche la suggest route e la hybrid route beneficerebbero di fallback analoghi.

### 4. Frontend — empty state migliore

**File:** `apps/web/src/components/search/SearchDialog.tsx`

Quando `!isLoading && results.length === 0 && query.length >= 2`:
- Oltre a `CommandEmpty`, aggiungere suggerimenti esplorativi:
  - "Prova a cercare 'tecnologia', 'marketing', 'finanza'..."
  - "Oppure chiedi a Wendy"

Aggiungere nel blocco esistente:
```tsx
{!isLoading && results.length === 0 && query.length >= 2 && (
  <CommandEmpty>
    <p>{t("search.noResults", { query })}</p>
    <p className="text-xs text-muted-foreground mt-1">
      Prova: tecnologia, marketing, finanza, sanità, istruzione
    </p>
  </CommandEmpty>
)}
```
