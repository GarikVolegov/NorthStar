# Sector Role Job Flow Design

## Objective

NorthStar must stop treating sector exploration and profession exploration as
two separate decisions. When a user decides where to focus, the app should help
them choose both:

- the sector or market area worth pursuing;
- the concrete role to study, test, and develop deeply;
- the real job demand connected to that role;
- the companies in the user's area that may need that role.

The intended journey is:

`sector direction -> role target -> skills and proof -> local companies and jobs`

This design keeps the existing catalog pages useful, but turns the decision
experience into one guided flow anchored in La Bussola and the dashboard.

## Current Context

Relevant existing pieces:

- `/settori` already ranks sectors with a personal/market pyramid.
- `/settore/:id` already loads sector roles through `useGetSectorRoles`.
- `/ruoli` is a separate role catalog with search and sector filters.
- `/ruolo/:id` already contains role detail, Try-a-Day, skills, and education.
- `/lavori` already shows authenticated market-backed job signals from
  `job_posting_snapshots`.
- `/api/jobs` returns demand snapshots but currently personalizes mostly from
  the latest test profile, not from an explicit selected role.
- `/api/compass/action-plan` already connects a confirmed profession hypothesis
  to market demand, but only after the role has emerged in Compass.
- Dashboard adaptive flow currently promotes `explore_sectors`, which is too
  narrow for the requested final decision.
- User profile settings already store `city` and `cityPlaceId`, which can be
  used as the default local search area.
- `@workspace/ai-server` already exposes `searchWeb`, backed by Tavily when
  configured, which can power source-linked company discovery.

The missing layer is a unified decision state that carries the user from sector
choice to role choice and then into job search. The new local-company layer
must be evidence-based: NorthStar can show companies it can discover from
configured providers and available public sources, not claim a mathematically
complete list of every company in an area.

## Recommended Approach

Use a guided "Scegli la tua direzione" flow rather than merging every page into
one large page.

Why this approach:

- It fits the existing Bussola model, which already exists to resolve
  indecision.
- It preserves SEO and catalog utility for `/settori` and `/ruoli`.
- It keeps backend changes focused: selected sector and selected role become
  explicit inputs to the job feed.
- It avoids inventing fake job listings or companies. NorthStar uses real
  aggregated market snapshots plus source-linked local company prospects.

Alternatives considered:

- A single replacement page for both sectors and roles: clearer on paper, but
  too disruptive for existing routes and navigation.
- Only adding links between current pages: fast, but it preserves the current
  fragmented experience and does not prove a stable decision.

## User Experience Model

The decision journey has five states:

| State | Meaning | Primary action |
|---|---|---|
| `needs_sector` | The user has no active sector direction | Explore and choose a sector |
| `needs_role` | The user selected or opened a sector but has no target role | Choose a role inside that sector |
| `role_focus` | The user selected a target role | Study skills and try the role |
| `ready_for_jobs` | The role is selected or confirmed enough to act | View local companies and matching job demand |
| `active_job_search` | The user is looking at companies, job signals, or saved opportunities | Track applications |

The copy should stop saying only "Esplora settori" when the user is making a
career decision. The next action should be "Scegli settore e ruolo" or "Scegli
il ruolo target", depending on progress.

## Frontend Design

### Dashboard And Bussola

Update the indeciso/adaptive dashboard phase currently named
`explore_sectors` so the product behavior is "choose direction":

- next action label: "Scegli settore e ruolo";
- href remains `/settori` for the first slice;
- supporting Wendy prompts ask for both a sector and role target;
- tools promote the unified direction flow instead of a standalone sector
  catalog.

La Bussola should keep acting as the hub. Its "Sperimenta" phase should present
sector and role exploration as one decision arc, not two unrelated cards.

### Sector List

`/settori` remains the first decision surface. It should communicate that the
sector is only the first half of the decision.

Recommended changes:

- hero copy says the goal is choosing an area and then a role;
- cards use CTA language such as "Apri ruoli del settore";
- filtered/ranked sector cards link to `/settore/:id#ruoli` when the user is
  in the decision flow, while still supporting normal sector detail browsing.

