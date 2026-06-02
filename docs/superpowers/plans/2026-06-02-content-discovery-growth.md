# Content Discovery And Growth Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first slice of unified content discovery so search results, Wendy sources, and growth-library cards explain source, relevance, personalization, and next action.

**Architecture:** Add small server-side discovery metadata helpers, enrich existing `globalSearch` and `/api/crescita` responses additively, then render those fields through reusable web presentation components. The first slice avoids database migrations and keeps current routes/API consumers compatible.

**Tech Stack:** TypeScript, Express, Drizzle ORM, React 19, Vite, TanStack Query, Vitest, Testing Library, lucide-react.

---

## File Structure

- Create `apps/server/src/lib/content-discovery.ts`
  - Pure server helper for discovery item types, source labels, action labels, personalization, and reason labels.
- Create `apps/server/src/lib/content-discovery.test.ts`
  - Unit tests for discovery helper behavior.
- Modify `apps/server/src/lib/global-search.ts`
  - Add discovery fields to `GlobalSearchResult` and call the helper for indexed and live fallback results.
- Create `apps/server/src/lib/global-search.test.ts`
  - Unit tests for indexed row enrichment and fallback enrichment with mocked DB/embedding behavior.
- Modify `apps/server/src/routes/growth.ts`
  - Add difficulty/tag filters, enrich growth article views with source/personalization/reasons/action label, preserve existing fallback states.
- Modify `apps/server/src/routes/growth.test.ts`
  - Add route-level coverage for difficulty filtering and discovery metadata.
- Create `apps/web/src/components/discovery/DiscoveryMeta.tsx`
  - Reusable source/reason/personalization badges for search and growth cards.
- Create `apps/web/src/components/discovery/DiscoveryMeta.test.tsx`
  - Rendering tests for the shared discovery UI.
- Modify `apps/web/src/hooks/useGlobalSearch.ts`
  - Add optional discovery metadata fields to `SearchResult`.
- Modify `apps/web/src/components/search/SearchDialog.tsx`
  - Render source, reason labels, personalization, and degraded index state on results.
- Modify `apps/web/src/components/search/SearchDialog.test.tsx`
  - Add coverage for source/reason badges and degraded index display.
- Modify `apps/web/src/components/search/WendySources.tsx`
  - Add labels for discovery-oriented source values and improve fallback citation display.
- Modify `apps/web/src/components/search/WendySources.test.tsx`
  - Add coverage for discovery source labels.
- Modify `apps/web/src/pages/growth.tsx`
  - Render discovery metadata in home growth cards and add a server-backed search panel.
- Modify `apps/web/src/pages/growth.test.tsx`
  - Add coverage for generic/fallback/profile metadata in growth cards.
- Modify `apps/web/src/pages/crescita-categoria.tsx`
  - Fetch server-side on search/difficulty changes and render discovery metadata.
- Create `apps/web/src/pages/crescita-categoria.test.tsx`
  - Test server-backed category search and empty states.

## Task 1: Server Discovery Metadata Helper

**Files:**
- Create: `apps/server/src/lib/content-discovery.ts`
- Create: `apps/server/src/lib/content-discovery.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `apps/server/src/lib/content-discovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildDiscoveryMetadata,
  type DiscoveryItemType,
} from "./content-discovery";

