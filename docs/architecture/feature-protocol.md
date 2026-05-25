# Feature Protocol

NorthStar usa il Feature Protocol per evitare che una nuova funzionalita nasca sparsa tra web, server, DB, Wendy e test senza un contratto comune.

## Regola

Ogni feature nuova deve avere un manifest tipizzato con:

- route web e API;
- livello auth;
- schema di validazione;
- telemetry;
- smoke minimo;
- test di riferimento;
- tool Wendy opzionali con policy, rischio e schema input/output.

Il manifest vive vicino al dominio quando la feature viene migrata. Nella fase iniziale i manifest pilota sono registrati da `packages/ai-server/src/feature-protocol/builtin`.

## Struttura Consigliata

Web:

```text
apps/web/src/features/<feature>/
  <feature>Types.ts
  <feature>Api.ts
  use<Feature>.ts
  <Feature>ViewModel.ts
  components/
```

Server:

```text
apps/server/src/features/<feature>/
  schemas.ts
  repository.ts
  service.ts
  policy.ts
  routes.ts
  manifest.ts
```

La page React resta una shell sottile. La route Express resta un handler sottile.

## Wendy Tool Protocol

I tool Wendy co-locati nel manifest dichiarano:

- `policy`: `read`, `navigate`, `write`, `delete`;
- `risk`: `low`, `medium`, `high`;
- `requiresConfirmation`;
- `inputSchema` e `outputSchema`;
- evento telemetry.

Regola di sicurezza: ogni tool `write` o `delete`, e ogni tool `high`, richiede conferma. Le capability low-risk, come navigare o leggere dati, possono essere eseguite direttamente.

## Gate

I gate bloccanti sono:

- `pnpm run audit:feature-protocol`;
- `pnpm run audit:wendy-tools`;
- `pnpm run quality:required`.

La fase attuale e un ratchet: blocca i manifest nuovi non conformi e rende `calendar`, `objectives`, `sectors` e `profile` feature pilota complete. Quando la copertura dei moduli sale, il protocollo diventa gate assoluto per tutte le feature.

## Scaffolder

Per creare una feature:

```powershell
pnpm run create:feature nome-feature
```

Per vedere cosa verrebbe creato:

```powershell
pnpm run create:feature nome-feature -- --dry-run --json
```

Lo scaffolder genera scheletro web/server e un manifest iniziale, cosi il lavoro parte da una forma testabile invece che da file copiati a mano.

## Feature Pilota: Calendar

`calendar` dimostra il percorso completo:

- web route `/calendario`;
- API `/api/calendar/events`;
- Wendy tool `add_calendar_event`;
- smoke `calendar:list`, `calendar:create-preview`, `wendy:create-calendar-event-preview`;
- test server/Wendy/client action.

Questo e il modello da seguire per `sectors`, `profile`, `objectives`, `test/results` e `applications`.

## Feature Pilota: Sectors

`sectors` dimostra le capability Wendy a basso rischio:

- web routes `/settori` e `/settore/:id`;
- API `/api/sectors`, `/api/sectors/:id`, stats e roles;
- Wendy tools `list_sectors`, `get_sector_detail`, `compare_sectors`, `open_view:settore`;
- policy `read`/`navigate`, quindi senza conferma obbligatoria;
- smoke `sectors:list`, `sectors:detail`, `wendy:sector-explain`, `wendy:sector-navigate`.

## Feature Pilota: Profile

`profile` dimostra un modulo personale con lettura, navigazione e scrittura controllata:

- web routes `/profilo` e `/memoria-wendy`;
- API profilo, avatar, banner, mode e backgrounds;
- Wendy tools `get_user_context`, `open_view:profilo`, `update_profile_preferences`;
- le preferenze sono `write` a rischio medio, quindi richiedono conferma;
- smoke `profile:view`, `profile:settings`, `profile:backgrounds-read`, `wendy:profile-context`.

## Feature Pilota: Objectives

`objectives` dimostra un modulo operativo personale:

- web route principale `/dashboard`;
- API `/api/objectives`, seed, update e delete;
- Wendy tools `get_user_objectives`, `save_objective`, `update_objective_progress`;
- la lettura e low-risk, mentre creazione e update sono `write` e richiedono conferma;
- smoke `objectives:list`, `objectives:create-preview`, `wendy:create-objective-preview`.

Il prossimo batch deve portare `test/results`, `applications` e `roadmap` nello stesso schema.