### Sector Detail

`/settore/:id` becomes the bridge between area and role.

Recommended changes:

- promote the roles section above or near the first actionable fold;
- show role cards with evidence: skills, growth outlook, salary, work modes,
  and demand when available;
- primary CTA on each role: "Scegli questo ruolo";
- secondary CTA: "Approfondisci";
- selecting a role takes the user to `/ruolo/:id` and carries context that this
  is the chosen target.

The existing tabs can stay, but roles should not feel like a late tab hidden
after general sector information.

### Role Catalog

`/ruoli` remains useful for browsing, but should accept and preserve
`sectorId`. If a user arrives from a sector, the catalog opens already filtered
and explains that they are choosing a role inside that sector.

### Role Detail

`/ruolo/:id` becomes the commitment page for a target role.

Recommended changes:

- add a visible decision rail or action band:
  "Settore scelto -> Ruolo target -> Competenze -> Lavori";
- keep Try-a-Day as the experiential validation step;
- add a primary CTA after the role summary and after Try-a-Day:
  "Trova aziende e lavori per questo ruolo";
- the CTA links to `/lavori?professionId=:id`;
- when `sectorInfo` exists, include `sectorId` as a fallback:
  `/lavori?professionId=:id&sectorId=:sectorId`.

### Jobs Page

`/lavori` should accept explicit context and become the action surface after a
role choice:

- `professionId` filters to job snapshots for that role;
- `sectorId` filters to snapshots in that sector when no profession is present;
- `city`, when present, overrides the profile city for the local company search;
- no query params keeps the current personalized feed behavior.

The page heading should reflect the context:

- role context with city: "Aziende e lavori per [Role] a [City]";
- role context without city: "Aziende e lavori per [Role]";
- sector context: "Domanda lavoro in [Sector]";
- no context: current generic/personalized wording.

If there are no snapshots for the selected role, the page should gracefully fall
back to sector snapshots and explain the fallback.

When `professionId` is present, the first actionable block should be local
company prospects:

- company name and location;
- why this company may need the role;
- source label and link used as evidence;
- confidence level;
- suggested search URL for finding current openings at that company.

The UI copy must say "aziende trovate dalle fonti disponibili" or equivalent,
not "tutte le aziende" as an absolute guarantee. If the user has no city in
profile and no `city` query param, the panel should ask them to add a city or
search by city.

## Backend And Data Flow

### Jobs API

Extend `GET /api/jobs` with optional query params:

- `professionId`: positive integer;
- `sectorId`: positive integer;
- `geography`: optional future parameter, defaulting to current behavior.

Filtering priority:

1. If `professionId` is valid, return snapshots for that profession.
2. If no profession snapshots exist and `sectorId` is valid, return snapshots
   for that sector with a fallback reason.
3. If neither param is present, use the existing personalized feed.

Response additions:

- `basedOnProfession`: role title or null;
- `basedOnSector`: keep existing field;
- `filter`: `{ professionId, sectorId, fallback }`;
- `status` remains `ok`, `empty`, or `not_configured`.

### Local Company Prospects API

Add `GET /api/jobs/company-prospects` with optional query params:

- `professionId`: positive integer, required for the first slice;
- `sectorId`: positive integer, optional context;
- `city`: optional string, max 120 characters. If absent, use the authenticated
  user's profile `city`.

Response shape:

```ts
{
  companies: Array<{
    name: string;
    location: string;
    reason: string;
    evidence: string;
    sourceUrl: string;
    sourceLabel: string;
    confidence: "high" | "medium" | "low";
    suggestedSearchUrl: string;
  }>;
  basedOnProfession: string | null;
  basedOnSector: string | null;
  basedOnCity: string | null;
  status: "ok" | "empty" | "city_required" | "not_configured";
  coverageNote: string;
}
```

Implementation principles:

- require authentication;
- resolve the role title from `professionId` before searching;
- use profile city only when the user has already provided it; do not request
  precise device geolocation in the first slice;
