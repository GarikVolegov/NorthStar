# Content Discovery And Growth Library Design

## Objective

NorthStar must make information search and content discovery feel like one
guided experience. Today the pieces exist, but they are not coherent enough for
the user: global search, Wendy, content sources, and the growth library expose
different shapes, different explanations, and different levels of trust.

The goal is to improve:

- the quality and clarity of search results;
- the way content is exposed, explained, and linked to the user's journey;
- the growth library search and recommendation experience;
- Wendy's ability to explain what it used and why.

The intended experience is:

`query or need -> ranked content -> why it matters -> source/trust signal -> next action`

## Current Context

Relevant existing pieces:

- `apps/server/src/lib/global-search.ts` already searches sectors, roles,
  growth articles, news, and authenticated user data.
- `GET /api/search` still performs a separate lexical search for public content.
- `POST /api/search/hybrid` already wraps `globalSearch` and supports optional
  authentication.
- `POST /api/search/orchestrate` can stream a Wendy/Growth Agent response and
  accepts prefetched results.
- `apps/web/src/hooks/useGlobalSearch.ts` uses `/api/search/hybrid` for data
  results and `/api/search/suggest` for suggestions.
- `apps/web/src/components/search/SearchDialog.tsx` renders search results and
  can open a Wendy console beside them.
- `apps/web/src/components/search/WendySources.tsx` renders answer mode,
  context sources, reasoning depth, data strategy, and citations.
- `apps/server/src/routes/growth.ts` exposes growth categories, personalized
  "per te" articles, category filtering, search aliases, fallback articles, and
  article detail.
- `apps/web/src/pages/growth.tsx`, `crescita-categoria.tsx`, and
  `crescita-articolo.tsx` render the growth library.
- `packages/db/src/schema/appSearchIndex.ts` stores indexed app search content
  with metadata and optional embeddings.
- `packages/db/src/schema/growthArticles.ts` stores published growth articles
  with tags, difficulty, personality matches, sector links, and embeddings.
- `packages/ai-server/src/discovery-agent/growth-library-agent.ts` can curate
  and generate growth articles from discovery items.

The main gap is not the absence of search. The gap is that discovery surfaces
do not share one content contract. A user can see a result without knowing why
it is relevant, whether it is personalized, whether it came from the indexed
search or a fallback, and what they should do next.

## Recommended Approach

Build a unified content discovery layer rather than fixing each page in
isolation.

Why this approach:

- It improves search quality and content explanation together.
- It lets global search, Wendy, and the growth library reuse the same metadata.
- It keeps the first implementation slice small enough to test.
- It avoids making Wendy responsible for all discovery work. Wendy becomes a
  guide over the same evidence the UI can show.
- It preserves current routes and does not require a new database table in the
  first slice.

Alternatives considered:

- Growth-library-only improvement: faster, but leaves global search and Wendy
  disconnected.
- AI-first discovery: powerful, but more expensive and more fragile than making
  the deterministic search layer trustworthy first.
- Full search index rebuild: useful later, but too broad for the first slice.

## Unified Discovery Contract

Introduce a shared response shape for content shown in discovery surfaces.
This can live as TypeScript types and mapper utilities first; it does not need a
new table.

Each discovered item should expose:

```ts
type DiscoveryItemType =
  | "sector"
  | "role"
  | "article"
  | "news"
  | "idea"
  | "objective"
  | "calendar"
  | "certification"
  | "memory"
  | "workspace"
  | "profile";

type DiscoverySource = "index" | "live" | "library" | "fallback" | "wendy";

type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";

interface ContentDiscoveryResult {
  type: DiscoveryItemType;
  id: number;
  entityId?: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  scoreLexical: number;
  scoreSemantic: number | null;
  scoreTotal: number;
  source: DiscoverySource;
  sourceLabel: string;
  personalization: DiscoveryPersonalization;
  reasonLabels: string[];
  matchSignals: string[];
  actionLabel: string;
  visibility?: "public" | "private";
  metadata?: Record<string, unknown>;
}
```

This contract should be additive. Existing consumers can keep reading the old
fields while new UI reads the richer fields.

## Search Design

`globalSearch` becomes the canonical search path for app content. It should
continue to use the indexed table when available and live fallback when the
index is degraded or unavailable.

Changes:

- return the existing fields plus discovery metadata;
- derive `source` from the path used: `index` for `app_search_index`, `live` for
  direct database fallback;
- derive `sourceLabel` from type and path, for example "Indice NorthStar",
  "Catalogo ruoli", "Biblioteca crescita", "Contenuti personali";
- derive `reasonLabels` from lexical and semantic matches, content type, and
  metadata;
- keep `indexStatus` and `searchMode` visible to the frontend;
- keep private results scoped to the authenticated user.

Search should not hide degradation. If embeddings fail or pgvector is
unavailable, the response should still return keyword/live matches and mark the
state as `degraded` or `unavailable`.

## Growth Library Design

The growth library should behave as a real discovery surface, not only as a
static category browser.

### Growth Home

`/crescita` remains the hub. It should show:

- personalized or general "Per te" content;
- a search input backed by the server, not only client-side filtering;
- category entry points;
- recent or highlighted articles;
- clear labels when content is fallback/general rather than personalized.