describe("content discovery metadata", () => {
  it("labels indexed public growth articles with readable source and reasons", () => {
    const meta = buildDiscoveryMetadata({
      type: "article",
      source: "index",
      visibility: "public",
      scoreLexical: 1,
      scoreSemantic: 0.82,
      metadata: {
        tags: ["focus", "produttivita"],
        personalityMatches: ["Investigativo"],
      },
    });

    expect(meta).toMatchObject({
      source: "index",
      sourceLabel: "Indice NorthStar",
      personalization: "generic",
      actionLabel: "Leggi",
    });
    expect(meta.reasonLabels).toEqual(
      expect.arrayContaining([
        "Match nel titolo o contenuto",
        "Match semantico",
        "Tema: focus",
        "Profilo: Investigativo",
      ]),
    );
    expect(meta.matchSignals).toEqual(expect.arrayContaining(["lexical", "semantic", "tag:focus"]));
  });

  it("labels private live results as personal content", () => {
    const meta = buildDiscoveryMetadata({
      type: "objective",
      source: "live",
      visibility: "private",
      scoreLexical: 0.65,
      scoreSemantic: null,
      metadata: { category: "carriera" },
    });

    expect(meta).toMatchObject({
      sourceLabel: "Contenuti personali",
      personalization: "private",
      actionLabel: "Apri",
    });
    expect(meta.reasonLabels).toEqual(expect.arrayContaining(["Dati del tuo profilo"]));
  });

  it("returns stable labels for every supported type", () => {
    const types: DiscoveryItemType[] = [
      "sector",
      "role",
      "article",
      "news",
      "idea",
      "objective",
      "calendar",
      "certification",
      "memory",
      "workspace",
      "profile",
    ];

    for (const type of types) {
      const meta = buildDiscoveryMetadata({
        type,
        source: "live",
        visibility: "public",
        scoreLexical: 0,
        scoreSemantic: null,
        metadata: {},
      });

      expect(meta.sourceLabel.length).toBeGreaterThan(0);
      expect(meta.reasonLabels.length).toBeGreaterThan(0);
      expect(meta.actionLabel.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the helper tests to verify RED**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/lib/content-discovery.test.ts --configLoader runner
```

Expected: FAIL because `apps/server/src/lib/content-discovery.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/server/src/lib/content-discovery.ts`:

```ts
import type { GlobalSearchEntityType } from "./global-search";

export type DiscoveryItemType = GlobalSearchEntityType;
export type DiscoverySource = "index" | "live" | "library" | "fallback" | "wendy";
export type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";

export interface DiscoveryMetadataInput {
  type: DiscoveryItemType;
  source: DiscoverySource;
  visibility?: "public" | "private";
  scoreLexical: number;
  scoreSemantic: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface DiscoveryMetadata {
  source: DiscoverySource;
  sourceLabel: string;
  personalization: DiscoveryPersonalization;
  reasonLabels: string[];
  matchSignals: string[];
  actionLabel: string;
}

const PUBLIC_SOURCE_LABELS: Record<DiscoverySource, string> = {
  index: "Indice NorthStar",
  live: "Catalogo NorthStar",
  library: "Biblioteca crescita",
  fallback: "Percorso generale NorthStar",
  wendy: "Wendy",
};

const TYPE_SOURCE_LABELS: Partial<Record<DiscoveryItemType, string>> = {
  sector: "Catalogo settori",
  role: "Catalogo ruoli",
  article: "Biblioteca crescita",
  news: "Notizie NorthStar",
};

const ACTION_LABELS: Record<DiscoveryItemType, string> = {
  sector: "Esplora",
  role: "Apri ruolo",
  article: "Leggi",
  news: "Leggi",
  idea: "Apri",
  objective: "Apri",
  calendar: "Apri",
  certification: "Apri",
  memory: "Apri",
  workspace: "Apri",
  profile: "Apri",
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildDiscoveryMetadata(input: DiscoveryMetadataInput): DiscoveryMetadata {
  const metadata = input.metadata ?? {};
  const tags = stringArray(metadata.tags);
  const personalityMatches = stringArray(metadata.personalityMatches);
  const sectorLinks = stringArray(metadata.sectorLinks);
  const category = firstString(metadata.category);
  const isPrivate = input.visibility === "private";
  const sourceLabel = isPrivate
    ? "Contenuti personali"
    : input.source === "live"
      ? TYPE_SOURCE_LABELS[input.type] ?? PUBLIC_SOURCE_LABELS.live
      : PUBLIC_SOURCE_LABELS[input.source];

  const reasonLabels: string[] = [];
  const matchSignals: string[] = [];

  if (input.scoreLexical > 0) {
    reasonLabels.push("Match nel titolo o contenuto");
    matchSignals.push("lexical");
  }
  if (input.scoreSemantic != null && input.scoreSemantic > 0) {
    reasonLabels.push("Match semantico");
    matchSignals.push("semantic");
  }
  if (isPrivate) {
    reasonLabels.push("Dati del tuo profilo");
    matchSignals.push("private");
  }
  if (category) {
    reasonLabels.push(`Categoria: ${category}`);
    matchSignals.push(`category:${category}`);
  }
  for (const tag of tags.slice(0, 2)) {
    reasonLabels.push(`Tema: ${tag}`);
    matchSignals.push(`tag:${tag}`);
  }
  for (const match of personalityMatches.slice(0, 2)) {
    reasonLabels.push(`Profilo: ${match}`);
    matchSignals.push(`personality:${match}`);
  }
  for (const sector of sectorLinks.slice(0, 2)) {
    reasonLabels.push(`Settore: ${sector}`);
    matchSignals.push(`sector:${sector}`);
  }
  if (input.source === "fallback") {
    reasonLabels.push("Contenuto generale");
    matchSignals.push("fallback");
  }
  if (reasonLabels.length === 0) {
    reasonLabels.push(TYPE_SOURCE_LABELS[input.type] ?? "Contenuto NorthStar");
  }

  return {
    source: input.source,
    sourceLabel,
    personalization: isPrivate ? "private" : personalityMatches.length > 0 ? "profile" : "generic",
    reasonLabels: Array.from(new Set(reasonLabels)).slice(0, 4),
    matchSignals: Array.from(new Set(matchSignals)),
    actionLabel: ACTION_LABELS[input.type],
  };
}
```

- [ ] **Step 4: Run helper tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/lib/content-discovery.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/server/src/lib/content-discovery.ts apps/server/src/lib/content-discovery.test.ts
git commit -m "feat(search): add content discovery metadata helper"
```

## Task 2: Enrich Global Search Results

**Files:**
- Modify: `apps/server/src/lib/global-search.ts`
- Create: `apps/server/src/lib/global-search.test.ts`

- [ ] **Step 1: Write failing global search tests**

Create `apps/server/src/lib/global-search.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));

const embeddingMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return { ...actual, db: dbMock };
});

vi.mock("@workspace/ai-server/embeddings/generate", () => ({
  generateEmbedding: embeddingMock,
}));

import { globalSearch } from "./global-search";

function selectRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  dbMock.select.mockReturnValueOnce(chain);
}

describe("globalSearch discovery metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);
    dbMock.execute.mockReset();
    dbMock.select.mockReset();
  });

  it("adds discovery metadata to indexed results", async () => {
    dbMock.execute.mockResolvedValue({
      rows: [
        {
          id: 9,
          entity_type: "article",
          entity_id: "42",
          user_id: null,
          title: "Routine di focus",
          content: "Allenare focus e produttivita",
          url: "/crescita/articolo/routine-focus",
          visibility: "public",
          metadata: { tags: ["focus"], personalityMatches: ["Investigativo"] },
          score_lexical: 1,
          score_semantic: 0.81,
          score_total: 1.81,
        },
      ],
    });

    const response = await globalSearch({ query: "focus", limit: 5 });

    expect(response).toMatchObject({
      has_semantic: true,
      searchMode: "semantic",
      indexStatus: "ready",
    });
    expect(response.results[0]).toMatchObject({
      type: "article",
      source: "index",
      sourceLabel: "Indice NorthStar",
      personalization: "profile",
      actionLabel: "Leggi",
    });
    expect(response.results[0].reasonLabels).toEqual(expect.arrayContaining(["Match semantico", "Tema: focus"]));
  });

  it("adds live fallback metadata when the index has no rows", async () => {
    dbMock.execute.mockResolvedValue({ rows: [] });
    selectRows([
      {
        id: 1,
        title: "Data Science",
        description: "Settore dati",
        icon: null,
        color: null,
      },
    ]);
    selectRows([]);
    selectRows([]);
    selectRows([]);

    const response = await globalSearch({ query: "data", limit: 5, types: ["sector"] });

    expect(response).toMatchObject({
      has_semantic: false,
      searchMode: "hybrid",
      indexStatus: "degraded",
    });
    expect(response.results[0]).toMatchObject({
      type: "sector",
      source: "live",
      sourceLabel: "Catalogo settori",
      personalization: "generic",
      actionLabel: "Esplora",
    });
  });
});
```

- [ ] **Step 2: Run global search tests to verify RED**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/lib/global-search.test.ts --configLoader runner
```

Expected: FAIL because `GlobalSearchResult` lacks discovery fields and `globalSearch` does not call `buildDiscoveryMetadata`.

- [ ] **Step 3: Update global search types and mappers**

Modify `apps/server/src/lib/global-search.ts`:

```ts
import {
  buildDiscoveryMetadata,
  type DiscoveryPersonalization,
  type DiscoverySource,
} from "./content-discovery";
```

Extend `GlobalSearchResult`:

```ts
  source: DiscoverySource;
  sourceLabel: string;
  personalization: DiscoveryPersonalization;
  reasonLabels: string[];
  matchSignals: string[];
  actionLabel: string;
```

Replace the `result` helper body with:

```ts
function result(
  input: Omit<
    GlobalSearchResult,
    | "score_lexical"
    | "score_semantic"
    | "score_total"
    | "source"
    | "sourceLabel"
    | "personalization"
    | "reasonLabels"
    | "matchSignals"
    | "actionLabel"
  > & {
    lexicalRaw: number;
    source?: DiscoverySource;
  },
): GlobalSearchResult {
  const score_lexical = normalizeLexical(input.lexicalRaw);
  const discovery = buildDiscoveryMetadata({
    type: input.type,
    source: input.source ?? "live",
    visibility: input.visibility,
    scoreLexical: score_lexical,
    scoreSemantic: null,
    metadata: input.metadata,
  });
  return {
    ...input,
    ...discovery,
    score_lexical,
    score_semantic: null,
    score_total: score_lexical,
  };
}
```

When mapping indexed rows inside `globalSearch`, compute discovery metadata:

```ts
          const discovery = buildDiscoveryMetadata({
            type: row.entity_type,
            source: "index",
            visibility: row.visibility,
            scoreLexical: row.score_lexical ?? 0,
            scoreSemantic: row.score_semantic,
            metadata: row.metadata ?? {},
          });
          return {
            type: row.entity_type,
            id: Number(row.entity_id) || row.id,
            entityId: row.entity_id,
            title: row.title,
            description: row.content,
            url: row.url,
            icon: meta.icon,
            color: meta.color,
            score_lexical: row.score_lexical ?? 0,
            score_semantic: row.score_semantic,
            score_total: row.score_total ?? 0,
            visibility: row.visibility,
            metadata: row.metadata ?? {},
            ...discovery,
          };
```

Pass metadata into live article/news results where available:

```ts
          metadata: {
            tags: row.tags ?? [],
            personalityMatches: row.personalityMatches ?? [],
            sectorLinks: row.sectorLinks ?? [],
          },
```

For news:

```ts
          metadata: {
            category: row.category,
            source: row.source,
            sectorLinks: row.sectorNames ?? [],
          },
```

- [ ] **Step 4: Run global search tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/lib/content-discovery.test.ts src/lib/global-search.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/server/src/lib/global-search.ts apps/server/src/lib/global-search.test.ts
git commit -m "feat(search): enrich global results with discovery metadata"
```

## Task 3: Extend Growth Route Filters And Metadata

**Files:**
- Modify: `apps/server/src/routes/growth.ts`
- Modify: `apps/server/src/routes/growth.test.ts`

- [ ] **Step 1: Write failing growth route tests**

Append to `apps/server/src/routes/growth.test.ts`:

```ts
  it("adds discovery metadata to growth list articles", async () => {
    mockSelectRows(articles);

    const response = await request(app())
      .get("/api/crescita?search=focus&limit=6")
      .expect(200);

    expect(response.body.articles[0]).toMatchObject({
      source: "library",
      sourceLabel: "Biblioteca crescita",
      personalization: "profile",
      actionLabel: "Leggi",
    });
    expect(response.body.articles[0].reasonLabels).toEqual(expect.arrayContaining(["Tema: focus", "Profilo: I"]));
  });

  it("accepts difficulty and tag filters without falling back when the library has matches", async () => {
    mockSelectRows(articles);

    const response = await request(app())
      .get("/api/crescita?category=produttivita&difficulty=base&tag=focus&limit=6")
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      status: "ok",
      source: "library",
    });
    expect(response.body.articles[0]).toMatchObject({
      difficulty: "base",
      tags: ["focus"],
    });
  });
```

- [ ] **Step 2: Run growth route tests to verify RED**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/growth.test.ts --configLoader runner
```

Expected: FAIL because growth articles do not include discovery metadata and route filters do not parse `difficulty`/`tag`.

- [ ] **Step 3: Enrich `mapArticle` and parse filters**

Modify imports in `apps/server/src/routes/growth.ts`:

```ts
import { buildDiscoveryMetadata, type DiscoveryPersonalization } from "../lib/content-discovery";
```

Update `mapArticle` signature and body:

```ts
function mapArticle(
  article: typeof growthArticlesTable.$inferSelect | GrowthArticleView,
  options: { personalization?: DiscoveryPersonalization } = {},
) {
  const source: GrowthSource = "source" in article ? article.source ?? "library" : "library";
  const discovery = buildDiscoveryMetadata({
    type: "article",
    source,
    visibility: "public",
    scoreLexical: 1,
    scoreSemantic: article.embedding ? 0.75 : null,
    metadata: {
      category: article.category,
      tags: article.tags ?? [],
      personalityMatches: article.personalityMatches ?? [],
      sectorLinks: article.sectorLinks ?? [],
    },
  });

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    subcategory: article.subcategory,
    description: article.description,
    content: article.content,
    tags: article.tags ?? [],
    difficulty: article.difficulty,
    personalityMatches: article.personalityMatches ?? [],
    sectorLinks: article.sectorLinks ?? [],
    readTimeMinutes: article.readTimeMinutes,
    viewCount: article.viewCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    source,
    sourceLabel: discovery.sourceLabel,
    personalization: options.personalization ?? discovery.personalization,
    reasonLabels: discovery.reasonLabels,
    matchSignals: discovery.matchSignals,
    actionLabel: discovery.actionLabel,
  };
}
```

In `GET /api/crescita`, parse filters:

```ts
    const difficulty =
      typeof req.query.difficulty === "string" && req.query.difficulty !== "all"
        ? req.query.difficulty
        : "";
    const tag =
      typeof req.query.tag === "string" && req.query.tag.trim().length > 0
        ? req.query.tag.trim()
        : "";
```

Add filter conditions:

```ts
      difficulty ? eq(growthArticlesTable.difficulty, difficulty) : undefined,
      tag ? sql`${growthArticlesTable.tags}::text ILIKE ${`%${tag}%`}` : undefined,
```

Update response mappers:

```ts
articles: articles.map((article) => mapArticle(article)),
```

For fallback/personalized generic paths, pass explicit personalization:

```ts
articles: fallbackArticles.map((article) => mapArticle(article, { personalization: "generic" })),
```

- [ ] **Step 4: Run growth route tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/growth.test.ts src/routes/content-search-contract.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/server/src/routes/growth.ts apps/server/src/routes/growth.test.ts
git commit -m "feat(growth): expose discovery metadata and filters"
```

## Task 4: Shared Web Discovery Metadata UI

**Files:**
- Create: `apps/web/src/components/discovery/DiscoveryMeta.tsx`
- Create: `apps/web/src/components/discovery/DiscoveryMeta.test.tsx`
- Modify: `apps/web/src/hooks/useGlobalSearch.ts`

- [ ] **Step 1: Write failing component tests**

Create `apps/web/src/components/discovery/DiscoveryMeta.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscoveryMeta } from "./DiscoveryMeta";

describe("DiscoveryMeta", () => {
  it("renders source, personalization and reason labels compactly", () => {
    render(
      <DiscoveryMeta
        sourceLabel="Biblioteca crescita"
        personalization="profile"
        reasonLabels={["Profilo: Investigativo", "Tema: focus"]}
      />,
    );

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(screen.getByText("Profilo: Investigativo")).toBeInTheDocument();
    expect(screen.getByText("Tema: focus")).toBeInTheDocument();
  });

  it("labels fallback content as general", () => {
    render(
      <DiscoveryMeta
        sourceLabel="Percorso generale NorthStar"
        personalization="generic"
        reasonLabels={["Contenuto generale"]}
      />,
    );

    expect(screen.getByText("Generale")).toBeInTheDocument();
    expect(screen.getByText("Contenuto generale")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/discovery/DiscoveryMeta.test.tsx --configLoader runner
```

Expected: FAIL because `DiscoveryMeta.tsx` does not exist.

- [ ] **Step 3: Implement shared component and frontend type fields**

Create `apps/web/src/components/discovery/DiscoveryMeta.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";

interface DiscoveryMetaProps {
  sourceLabel?: string;
  personalization?: DiscoveryPersonalization;
  reasonLabels?: string[];
  className?: string;
}

const PERSONALIZATION_LABELS: Record<DiscoveryPersonalization, string> = {
  profile: "Personalizzato",
  journey: "Percorso",
  generic: "Generale",
  private: "Privato",
};

export function DiscoveryMeta({
  sourceLabel,
  personalization = "generic",
  reasonLabels = [],
  className,
}: DiscoveryMetaProps) {
  const visibleReasons = reasonLabels.slice(0, 3);

  if (!sourceLabel && visibleReasons.length === 0) return null;

  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", className)}>
      {sourceLabel && (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {sourceLabel}
        </span>
      )}
      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
        {PERSONALIZATION_LABELS[personalization]}
      </span>
      {visibleReasons.map((reason) => (
        <span
          key={reason}
          className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {reason}
        </span>
      ))}
    </div>
  );
}
```

Extend `SearchResult` in `apps/web/src/hooks/useGlobalSearch.ts`:

```ts
  source?: "index" | "live" | "library" | "fallback" | "wendy";
  sourceLabel?: string;
  personalization?: "profile" | "journey" | "generic" | "private";
  reasonLabels?: string[];
  matchSignals?: string[];
  actionLabel?: string;
```

- [ ] **Step 4: Run component tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/discovery/DiscoveryMeta.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/web/src/components/discovery/DiscoveryMeta.tsx apps/web/src/components/discovery/DiscoveryMeta.test.tsx apps/web/src/hooks/useGlobalSearch.ts
git commit -m "feat(web): add discovery metadata presentation"
```

## Task 5: Render Discovery Metadata In SearchDialog

**Files:**
- Modify: `apps/web/src/components/search/SearchDialog.tsx`
- Modify: `apps/web/src/components/search/SearchDialog.test.tsx`

- [ ] **Step 1: Write failing SearchDialog tests**

Append to `apps/web/src/components/search/SearchDialog.test.tsx`:

```tsx
  it("renders discovery source and reasons for search results", () => {
    renderDialog({
      query: "focus",
      results: [
        {
          id: 1,
          type: "article",
          title: "Routine di focus",
          description: "Una guida pratica",
          url: "/crescita/articolo/routine-focus",
          icon: "book-open-text",
          color: "#f59e0b",
          sourceLabel: "Biblioteca crescita",
          personalization: "profile",
          reasonLabels: ["Profilo: Investigativo", "Tema: focus"],
        },
      ],
    });

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(screen.getByText("Profilo: Investigativo")).toBeInTheDocument();
  });

  it("shows degraded index state in the result shell", () => {
    renderDialog({
      query: "focus",
      indexStatus: "degraded",
      searchMode: "hybrid",
      results: [
        {
          id: 1,
          type: "article",
          title: "Routine di focus",
          description: "Una guida pratica",
          url: "/crescita/articolo/routine-focus",
          icon: "book-open-text",
          color: "#f59e0b",
        },
      ],
    });

    expect(screen.getByText("indice degraded")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run SearchDialog tests to verify RED**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/search/SearchDialog.test.tsx --configLoader runner
```

Expected: FAIL because `SearchDialog` does not render discovery metadata.

- [ ] **Step 3: Render `DiscoveryMeta` in both result layouts**

Add import:

```tsx
import { DiscoveryMeta } from "@/components/discovery/DiscoveryMeta";
```

In compact side results and normal result lists, after the description span add:

```tsx
                                    <DiscoveryMeta
                                      sourceLabel={item.sourceLabel}
                                      personalization={item.personalization}
                                      reasonLabels={item.reasonLabels}
                                      className="mt-1"
                                    />
```

For normal list items, add the same block after the description:

```tsx
                                  <DiscoveryMeta
                                    sourceLabel={item.sourceLabel}
                                    personalization={item.personalization}
                                    reasonLabels={item.reasonLabels}
                                    className="mt-1"
                                  />
```

Keep existing index status badge unchanged so the test can find `indice degraded`.

- [ ] **Step 4: Run SearchDialog tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/search/SearchDialog.test.tsx src/components/discovery/DiscoveryMeta.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/web/src/components/search/SearchDialog.tsx apps/web/src/components/search/SearchDialog.test.tsx
git commit -m "feat(search): show discovery context in search dialog"
```

## Task 6: Render Discovery Metadata In Growth Pages

**Files:**
- Modify: `apps/web/src/pages/growth.tsx`
- Modify: `apps/web/src/pages/growth.test.tsx`
- Modify: `apps/web/src/pages/crescita-categoria.tsx`
- Create: `apps/web/src/pages/crescita-categoria.test.tsx`

- [ ] **Step 1: Write failing growth page tests**

Append to `apps/web/src/pages/growth.test.tsx`:

```tsx
  it("shows discovery metadata for profile-matched growth cards", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) return Promise.resolve([]);
      if (url.includes("api/crescita/per-te")) {
        return Promise.resolve({
          articles: [
            {
              id: 1,
              title: "Routine di focus",
              slug: "routine-focus",
              category: "produttivita",
              description: "Una guida pratica.",
              tags: ["focus"],
              difficulty: "base",
              readTimeMinutes: 5,
              sourceLabel: "Biblioteca crescita",
              personalization: "profile",
              reasonLabels: ["Profilo: Investigativo", "Tema: focus"],
            },
          ],
          hasProfile: true,
          personalization: "profile",
          types: ["I"],
        });
      }
      if (url.includes("api/crescita?limit=6")) return Promise.resolve({ articles: [] });
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderGrowth();

    expect(await screen.findByText("Routine di focus")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(screen.getByText("Profilo: Investigativo")).toBeInTheDocument();
  });
```

Create `apps/web/src/pages/crescita-categoria.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrescitaCategoria from "./crescita-categoria";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({ getJson: getJsonMock }));
vi.mock("@/lib/seo", () => ({ usePageMeta: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useParams: () => ({ cat: "produttivita" }),
}));

function renderCategory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CrescitaCategoria />
    </QueryClientProvider>,
  );
}

describe("CrescitaCategoria discovery search", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("requests server-side search when the query changes", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) {
        return Promise.resolve([
          { id: "produttivita", label: "Produttivita", icon: "*", description: "Focus", count: 1 },
        ]);
      }
      if (url.includes("api/crescita?")) {
        return Promise.resolve({
          articles: [
            {
              id: 1,
              title: "Routine di focus",
              slug: "routine-focus",
              category: "produttivita",
              description: "Guida",
              tags: ["focus"],
              difficulty: "base",
              readTimeMinutes: 5,
              viewCount: 0,
              sourceLabel: "Biblioteca crescita",
              personalization: "generic",
              reasonLabels: ["Tema: focus"],
            },
          ],
          total: 1,
        });
      }
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderCategory();

    expect(await screen.findByText("Routine di focus")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Cerca articoli..."), {
      target: { value: "leadership" },
    });

    await waitFor(() => {
      expect(getJsonMock).toHaveBeenCalledWith(expect.stringContaining("search=leadership"));
    });
    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Tema: focus")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run growth web tests to verify RED**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/growth.test.tsx src/pages/crescita-categoria.test.tsx --configLoader runner
```

Expected: FAIL because growth cards do not render discovery metadata and category search is still client-side.

- [ ] **Step 3: Update growth article types and cards**

In `apps/web/src/pages/growth.tsx`, import `DiscoveryMeta`:

```tsx
import { DiscoveryMeta, type DiscoveryPersonalization } from "@/components/discovery/DiscoveryMeta";
```

Extend `Article`:

```ts
  sourceLabel?: string;
  personalization?: DiscoveryPersonalization;
  reasonLabels?: string[];
```

Inside `ArticleCard`, after description and before tags:

```tsx
        <DiscoveryMeta
          sourceLabel={article.sourceLabel}
          personalization={article.personalization}
          reasonLabels={article.reasonLabels}
        />
```

In `apps/web/src/pages/crescita-categoria.tsx`, import `DiscoveryMeta` and extend `Article` with the same optional fields. Add the same `DiscoveryMeta` block inside `ArticleCard`.

- [ ] **Step 4: Switch category page to server-backed search/filtering**

In `apps/web/src/pages/crescita-categoria.tsx`, update query key and URL:

```tsx
  const { data, isLoading } = useQuery<{ articles: Article[]; total: number; status?: string; source?: string }>({
    queryKey: ["crescita", cat, search, diffFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        category: cat ?? "",
        limit: "50",
      });
      if (search.trim()) params.set("search", search.trim());
      if (diffFilter !== "all") params.set("difficulty", diffFilter);
      return getJson<{ articles: Article[]; total: number; status?: string; source?: string }>(
        `${BASE}api/crescita?${params.toString()}`,
      );
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!cat,
  });
```

Remove local title/tag filtering from `filtered`:

```tsx
  const filtered = allArticles;
```

Keep tag buttons setting `search` so selected tags become server-side searches.

- [ ] **Step 5: Run growth web tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/growth.test.tsx src/pages/crescita-categoria.test.tsx src/components/discovery/DiscoveryMeta.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/web/src/pages/growth.tsx apps/web/src/pages/growth.test.tsx apps/web/src/pages/crescita-categoria.tsx apps/web/src/pages/crescita-categoria.test.tsx
git commit -m "feat(growth): show discovery context in library"
```

## Task 7: Improve Wendy Source Labels For Discovery Context

**Files:**
- Modify: `apps/web/src/components/search/WendySources.tsx`
- Modify: `apps/web/src/components/search/WendySources.test.tsx`

- [ ] **Step 1: Write failing WendySources test**

Append to `apps/web/src/components/search/WendySources.test.tsx`:

```tsx
  it("renders discovery-oriented source labels", () => {
    render(
      <WendySources
        message={message({
          contextSources: ["growth-library", "search-index", "keyword-fallback"],
        })}
      />,
    );

    expect(screen.getByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Indice NorthStar")).toBeInTheDocument();
    expect(screen.getByText("Ricerca keyword")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run WendySources test to verify RED**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/search/WendySources.test.tsx --configLoader runner
```

Expected: FAIL because these source keys fall through to raw labels.

- [ ] **Step 3: Add Wendy source labels**

Extend `SOURCE_LABELS` in `apps/web/src/components/search/WendySources.tsx`:

```ts
  "growth-library":  { key: "wendy.sources.context.growthLibrary", source: "Biblioteca crescita" },
  "search-index":    { key: "wendy.sources.context.searchIndex", source: "Indice NorthStar" },
  "keyword-fallback":{ key: "wendy.sources.context.keywordFallback", source: "Ricerca keyword" },
```

- [ ] **Step 4: Run WendySources tests to verify GREEN**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/search/WendySources.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add apps/web/src/components/search/WendySources.tsx apps/web/src/components/search/WendySources.test.tsx
git commit -m "feat(wendy): label discovery sources"
```

## Task 8: Verification Pass

**Files:**
- No new files.
- Verify all files modified by Tasks 1-7.

- [ ] **Step 1: Run focused server tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/lib/content-discovery.test.ts src/lib/global-search.test.ts src/routes/growth.test.ts src/routes/content-search-contract.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/discovery/DiscoveryMeta.test.tsx src/components/search/SearchDialog.test.tsx src/components/search/WendySources.test.tsx src/pages/growth.test.tsx src/pages/crescita-categoria.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 3: Run package typechecks**

Run:

```bash
pnpm --filter @northstar/server run typecheck
pnpm --filter @northstar/web run typecheck
```

Expected: both commands PASS.

- [ ] **Step 4: Inspect git diff for unrelated changes**

Run:

```bash
git status --short
git diff -- apps/server/src/lib/content-discovery.ts apps/server/src/lib/global-search.ts apps/server/src/routes/growth.ts apps/web/src/components/discovery/DiscoveryMeta.tsx apps/web/src/components/search/SearchDialog.tsx apps/web/src/components/search/WendySources.tsx apps/web/src/pages/growth.tsx apps/web/src/pages/crescita-categoria.tsx
```

Expected: diff only contains the planned discovery/search/growth changes. Existing unrelated dirty files may remain in `git status`; do not revert them.

- [ ] **Step 5: Commit verification fixes if needed**

If verification required small fixes, commit only files touched by this plan:

```bash
git add apps/server/src/lib/content-discovery.ts apps/server/src/lib/content-discovery.test.ts apps/server/src/lib/global-search.ts apps/server/src/lib/global-search.test.ts apps/server/src/routes/growth.ts apps/server/src/routes/growth.test.ts apps/web/src/components/discovery/DiscoveryMeta.tsx apps/web/src/components/discovery/DiscoveryMeta.test.tsx apps/web/src/hooks/useGlobalSearch.ts apps/web/src/components/search/SearchDialog.tsx apps/web/src/components/search/SearchDialog.test.tsx apps/web/src/components/search/WendySources.tsx apps/web/src/components/search/WendySources.test.tsx apps/web/src/pages/growth.tsx apps/web/src/pages/growth.test.tsx apps/web/src/pages/crescita-categoria.tsx apps/web/src/pages/crescita-categoria.test.tsx
git commit -m "fix(discovery): complete verification fixes"
```

Expected: commit created only if fixes were necessary.

## Self-Review

Spec coverage:

- Unified discovery contract: Tasks 1, 2, and 4.
- Search result enrichment and degraded state: Tasks 2 and 5.
- Growth server-side filters and metadata: Tasks 3 and 6.
- Wendy source explanation: Task 7.
- Tests and verification: Tasks 1-8.

Completion-token scan:

- The plan contains no unresolved markers, no open-ended implementation gaps, and no step that says only to "add tests" without concrete test content.

Type consistency:

- Server fields use `sourceLabel`, `personalization`, `reasonLabels`, `matchSignals`, and `actionLabel`.
- Web `SearchResult` uses the same optional field names.
- UI component accepts `sourceLabel`, `personalization`, and `reasonLabels`.