- search public sources through a provider abstraction backed by `searchWeb`;
- deduplicate prospects by normalized company name and source domain;
- rank prospects by role/sector/city evidence, not by unsupported inference;
- return `not_configured` when no company-search provider is configured;
- return `city_required` when no city is available;
- keep source links visible so the user can inspect why the company appeared.

Example search intents for the web provider:

- `aziende {city} assumono {roleTitle}`;
- `{roleTitle} {city} lavora con noi`;
- `{sectorName} aziende {city} {roleTitle}`;
- `site:linkedin.com/company {city} {roleTitle}`.

The first implementation can return company prospects rather than live job ads.
The suggested search URL lets the user move from a prospect company to current
openings without NorthStar fabricating postings.

### Compass Action Plan

`/api/compass/action-plan` already handles confirmed profession hypotheses. It
should continue doing that, but future implementation can also read explicit
selected sector/role state if that persistence is added.

For the first implementation slice, explicit selection can live in route
context/query params. Persistent "chosen direction" is useful, but not required
to make the user flow real.

## Error And Empty States

- If sector roles fail to load, sector detail still renders the normal sector
  content and shows a retryable roles error.
- If a role has no market snapshots, `/lavori` falls back to sector snapshots
  when possible.
- If neither role nor sector snapshots exist, `/lavori` explains that market
  data is not available yet and offers the role page and skills page as next
  steps.
- If company prospect search is not configured, `/lavori` explains that local
  company discovery needs a search provider and still shows market snapshots.
- If no city is available, `/lavori` asks the user to set a city or retry with a
  city search parameter.
- If no companies are found from available sources, `/lavori` says no local
  prospects were found yet and still shows role/sector demand.
- If the user is logged out, `/lavori` keeps the existing auth gate.

## Testing

Add focused coverage for:

- dashboard adaptive phase label/CTA changing from sector-only to
  sector-plus-role decision;
- Wendy prompt copy for the direction phase mentioning both sector and role;
- sector detail exposing a primary roles decision CTA;
- role detail linking to `/lavori?professionId=:id`;
- `/api/jobs?professionId=:id` returning role-filtered snapshots;
- `/api/jobs?professionId=:id&sectorId=:id` falling back to sector snapshots
  when role snapshots are missing;
- `/api/jobs/company-prospects?professionId=:id` using profile city and
  returning source-linked company prospects;
- `/api/jobs/company-prospects?professionId=:id` returning `city_required` when
  neither profile city nor query city exists;
- `/api/jobs/company-prospects?professionId=:id` returning `not_configured`
  when the provider is unavailable;
- `/lavori` rendering context-specific headings and empty/fallback states.

## Out Of Scope For First Slice

- Building a full persistent "selected direction" schema.
- Replacing `/settori` and `/ruoli` with a single new route.
- Creating individual external job ads beyond the existing aggregated market
  signal model and source-linked company prospects.
- Guaranteeing an exhaustive registry of every company in an area. The first
  slice searches all discoverable companies from configured providers and
  clearly states source coverage.
- Requesting precise browser/device geolocation.
- Reworking the whole dashboard layout system.
- Changing Wendy model behavior beyond prompt/CTA context.

## Implementation Slices

1. Rename and adapt the dashboard/Bussola direction phase so it promotes
   sector-plus-role choice.
2. Promote sector roles in `/settore/:id` and add clear CTAs into role detail.
3. Add role-to-jobs CTA in `/ruolo/:id`.
4. Extend `/api/jobs` and `/lavori` to support `professionId` and `sectorId`.
5. Add `/api/jobs/company-prospects` and a local company prospects panel on
   `/lavori`.
6. Add tests for the full navigation and API path.

## Success Criteria

- The user no longer sees "choose a sector" as the full decision.
- From dashboard/Bussola, the next action clearly leads to choosing both a
  sector and role.
- From a sector, the user can immediately choose a role inside that sector.
- From a role, the user can inspect skills/Try-a-Day and then open matching
  local company prospects and job demand directly.
- `/lavori` can show role-specific or sector-specific market demand based on
  explicit context.
- `/lavori` can show companies in the user's city that available sources suggest
  may need the selected role, with visible evidence and source links.
- Existing generic browsing still works for users who are not inside the
  guided decision flow.