### Growth Category

`/crescita/categoria/:cat` should query the server with:

- category;
- search text;
- difficulty;
- tags when selected;
- limit.

It should not filter only the articles currently loaded in the client. Empty
states should distinguish:

- no article matches the filters;
- the library has no published content yet;
- the API is unavailable;
- fallback content is being shown.

### Growth Cards

Growth cards should expose why the article is relevant:

- "Allineato al tuo profilo Investigativo";
- "Collegato al settore Data/AI";
- "Tema: produttivita";
- "Contenuto generale";
- "Fallback NorthStar" when applicable.

The card should keep the current title, description, tags, difficulty, and read
time, but add a compact reason row and source/trust label.

## Wendy Integration

Wendy should guide over the same discovery evidence rather than running a
separate hidden search path whenever possible.

Changes:

- `/api/search/orchestrate` should continue accepting prefetched results from
  `globalSearch`;
- the streamed answer can mention the strongest result reasons in natural
  language;
- `WendySources` should render labels that map to discovery sources and data
  strategy in user-facing terms;
- Wendy citations should prefer meaningful titles and URLs over generic chunk
  labels;
- when no indexed source was available, Wendy should be able to say it used a
  keyword or fallback path.

This design does not require Wendy to become the only search interface. The UI
must remain useful without the AI stream.

## Frontend Design

### Search Dialog

`SearchDialog` should become more explanatory without becoming heavier:

- keep the current command-dialog interaction;
- show top results first, grouped by type only after the best matches;
- show compact badges for source, personalization, and search mode;
- show one-line reason labels under important results;
- keep the "Chiedi a Wendy" action, but pass the current query and available
  result context;
- show a clear degraded-index badge when `indexStatus` is not `ready`.

The UI should not expose raw scoring details as the main explanation. Scores can
remain in data and tests; users should see readable reasons.

### Shared Components

Add small reusable presentation pieces rather than duplicating markup:

- a discovery source badge;
- a reason-label row;
- a compact action row for "Leggi", "Apri", "Chiedi a Wendy";
- optional metadata chips for difficulty, read time, and personalization.

These pieces should be usable in `SearchDialog` and growth cards.

## Backend And Data Flow

First slice data flow:

1. User enters a query in global search or growth search.
2. API normalizes query parameters using existing content-search helpers.
3. `globalSearch` or the growth route returns enriched discovery results.
4. Frontend renders title, description, source, reason labels, and next action.
5. If Wendy is opened, she receives the query plus the already retrieved
   result snapshot.

The first slice should avoid schema changes unless a test proves current
metadata is insufficient. Existing `app_search_index.metadata`,
`growth_articles.tags`, `personality_matches`, and `sector_links` are enough to
derive useful reasons.

## Error And Empty States

- If semantic search fails, return keyword/live results with
  `indexStatus: "degraded"` or `"unavailable"`.
- If global search finds nothing, show a Wendy action and a suggestion to use
  broader terms.
- If growth search has no matches but the library has published content, show
  an empty filter state.
- If the growth library has no published content, show fallback articles with a
  clear "contenuto generale" label.
- If fallback articles also do not match, show an honest empty state.
- If a user has no profile, "Per te" must say the selection is generic, not
  personalized.
- If a user has a profile but no matching articles, show the profile labels and
  invite them to browse all areas.

## Testing

Add focused coverage for:

- discovery mapper deriving source labels, personalization, reason labels, and
  action labels;
- `globalSearch` indexed rows returning enriched fields;
- `globalSearch` live fallback returning enriched fields and degraded status;
- growth list route accepting search aliases, category, difficulty, and limit;
- growth list route distinguishing `ok`, `empty`, `fallback`, and `error`;
- growth page rendering source/personalization labels;
- growth category performing server-side search instead of only client-side
  filtering;
- `SearchDialog` rendering source, reason labels, and degraded-index state;
- `WendySources` showing readable source and data-strategy labels.

## Out Of Scope For First Slice

- Rebuilding the whole app search indexing pipeline.
- Adding a new discovery database table.
- Replacing the current command-dialog UX with a new search page.
- Making Wendy mandatory for search.
- Full visual redesign of `/crescita`.
- Live web search for growth content beyond existing discovery agents.
- Persisted user feedback on every result.

## Implementation Slices

1. Add the discovery result types and mapper utilities.
2. Enrich `globalSearch` responses without breaking existing consumers.
3. Extend growth route filters and response metadata.
4. Update growth pages and cards to show source, personalization, and reasons.
5. Update `SearchDialog` to show source, reason labels, and index status.
6. Improve `WendySources` labels and pass richer context where already
   available.
7. Add tests for backend contracts and user-facing rendering.

## Success Criteria

- Search results explain why they are relevant, not only where they link.
- The user can tell whether a result came from the index, live fallback,
  library data, personal data, or fallback content.
- The growth library supports server-side search and filters inside categories.
- Personalized growth recommendations are clearly distinguished from generic
  recommendations.
- Wendy can cite and explain the same discovery evidence shown in the UI.
- Existing public browsing still works when the user is logged out.
- Search remains useful when semantic search is degraded or unavailable.
