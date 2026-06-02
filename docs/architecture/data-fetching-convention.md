# Convenzione data-fetching (frontend) — ADR

> Stato: **adottata** (2026-06, Fase 1 cleanup architetturale).
> Obiettivo: una sola strategia di accesso ai dati, contratto FE/BE coerente,
> migrazione **incrementale** (strangler-fig) senza big-bang.

## Il problema

Oggi coesistono 4 pattern di fetch nel frontend (`apps/web`):

| Pattern | ~File | Note |
|---|---|---|
| `@tanstack/react-query` (`useQuery`/`useMutation`) | 67 | layer di **cache/stato** |
| `apiClient.ts` (`getJson`/`postJson`/…) | — | wrapper **tipizzato** su `apiFetch` |
| client OpenAPI generato (`@workspace/api-client-react`) | 24 | hooks da `api-spec` |
| `apiFetch` diretto | 37 | low-level (inietta token) |
| `fetch(` raw | ~3 | **bypassa** auth/error handling |

Conseguenza: il contratto OpenAPI è la fonte di verità solo per ~24 file su ~130 → FE e BE possono divergere in silenzio; error handling e auth incoerenti.

## La regola (gerarchia canonica)

**1. Trasporto** — un solo modo, in quest'ordine di preferenza:
1. **Client OpenAPI generato** (`@workspace/api-client-react`) quando l'endpoint è nello spec → tipi end-to-end dal contratto.
2. **`apiClient.ts`** (`getJson/postJson/patchJson/putJson/deleteJson`) per endpoint non ancora nello spec → JSON tipizzato, auth + `ApiClientError` consistenti.
3. **`apiFetch`** solo per casi non-JSON (stream/SSE/audio) — inietta il token.
4. **`fetch(` raw — VIETATO**, salvo bootstrap auth (`AuthContext` prima che il token esista). Enforced da `pnpm audit:api-fetch`.

**2. Stato/cache** — **sempre react-query** per dati di server in componenti/hook:
- niente `useState`+`useEffect`+fetch manuale per dati remoti.
- `queryKey` stabile e namespacizzata (es. `["compass"]`).
- le mutation che ritornano l'entità aggiornata fanno `queryClient.setQueryData(key, next)`; altrimenti `invalidateQueries`.
- default globali (in `App.tsx`): `staleTime` 5 min, `refetchOnWindowFocus: false` → caching condiviso e niente refetch inutili.

**3. Funzioni imperative** (one-shot fuori da React) → `apiClient` con `try/catch` se il chiamante si aspetta un fallback graceful (`null`/`[]`).

## Migrazione (incrementale, behavior-preserving)

- Non si riscrive tutto in un PR. Ogni file migra mantenendo **interfaccia e comportamento** (stesso shape di ritorno, stessi fallback).
- Priorità: (a) eliminare `fetch` raw → wrapper; (b) hook con `useState/useEffect` manuale → react-query; (c) chiamate ad endpoint già nello spec → client generato.
- Riferimento applicato: `apps/web/src/features/compass/useCompass.ts` (migrato a react-query + `apiClient`, caching condiviso tra dashboard e `/chi-sono`).

## Backlog noto

- `useSSEStream`, `useWendyOpenAITTS`: `fetch` raw per streaming/audio → instradare via `apiClient.stream()` / `apiFetch` (richiede test mirati su Wendy voce/stream).
- `AuthContext`: `fetch` raw di bootstrap = **eccezione giustificata** (token non ancora pronto), da documentare inline.
- Estendere `api-spec/openapi.yaml` per coprire più endpoint → più file possono usare il client generato.
