# Sector Role Job Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified decision flow where users choose a sector, choose a target role, deepen that role, and open local company prospects plus matching market-backed jobs.

**Architecture:** Keep existing routes, but make them behave as one flow. `/settori` starts the decision, `/settore/:id` promotes roles, `/ruolo/:id` becomes the role commitment page, and `/lavori` consumes explicit `professionId`, `sectorId`, and local company context through `/api/jobs` plus `/api/jobs/company-prospects`.

**Tech Stack:** React 19, Vite, Wouter, TanStack Query, Vitest, Express 5-style routes on Express 4 runtime, Drizzle ORM, TypeScript.

---

## File Structure

- Modify `apps/server/src/routes/jobs.ts`: add query parsing, role/sector filtering, fallback metadata, and new response fields.
- Modify `apps/server/src/routes/jobs.test.ts`: prove role filters, sector fallback, and store contract.
- Create `apps/server/src/services/company-prospects.ts`: define the company prospect contract, provider interface, profile-city lookup, web-search provider, dedupe, and ranking helpers.
- Create `apps/server/src/services/company-prospects.test.ts`: prove city handling, provider fallback, dedupe, and source-linked prospect mapping.
- Modify `apps/server/src/routes/jobs.ts`: add `GET /api/jobs/company-prospects` before `/:id`, inject the company prospect service into `createJobsRouter`, and keep auth/error handling local to the jobs route.
- Modify `apps/server/src/routes/jobs.test.ts`: prove the company prospect route uses profile city, validates inputs, returns `city_required`, and returns `not_configured` when the provider is unavailable.
- Modify `apps/web/src/pages/lavori.tsx`: read `professionId`, `sectorId`, and `city` from the URL, include them in API calls, render local company prospects first, and render contextual headings/fallback copy.
- Create `apps/web/src/pages/lavori.test.tsx`: verify role-specific jobs UI, local company prospect UI, fallback UI, generic UI, and auth gate.
- Modify `apps/web/src/pages/ruolo.tsx`: add a decision rail and primary "Trova aziende e lavori per questo ruolo" CTAs.
- Create `apps/web/src/pages/ruolo.test.tsx`: verify role-to-jobs link generation with profession and sector context.
- Modify `apps/web/src/pages/settori.tsx`: update copy and sector links to point toward role choice.
- Modify `apps/web/src/pages/settori.test.tsx`: verify copy and links.
- Modify `apps/web/src/pages/sector.tsx`: make roles an early decision section with CTAs and anchor target.
- Create or modify `apps/web/src/pages/sector.test.tsx`: verify promoted role choice CTAs.
- Modify `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`: change next-action copy for the sector exploration phase.
- Modify `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`: update expectations.
- Modify `apps/web/src/components/dashboard/DashboardWendyPrompts.tsx`: update phase prompt to include sector plus role.
- Modify `apps/web/src/components/dashboard/DashboardWendyPrompts.test.tsx`: update prompt assertions.
- Modify `apps/web/src/components/dashboard/JourneyToolsSection.tsx`: update tool title/copy for the unified decision.
- Modify `apps/web/src/features/compass/BussolaHome.tsx`: update Sperimenta tool copy so sector and role exploration read as one arc.

---

### Task 1: Extend Jobs API Contract

**Files:**
- Modify: `apps/server/src/routes/jobs.test.ts`
- Modify: `apps/server/src/routes/jobs.ts`

- [ ] **Step 1: Write failing route tests for explicit role and sector context**

Append these tests inside `describe("jobs routes", () => { ... })` in `apps/server/src/routes/jobs.test.ts` before the read-only write test:

```ts
  it("passes explicit profession and sector filters to the jobs store", async () => {
    const store: JobsStore = {
      list: vi.fn().mockResolvedValue(feed({
        basedOnProfession: "Product Designer",
        basedOnSector: "Design & UX",
        filter: { professionId: 55, sectorId: 2, fallback: null },
      })),
      find: vi.fn(),
    };

    const response = await request(app(store))
      .get("/api/jobs?professionId=55&sectorId=2")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(store.list).toHaveBeenCalledWith(42, { professionId: 55, sectorId: 2 });
    expect(response.body).toMatchObject({
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });
  });

  it("rejects invalid explicit job filters", async () => {
    const response = await request(app())
      .get("/api/jobs?professionId=-1&sectorId=abc")
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);

    expect(response.body).toEqual({
      error: "Filtri lavoro non validi",
      code: "INVALID_JOB_FILTERS",
      details: {
        professionId: ["Deve essere un intero positivo."],
        sectorId: ["Deve essere un intero positivo."],
      },
    });
  });
```

Also update the imports at the top of the test file only if TypeScript asks for additional types after the implementation.

- [ ] **Step 2: Run the failing API tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: FAIL because `JobsStore.list` does not accept filter context and the route does not validate query params yet.

- [ ] **Step 3: Update jobs types and memory store**

In `apps/server/src/routes/jobs.ts`, replace the `JobsFeedResponse` and `JobsStore` interfaces with:

```ts
export interface JobsFilterContext {
  professionId?: number;
  sectorId?: number;
}

export interface JobsFeedResponse {
  jobs: JobCardRecord[];
  basedOnProfession: string | null;
  basedOnSector: string | null;
  totalCount: number;
  status: "ok" | "empty" | "not_configured";
  reason?: string;
  action?: string;
  personalized: boolean;
  source: "job_posting_snapshots";
  period: string | null;
  filter: {
    professionId: number | null;
    sectorId: number | null;
    fallback: "sector" | null;
  };
}

export interface JobsStore {
  list(userId: number, filters?: JobsFilterContext): Promise<JobsFeedResponse>;
  find(id: number, userId: number): Promise<JobCardRecord | null>;
}
```

Update `createMemoryJobsStore` in the same file:

```ts
export function createMemoryJobsStore(response: JobsFeedResponse): JobsStore {
  return {
    async list() {
      return response;
    },
    async find(id) {
      return response.jobs.find((job) => job.id === id) ?? null;
    },
  };
}
```

Update the `JOBS_NOT_CONFIGURED` fallback response inside the route catch block to include:

```ts
          basedOnProfession: null,
          filter: { professionId: null, sectorId: null, fallback: null },
```

- [ ] **Step 4: Add query parsing to the route**

Add this helper above `createDbJobsStore()` in `apps/server/src/routes/jobs.ts`:

```ts
function parsePositiveIntQuery(value: unknown): number | undefined | null {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === String(value) ? parsed : null;
}

function parseJobsFilterQuery(query: Record<string, unknown>): {
  filters: JobsFilterContext;
  errors: Record<string, string[]>;
} {
  const professionId = parsePositiveIntQuery(query.professionId);
  const sectorId = parsePositiveIntQuery(query.sectorId);
  const errors: Record<string, string[]> = {};

  if (professionId === null) errors.professionId = ["Deve essere un intero positivo."];
  if (sectorId === null) errors.sectorId = ["Deve essere un intero positivo."];

  return {
    filters: {
      ...(typeof professionId === "number" ? { professionId } : {}),
      ...(typeof sectorId === "number" ? { sectorId } : {}),
    },
    errors,
  };
}
```

Then update the `jobsRouter.get("/")` handler:

```ts
  jobsRouter.get("/", requireAuth, async (req, res) => {
    const { filters, errors } = parseJobsFilterQuery(req.query as Record<string, unknown>);
    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: "Filtri lavoro non validi",
        code: "INVALID_JOB_FILTERS",
        details: errors,
      });
      return;
    }

    try {
      const response = await store.list(req.user!.id, filters);
      res.json(response);
    } catch (err) {
      req.log?.error?.({ err }, "jobs get error");
      if (
        sendOptionalReadFallback(req, res, err, "jobs.list", {
          jobs: [],
          basedOnProfession: null,
          basedOnSector: null,
          totalCount: 0,
          ...JOBS_NOT_CONFIGURED,
          personalized: false,
          source: "job_posting_snapshots",
          period: null,
          filter: {
            professionId: filters.professionId ?? null,
            sectorId: filters.sectorId ?? null,
            fallback: null,
          },
        })
      ) return;
      res.status(500).json({ error: "Errore nel caricamento dei lavori" });
    }
  });
```

- [ ] **Step 5: Update the test feed helper**

In `apps/server/src/routes/jobs.test.ts`, update `feed()` to return the new fields:

```ts
function feed(overrides: Partial<JobsFeedResponse> = {}): JobsFeedResponse {
  const jobs = overrides.jobs ?? [job()];
  return {
    jobs,
    basedOnProfession: null,
    basedOnSector: "Design & UX",
    totalCount: jobs.length,
    status: jobs.length > 0 ? "ok" : "empty",
    personalized: true,
    source: "job_posting_snapshots",
    period: "2026-06",
    filter: { professionId: null, sectorId: null, fallback: null },
    ...overrides,
  };
}
```

Update existing expected bodies in the test file by adding `basedOnProfession: null` and `filter: { professionId: null, sectorId: null, fallback: null }` where full response objects are asserted.

- [ ] **Step 6: Run API tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: PASS for route-level tests.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/jobs.ts apps/server/src/routes/jobs.test.ts
git commit -m "feat(jobs): support explicit role filters"
```

---

### Task 2: Implement Db Jobs Filtering And Fallback

**Files:**
- Modify: `apps/server/src/routes/jobs.test.ts`
- Modify: `apps/server/src/routes/jobs.ts`

- [ ] **Step 1: Add unit tests for filtered store behavior**

Append these tests to `apps/server/src/routes/jobs.test.ts`:

```ts
  it("documents role-filtered feed metadata through the memory store contract", async () => {
    const response = feed({
      jobs: [job({ title: "Product Designer" })],
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });

    await expect(createMemoryJobsStore(response).list(42, { professionId: 55, sectorId: 2 }))
      .resolves
      .toMatchObject({
        basedOnProfession: "Product Designer",
        basedOnSector: "Design & UX",
        filter: { professionId: 55, sectorId: 2, fallback: null },
      });
  });

  it("documents sector fallback metadata through the memory store contract", async () => {
    const response = feed({
      jobs: [job({ title: "UX Researcher" })],
      basedOnProfession: null,
      basedOnSector: "Design & UX",
      filter: { professionId: 999, sectorId: 2, fallback: "sector" },
    });

    await expect(createMemoryJobsStore(response).list(42, { professionId: 999, sectorId: 2 }))
      .resolves
      .toMatchObject({
        basedOnProfession: null,
        basedOnSector: "Design & UX",
        filter: { professionId: 999, sectorId: 2, fallback: "sector" },
      });
  });
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: PASS. These tests lock the response contract while the DB implementation changes.

- [ ] **Step 3: Replace snapshot row query with filtered helper**

In `apps/server/src/routes/jobs.ts`, replace `snapshotRows(period: string, id?: number)` with:

```ts
async function snapshotRows(input: {
  period?: string;
  id?: number;
  professionId?: number;
  sectorId?: number;
}): Promise<SnapshotRow[]> {
  const where =
    input.id
      ? eq(jobPostingSnapshotsTable.id, input.id)
      : input.professionId
        ? eq(jobPostingSnapshotsTable.professionId, input.professionId)
        : input.sectorId
          ? eq(jobPostingSnapshotsTable.sectorId, input.sectorId)
          : eq(jobPostingSnapshotsTable.period, input.period ?? "");

  const rows = await db
    .select({
      id: jobPostingSnapshotsTable.id,
      roleTitle: jobPostingSnapshotsTable.roleTitle,
      sectorId: jobPostingSnapshotsTable.sectorId,
      professionId: jobPostingSnapshotsTable.professionId,
      count: jobPostingSnapshotsTable.count,
      period: jobPostingSnapshotsTable.period,
      geography: jobPostingSnapshotsTable.geography,
      topSkills: jobPostingSnapshotsTable.topSkills,
      avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
      avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
      growthRate: jobPostingSnapshotsTable.growthRate,
      source: jobPostingSnapshotsTable.source,
      sectorName: sectorsTable.name,
      professionTitle: professionsTable.title,
      professionSalaryRange: professionsTable.salaryRange,
    })
    .from(jobPostingSnapshotsTable)
    .leftJoin(sectorsTable, eq(jobPostingSnapshotsTable.sectorId, sectorsTable.id))
    .leftJoin(professionsTable, eq(jobPostingSnapshotsTable.professionId, professionsTable.id))
    .where(where)
    .orderBy(desc(jobPostingSnapshotsTable.period), desc(jobPostingSnapshotsTable.count))
    .limit(input.id ? 1 : 24);

  return rows;
}
```

- [ ] **Step 4: Update DB store list implementation**

In `createDbJobsStore().list`, replace the method body with:

```ts
    async list(userId, filters = {}) {
      const [profile, period] = await Promise.all([latestProfile(userId), latestPeriod()]);
      if (!period) {
        return {
          jobs: [],
          basedOnProfession: null,
          basedOnSector: null,
          totalCount: 0,
          status: "empty",
          personalized: false,
          source: "job_posting_snapshots",
          period: null,
          filter: {
            professionId: filters.professionId ?? null,
            sectorId: filters.sectorId ?? null,
            fallback: null,
          },
        };
      }

      let fallback: "sector" | null = null;
      let rows: SnapshotRow[] = [];

      if (filters.professionId) {
        rows = await snapshotRows({ professionId: filters.professionId });
        if (rows.length === 0 && filters.sectorId) {
          rows = await snapshotRows({ sectorId: filters.sectorId });
          fallback = "sector";
        }
      } else if (filters.sectorId) {
        rows = await snapshotRows({ sectorId: filters.sectorId });
      } else {
        rows = await snapshotRows({ period });
      }

      const jobs = rows.map((row) => mapSnapshot(row, profile));
      jobs.sort((a, b) => b.matchScore - a.matchScore || b.count - a.count);
      const firstProfession = rows.find((row) => row.professionTitle)?.professionTitle ?? null;
      const firstSector = rows.find((row) => row.sectorName)?.sectorName ?? basedOnSectorName(profile, jobs);

      return {
        jobs,
        basedOnProfession: filters.professionId && fallback === null ? firstProfession : null,
        basedOnSector: firstSector,
        totalCount: jobs.length,
        status: jobs.length > 0 ? "ok" : "empty",
        personalized: Boolean(filters.professionId || filters.sectorId || profile?.confirmedSectorId || profile?.recommendations.length),
        source: "job_posting_snapshots",
        period: rows[0]?.period ?? period,
        filter: {
          professionId: filters.professionId ?? null,
          sectorId: filters.sectorId ?? null,
          fallback,
        },
      };
    },
```

In `createDbJobsStore().find`, replace:

```ts
      const [row] = await snapshotRows("", id);
```

with:

```ts
      const [row] = await snapshotRows({ id });
```

- [ ] **Step 5: Run server typecheck and tests**

Run:

```bash
pnpm --filter @northstar/server run typecheck
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/jobs.ts apps/server/src/routes/jobs.test.ts
git commit -m "feat(jobs): filter snapshots by role and sector"
```

---

### Task 3: Add Local Company Prospect API

**Files:**
- Create: `apps/server/src/services/company-prospects.ts`
- Create: `apps/server/src/services/company-prospects.test.ts`
- Modify: `apps/server/src/routes/jobs.ts`
- Modify: `apps/server/src/routes/jobs.test.ts`

- [ ] **Step 1: Create failing service tests**

Create `apps/server/src/services/company-prospects.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  createCompanyProspectService,
  type CompanyProspectProvider,
  type CompanyProspectRepository,
} from "./company-prospects";

const repository: CompanyProspectRepository = {
  async getProfession(id: number) {
    return id === 55 ? { id, title: "Product Designer", sectorId: 2, sectorName: "Design & UX" } : null;
  },
  async getUserCity(userId: number) {
    return userId === 42 ? "Milano" : null;
  },
};

describe("company prospect service", () => {
  it("uses profile city and returns source-linked company prospects", async () => {
    const provider: CompanyProspectProvider = {
      configured: true,
      search: vi.fn().mockResolvedValue([
        {
          name: "Studio Forma",
          location: "Milano",
          reason: "Ha pagine pubbliche su prodotti digitali e design.",
          evidence: "Studio Forma cerca profili design per prodotti digitali a Milano.",
          sourceUrl: "https://example.com/studio-forma-careers",
          sourceLabel: "example.com",
          confidence: "medium",
          suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma%20Product%20Designer%20Milano%20lavora%20con%20noi",
        },
      ]),
    };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(provider.search).toHaveBeenCalledWith({
      roleTitle: "Product Designer",
      sectorName: "Design & UX",
      city: "Milano",
    });
    expect(result).toMatchObject({
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      basedOnCity: "Milano",
      status: "ok",
      companies: [{ name: "Studio Forma", sourceUrl: "https://example.com/studio-forma-careers" }],
    });
  });

  it("returns city_required when neither query city nor profile city exists", async () => {
    const service = createCompanyProspectService({
      repository,
      provider: { configured: true, search: vi.fn() },
    });

    const result = await service.search({ userId: 7, professionId: 55 });

    expect(result).toMatchObject({
      status: "city_required",
      basedOnCity: null,
      companies: [],
    });
  });

  it("returns not_configured when the provider is unavailable", async () => {
    const service = createCompanyProspectService({
      repository,
      provider: { configured: false, search: vi.fn() },
    });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(result).toMatchObject({
      status: "not_configured",
      basedOnCity: "Milano",
      companies: [],
    });
  });

  it("deduplicates companies by normalized name", async () => {
    const provider: CompanyProspectProvider = {
      configured: true,
      search: vi.fn().mockResolvedValue([
        {
          name: "Studio Forma",
          location: "Milano",
          reason: "Prima fonte.",
          evidence: "Prima evidenza.",
          sourceUrl: "https://example.com/a",
          sourceLabel: "example.com",
          confidence: "medium",
          suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma",
        },
        {
          name: "studio forma",
          location: "Milano",
          reason: "Seconda fonte.",
          evidence: "Seconda evidenza.",
          sourceUrl: "https://example.com/b",
          sourceLabel: "example.com",
          confidence: "low",
          suggestedSearchUrl: "https://www.google.com/search?q=studio%20forma",
        },
      ]),
    };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]?.name).toBe("Studio Forma");
  });
});
```

- [ ] **Step 2: Run the failing service tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/services/company-prospects.test.ts --configLoader runner
```

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement the company prospect service**

Create `apps/server/src/services/company-prospects.ts`:

```ts
import { eq } from "drizzle-orm";
import { searchWeb } from "@workspace/ai-server";
import {
  db,
  professionsTable,
  sectorsTable,
  userProfileSettingsTable,
} from "@workspace/db";

export type CompanyProspectConfidence = "high" | "medium" | "low";

export interface CompanyProspect {
  name: string;
  location: string;
  reason: string;
  evidence: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: CompanyProspectConfidence;
  suggestedSearchUrl: string;
}

export interface CompanyProspectResponse {
  companies: CompanyProspect[];
  basedOnProfession: string | null;
  basedOnSector: string | null;
  basedOnCity: string | null;
  status: "ok" | "empty" | "city_required" | "not_configured";
  coverageNote: string;
}

export interface CompanyProspectSearchInput {
  userId: number;
  professionId: number;
  sectorId?: number;
  city?: string;
}

export interface CompanyProspectProviderInput {
  roleTitle: string;
  sectorName: string | null;
  city: string;
}

export interface CompanyProspectProvider {
  configured: boolean;
  search(input: CompanyProspectProviderInput): Promise<CompanyProspect[]>;
}

export interface CompanyProspectRepository {
  getProfession(id: number): Promise<{ id: number; title: string; sectorId: number | null; sectorName: string | null } | null>;
  getUserCity(userId: number): Promise<string | null>;
}

const COVERAGE_NOTE =
  "Mostro aziende scoperte dalle fonti configurate e disponibili: non e' un registro esaustivo di tutte le aziende della zona.";

function normalizeCompanyName(name: string): string {
  return name.toLowerCase().replace(/\b(srl|spa|s\.r\.l\.|s\.p\.a\.)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte web";
  }
}

function suggestedSearchUrl(name: string, roleTitle: string, city: string): string {
  const query = `${name} ${roleTitle} ${city} lavora con noi`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function inferName(title: string): string {
  return title
    .replace(/\s*[-|].*$/, "")
    .replace(/\b(lavora con noi|careers|jobs|assume|assunzioni)\b/gi, "")
    .trim();
}

function uniqueProspects(prospects: CompanyProspect[]): CompanyProspect[] {
  const seen = new Set<string>();
  const result: CompanyProspect[] = [];
  for (const prospect of prospects) {
    const key = normalizeCompanyName(prospect.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(prospect);
  }
  return result.slice(0, 12);
}

export function createWebCompanyProspectProvider(): CompanyProspectProvider {
  return {
    configured: Boolean(process.env.TAVILY_API_KEY),
    async search({ roleTitle, sectorName, city }) {
      const queries = [
        `aziende ${city} assumono ${roleTitle}`,
        `${roleTitle} ${city} lavora con noi`,
        sectorName ? `${sectorName} aziende ${city} ${roleTitle}` : `${roleTitle} aziende ${city}`,
        `site:linkedin.com/company ${city} ${roleTitle}`,
      ];
      const chunks = (await Promise.all(queries.map((query) => searchWeb(query, 5)))).flat();
      return uniqueProspects(chunks.map((chunk) => {
        const title = String(chunk.metadata?.title ?? "");
        const url = String(chunk.metadata?.url ?? chunk.source ?? "");
        const name = inferName(title) || sourceLabel(url);
        return {
          name,
          location: city,
          reason: `Fonte pubblica collegata a ${roleTitle}${sectorName ? ` nel settore ${sectorName}` : ""}.`,
          evidence: chunk.content.slice(0, 240),
          sourceUrl: url,
          sourceLabel: sourceLabel(url),
          confidence: chunk.content.toLowerCase().includes(roleTitle.toLowerCase()) ? "medium" : "low",
          suggestedSearchUrl: suggestedSearchUrl(name, roleTitle, city),
        };
      }).filter((prospect) => prospect.name && prospect.sourceUrl));
    },
  };
}

export function createDbCompanyProspectRepository(): CompanyProspectRepository {
  return {
    async getProfession(id) {
      const [row] = await db
        .select({
          id: professionsTable.id,
          title: professionsTable.title,
          sectorId: professionsTable.sectorId,
          sectorName: sectorsTable.name,
        })
        .from(professionsTable)
        .leftJoin(sectorsTable, eq(professionsTable.sectorId, sectorsTable.id))
        .where(eq(professionsTable.id, id))
        .limit(1);
      return row ?? null;
    },
    async getUserCity(userId) {
      const [row] = await db
        .select({ city: userProfileSettingsTable.city })
        .from(userProfileSettingsTable)
        .where(eq(userProfileSettingsTable.userId, userId))
        .limit(1);
      return row?.city?.trim() || null;
    },
  };
}

export function createCompanyProspectService({
  repository = createDbCompanyProspectRepository(),
  provider = createWebCompanyProspectProvider(),
}: {
  repository?: CompanyProspectRepository;
  provider?: CompanyProspectProvider;
} = {}) {
  return {
    async search(input: CompanyProspectSearchInput): Promise<CompanyProspectResponse> {
      const profession = await repository.getProfession(input.professionId);
      if (!profession) {
        return {
          companies: [],
          basedOnProfession: null,
          basedOnSector: null,
          basedOnCity: null,
          status: "empty",
          coverageNote: COVERAGE_NOTE,
        };
      }

      const city = input.city?.trim() || await repository.getUserCity(input.userId);
      if (!city) {
        return {
          companies: [],
          basedOnProfession: profession.title,
          basedOnSector: profession.sectorName,
          basedOnCity: null,
          status: "city_required",
          coverageNote: COVERAGE_NOTE,
        };
      }

      if (!provider.configured) {
        return {
          companies: [],
          basedOnProfession: profession.title,
          basedOnSector: profession.sectorName,
          basedOnCity: city,
          status: "not_configured",
          coverageNote: COVERAGE_NOTE,
        };
      }

      const companies = uniqueProspects(await provider.search({
        roleTitle: profession.title,
        sectorName: profession.sectorName,
        city,
      }));

      return {
        companies,
        basedOnProfession: profession.title,
        basedOnSector: profession.sectorName,
        basedOnCity: city,
        status: companies.length > 0 ? "ok" : "empty",
        coverageNote: COVERAGE_NOTE,
      };
    },
  };
}

export type CompanyProspectService = ReturnType<typeof createCompanyProspectService>;
```

- [ ] **Step 4: Run service tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/services/company-prospects.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Add failing route tests for company prospects**

Append these tests inside `describe("jobs routes", () => { ... })` in `apps/server/src/routes/jobs.test.ts` before the read-only write test:

```ts
  it("returns local company prospects for a selected role", async () => {
    const companyProspects = {
      search: vi.fn().mockResolvedValue({
        companies: [{
          name: "Studio Forma",
          location: "Milano",
          reason: "Lavora su prodotti digitali.",
          evidence: "Pagina careers pubblica.",
          sourceUrl: "https://example.com/studio-forma",
          sourceLabel: "example.com",
          confidence: "medium",
          suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma",
        }],
        basedOnProfession: "Product Designer",
        basedOnSector: "Design & UX",
        basedOnCity: "Milano",
        status: "ok",
        coverageNote: "Fonti disponibili.",
      }),
    };

    const response = await request(app(undefined, companyProspects))
      .get("/api/jobs/company-prospects?professionId=55&sectorId=2")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(companyProspects.search).toHaveBeenCalledWith({
      userId: 42,
      professionId: 55,
      sectorId: 2,
      city: undefined,
    });
    expect(response.body.companies[0]).toMatchObject({ name: "Studio Forma" });
  });

  it("rejects invalid company prospect filters", async () => {
    const response = await request(app())
      .get("/api/jobs/company-prospects?professionId=abc&city=" + "x".repeat(121))
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);

    expect(response.body).toEqual({
      error: "Filtri ricerca aziende non validi",
      code: "INVALID_COMPANY_PROSPECT_FILTERS",
      details: {
        professionId: ["Deve essere un intero positivo."],
        city: ["Massimo 120 caratteri."],
      },
    });
  });
```

Update the local route-test helper to accept the service:

```ts
function app(store: JobsStore = createMemoryJobsStore(feed()), companyProspects?: { search: ReturnType<typeof vi.fn> }) {
  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware({ jwtSecret: "test-secret" }));
  app.use("/api/jobs", createJobsRouter({ store, companyProspects }));
  return app;
}
```

- [ ] **Step 6: Run failing route tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: FAIL because `createJobsRouter` does not accept `companyProspects` and the route does not exist.

- [ ] **Step 7: Add company prospect route to jobs router**

In `apps/server/src/routes/jobs.ts`, add the import:

```ts
import {
  createCompanyProspectService,
  type CompanyProspectService,
} from "../services/company-prospects";
```

Add this helper near `parseJobsFilterQuery`:

```ts
function parseCompanyProspectQuery(query: Record<string, unknown>): {
  filters: { professionId?: number; sectorId?: number; city?: string };
  errors: Record<string, string[]>;
} {
  const professionId = parsePositiveIntQuery(query.professionId);
  const sectorId = parsePositiveIntQuery(query.sectorId);
  const city = typeof query.city === "string" && query.city.trim() ? query.city.trim() : undefined;
  const errors: Record<string, string[]> = {};

  if (professionId === null || professionId === undefined) errors.professionId = ["Deve essere un intero positivo."];
  if (sectorId === null) errors.sectorId = ["Deve essere un intero positivo."];
  if (typeof query.city === "string" && query.city.length > 120) errors.city = ["Massimo 120 caratteri."];
  if (Array.isArray(query.city)) errors.city = ["Usa una sola citta."];

  return {
    filters: {
      ...(typeof professionId === "number" ? { professionId } : {}),
      ...(typeof sectorId === "number" ? { sectorId } : {}),
      ...(city ? { city } : {}),
    },
    errors,
  };
}
```

Change the router factory signature:

```ts
export function createJobsRouter({
  store = createDbJobsStore(),
  companyProspects = createCompanyProspectService(),
}: {
  store?: JobsStore;
  companyProspects?: CompanyProspectService;
} = {}) {
```

Add this route after `jobsRouter.get("/")` and before `jobsRouter.get("/:id")`:

```ts
  jobsRouter.get("/company-prospects", requireAuth, async (req, res) => {
    const { filters, errors } = parseCompanyProspectQuery(req.query as Record<string, unknown>);
    if (Object.keys(errors).length > 0 || !filters.professionId) {
      res.status(400).json({
        error: "Filtri ricerca aziende non validi",
        code: "INVALID_COMPANY_PROSPECT_FILTERS",
        details: errors,
      });
      return;
    }

    try {
      const response = await companyProspects.search({
        userId: req.user!.id,
        professionId: filters.professionId,
        sectorId: filters.sectorId,
        city: filters.city,
      });
      res.json(response);
    } catch (err) {
      req.log?.error?.({ err }, "company prospects get error");
      res.status(500).json({ error: "Errore nel caricamento delle aziende locali" });
    }
  });
```

- [ ] **Step 8: Run company prospect route tests and service tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/services/company-prospects.test.ts src/routes/jobs.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/services/company-prospects.ts apps/server/src/services/company-prospects.test.ts apps/server/src/routes/jobs.ts apps/server/src/routes/jobs.test.ts
git commit -m "feat(jobs): add local company prospects"
```

---

### Task 4: Add Role-Aware Jobs Page

**Files:**
- Create: `apps/web/src/pages/lavori.test.tsx`
- Modify: `apps/web/src/pages/lavori.tsx`

- [ ] **Step 1: Create failing jobs page tests**

Create `apps/web/src/pages/lavori.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Lavori from "./lavori";

const authState = vi.hoisted(() => ({
  isLoggedIn: true,
  user: { id: 7 },
}));

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: authState.isLoggedIn,
    user: authState.user,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

function jobsResponse(overrides: Record<string, unknown> = {}) {
  return {
    jobs: [{
      id: 12,
      title: "Product Designer",
      company: "Adzuna - 128 segnali",
      location: "Italia",
      type: "market-signal",
      sector: "Design & UX",
      tags: ["figma", "research"],
      url: "https://www.linkedin.com/jobs/search/?keywords=Product+Designer&location=Italia",
      salary: "32.000 - 45.000 EUR",
      matchScore: 91,
      sourceLabel: "Adzuna",
      count: 128,
      period: "2026-06",
      growthRate: 0.12,
      isAggregate: true,
    }],
    basedOnProfession: "Product Designer",
    basedOnSector: "Design & UX",
    totalCount: 1,
    status: "ok",
    personalized: true,
    source: "job_posting_snapshots",
    period: "2026-06",
    filter: { professionId: 55, sectorId: 2, fallback: null },
    ...overrides,
  };
}

function companiesResponse(overrides: Record<string, unknown> = {}) {
  return {
    companies: [{
      name: "Studio Forma",
      location: "Milano",
      reason: "Lavora su prodotti digitali e design.",
      evidence: "Pagina careers pubblica collegata a Product Designer.",
      sourceUrl: "https://example.com/studio-forma",
      sourceLabel: "example.com",
      confidence: "medium",
      suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma%20Product%20Designer",
    }],
    basedOnProfession: "Product Designer",
    basedOnSector: "Design & UX",
    basedOnCity: "Milano",
    status: "ok",
    coverageNote: "Mostro aziende scoperte dalle fonti configurate e disponibili.",
    ...overrides,
  };
}

function mockApi(
  jobs = jobsResponse(),
  companies = companiesResponse(),
) {
  getJsonMock.mockImplementation((path: string) => {
    if (path.startsWith("/api/jobs/company-prospects")) return Promise.resolve(companies);
    if (path.startsWith("/api/jobs")) return Promise.resolve(jobs);
    return Promise.reject(new Error(`Unexpected path ${path}`));
  });
}

function renderLavori(path = "/lavori?professionId=55&sectorId=2") {
  window.history.replaceState({}, "", path);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Lavori />
    </QueryClientProvider>,
  );
}

describe("Lavori page role context", () => {
  beforeEach(() => {
    authState.isLoggedIn = true;
    authState.user = { id: 7 };
    getJsonMock.mockReset();
    mockApi();
  });

  it("requests jobs and company prospects with profession and sector context", async () => {
    renderLavori();

    await screen.findByText("Aziende e lavori per Product Designer a Milano");

    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs?professionId=55&sectorId=2");
    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs/company-prospects?professionId=55&sectorId=2");
    expect(screen.getByText("Studio Forma")).toBeInTheDocument();
    expect(screen.getByText(/aziende scoperte dalle fonti/i)).toBeInTheDocument();
  });

  it("passes query city to company prospect search", async () => {
    renderLavori("/lavori?professionId=55&sectorId=2&city=Torino");

    await screen.findByText("Aziende e lavori per Product Designer a Milano");

    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs/company-prospects?professionId=55&sectorId=2&city=Torino");
  });

  it("renders sector fallback copy when role snapshots are missing", async () => {
    mockApi(jobsResponse({
      basedOnProfession: null,
      filter: { professionId: 55, sectorId: 2, fallback: "sector" },
    }));

    renderLavori();

    expect(await screen.findByText("Aziende e lavori per Product Designer a Milano")).toBeInTheDocument();
    expect(screen.getByText(/non ho ancora snapshot specifici per questo ruolo/i)).toBeInTheDocument();
  });

  it("asks for a city when local company search has no city", async () => {
    mockApi(jobsResponse(), companiesResponse({
      companies: [],
      basedOnCity: null,
      status: "city_required",
    }));

    renderLavori();

    expect(await screen.findByText(/aggiungi una citta/i)).toBeInTheDocument();
  });

  it("keeps the existing auth gate for logged out users", () => {
    authState.isLoggedIn = false;
    authState.user = null;

    renderLavori("/lavori?professionId=55");

    expect(screen.getByText("Segnali mercato NorthStar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accedi/i })).toHaveAttribute("href", "/sign-in?redirect_url=/lavori");
  });
});
```

- [ ] **Step 2: Run the failing jobs page tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/lavori.test.tsx --configLoader runner
```

Expected: FAIL because the page does not read URL filters, fetch company prospects, or render role-specific headings.

- [ ] **Step 3: Update jobs page types and query URLs**

In `apps/web/src/pages/lavori.tsx`, update `JobsResponse` and add company prospect types:

```ts
interface JobsResponse {
  jobs: Job[];
  basedOnProfession: string | null;
  basedOnSector: string | null;
  totalCount: number;
  status?: "ok" | "empty" | "not_configured";
  reason?: "jobs_provider_not_connected" | string;
  action?: "connect_jobs_provider" | string;
  personalized?: boolean;
  source?: "job_posting_snapshots" | string;
  period?: string | null;
  filter?: {
    professionId: number | null;
    sectorId: number | null;
    fallback: "sector" | null;
  };
}

interface CompanyProspect {
  name: string;
  location: string;
  reason: string;
  evidence: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: "high" | "medium" | "low";
  suggestedSearchUrl: string;
}

interface CompanyProspectsResponse {
  companies: CompanyProspect[];
  basedOnProfession: string | null;
  basedOnSector: string | null;
  basedOnCity: string | null;
  status: "ok" | "empty" | "city_required" | "not_configured";
  coverageNote: string;
}
```

Inside `Lavori()`, before `useQuery`, add:

```ts
  const params = new URLSearchParams(window.location.search);
  const professionId = params.get("professionId");
  const sectorId = params.get("sectorId");
  const city = params.get("city");
  const jobsQuery = new URLSearchParams();
  if (professionId) jobsQuery.set("professionId", professionId);
  if (sectorId) jobsQuery.set("sectorId", sectorId);
  const companyQuery = new URLSearchParams(jobsQuery);
  if (city) companyQuery.set("city", city);
  const jobsPath = `${BASE}api/jobs${jobsQuery.toString() ? `?${jobsQuery.toString()}` : ""}`;
  const companiesPath = `${BASE}api/jobs/company-prospects?${companyQuery.toString()}`;
```

Replace the jobs query block and add the company prospects query:

```ts
  const { data, isError, isLoading, refetch } = useQuery<JobsResponse>({
    queryKey: ["jobs", user?.id, professionId, sectorId],
    queryFn: () => getJson<JobsResponse>(jobsPath),
    enabled: isLoggedIn,
    staleTime: 60_000 * 10,
  });

  const { data: companyProspects } = useQuery<CompanyProspectsResponse>({
    queryKey: ["company-prospects", user?.id, professionId, sectorId, city],
    queryFn: () => getJson<CompanyProspectsResponse>(companiesPath),
    enabled: isLoggedIn && Boolean(professionId),
    staleTime: 60_000 * 10,
  });
```

- [ ] **Step 4: Add heading, company prospects panel, and fallback copy**

Inside `Lavori()`, after `canShowFilters`, add:

```ts
  const fallbackToSector = data?.filter?.fallback === "sector";
  const roleTitle = companyProspects?.basedOnProfession ?? data?.basedOnProfession;
  const companyCity = companyProspects?.basedOnCity;
  const heading = roleTitle && companyCity
    ? `Aziende e lavori per ${roleTitle} a ${companyCity}`
    : roleTitle
      ? `Aziende e lavori per ${roleTitle}`
      : data?.basedOnSector
        ? `Domanda lavoro in ${data.basedOnSector}`
        : "Domanda per ruolo";
  const subtitle = fallbackToSector
    ? `Non ho ancora snapshot specifici per questo ruolo: ti mostro la domanda nel settore ${data?.basedOnSector}.`
    : roleTitle
      ? `Prima trovi aziende locali scoperte dalle fonti disponibili, poi i segnali aggregati per il ruolo target.`
      : data?.basedOnSector
        ? `Snapshot aggregati ordinati per il tuo settore: ${data.basedOnSector}.`
        : jobsNotConfigured
          ? "Pipeline dati mercato non collegata"
          : data?.period
            ? `Snapshot job posting aggiornati al periodo ${data.period}`
            : "Completa il test per vedere segnali personalizzati";
```

Replace the current `<h1>` and subtitle paragraph in the header with:

```tsx
              <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">{heading}</h1>
              <p className="text-muted-foreground text-sm">
                {subtitle}
              </p>
```

Add this section before the job cards grid:

```tsx
        {companyProspects && (
          <section className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">Aziende nella tua zona</h2>
              <p className="mt-1 text-sm text-muted-foreground">{companyProspects.coverageNote}</p>
            </div>
            {companyProspects.status === "city_required" ? (
              <p className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                Aggiungi una citta al profilo o cerca con un parametro citta per trovare aziende locali.
              </p>
            ) : companyProspects.status === "not_configured" ? (
              <p className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                La ricerca aziende richiede un provider web configurato; intanto mostro i segnali di mercato aggregati.
              </p>
            ) : companyProspects.companies.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {companyProspects.companies.map((company) => (
                  <article key={`${company.name}-${company.sourceUrl}`} className="rounded-xl border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground">{company.name}</h3>
                        <p className="text-xs text-muted-foreground">{company.location}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{company.confidence}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{company.reason}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{company.evidence}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a className="text-sm font-semibold text-primary" href={company.sourceUrl} target="_blank" rel="noreferrer">
                        Fonte: {company.sourceLabel}
                      </a>
                      <a className="text-sm font-semibold text-primary" href={company.suggestedSearchUrl} target="_blank" rel="noreferrer">
                        Cerca posizioni aperte
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                Non ho trovato aziende locali dalle fonti disponibili; continuo a mostrarti la domanda aggregata per il ruolo.
              </p>
            )}
          </section>
        )}
```

Update the "Profilo applicato" chip condition to:

```tsx
            {(data?.basedOnProfession || data?.basedOnSector) && (
```

And chip label to:

```tsx
                <span className="text-xs font-semibold text-primary">
                  {data?.basedOnProfession ? "Ruolo applicato" : "Profilo applicato"}
                </span>
```

- [ ] **Step 5: Run web tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/lavori.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/lavori.tsx apps/web/src/pages/lavori.test.tsx
git commit -m "feat(jobs): show local companies for target roles"
```

---

### Task 5: Add Role Commitment CTA

**Files:**
- Create: `apps/web/src/pages/ruolo.test.tsx`
- Modify: `apps/web/src/pages/ruolo.tsx`

- [ ] **Step 1: Create failing role page test**

Create `apps/web/src/pages/ruolo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Ruolo from "./ruolo";

const roleState = vi.hoisted(() => ({
  role: {
    id: 55,
    title: "Product Designer",
    sector: "Design & UX",
    description: "Progetta esperienze digitali.",
    skills: ["Figma", "Research"],
    riasecFit: ["A", "S"],
    workModes: ["ibrido"],
    salaryRange: "32k-45k",
    growthOutlook: "Alto",
    autonomyScore: 7,
    stabilityScore: 8,
    educationPaths: [],
    sectorInfo: { id: 2, name: "Design & UX", icon: "compass" },
  },
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetRoleDetail: () => ({ data: roleState.role, isLoading: false, error: null }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, journeyType: "indeciso" } }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({ useWendyPageContext: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useParams: () => ({ id: "55" }),
}));
vi.mock("@/components/role/TryADaySection", () => ({
  TryADaySection: () => <section>Try-a-Day mock</section>,
}));
vi.mock("@/lib/sector-icon", () => ({
  RIASEC_LABELS: { A: { label: "Artistico" }, S: { label: "Sociale" } },
  SectorIcon: () => <span data-testid="sector-icon" />,
}));

describe("Ruolo decision flow", () => {
  beforeEach(() => {
    roleState.role.id = 55;
  });

  it("links the target role to role-specific jobs with sector fallback", () => {
    render(<Ruolo />);

    expect(screen.getByText("Settore scelto")).toBeInTheDocument();
    expect(screen.getByText("Ruolo target")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /trova aziende e lavori per questo ruolo/i }))
      .toHaveAttribute("href", "/lavori?professionId=55&sectorId=2");
  });
});
```

- [ ] **Step 2: Run failing role page test**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/ruolo.test.tsx --configLoader runner
```

Expected: FAIL because the decision rail and jobs CTA do not exist.

- [ ] **Step 3: Add jobs target and decision rail to role page**

In `apps/web/src/pages/ruolo.tsx`, add `ArrowRight` to the lucide import list.

After calculating `autonomyPercent` and `stabilityPercent`, add:

```ts
  const jobsHref = role.sectorInfo
    ? `/lavori?professionId=${role.id}&sectorId=${role.sectorInfo.id}`
    : `/lavori?professionId=${role.id}`;
```

After the description paragraph and before RIASEC chips, add:

```tsx
      <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-4 grid gap-2 text-sm sm:grid-cols-4">
          {["Settore scelto", "Ruolo target", "Competenze", "Lavori"].map((step, index) => (
            <div
              key={step}
              className={`rounded-xl border px-3 py-2 ${
                index <= 1 ? "border-primary/30 bg-background text-primary" : "border-border bg-card text-muted-foreground"
              }`}
            >
              <span className="font-semibold">{step}</span>
            </div>
          ))}
        </div>
        <Button asChild className="min-h-11 rounded-full">
          <Link href={jobsHref}>
            Trova aziende e lavori per questo ruolo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
```

After `<TryADaySection ... />`, add a second CTA:

```tsx
      <div className="mb-12 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
        <h2 className="mb-2 text-xl font-serif font-bold">Trasforma questo ruolo in ricerca reale</h2>
        <p className="mx-auto mb-5 max-w-xl text-sm text-muted-foreground">
          Hai visto il ruolo, le competenze e una giornata tipo. Ora guarda aziende locali e domanda reale collegate a questa professione.
        </p>
        <Button asChild className="min-h-11 rounded-full">
          <Link href={jobsHref}>
            Trova aziende e lavori per questo ruolo
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
```

- [ ] **Step 4: Run role page test**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/ruolo.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ruolo.tsx apps/web/src/pages/ruolo.test.tsx
git commit -m "feat(roles): connect role detail to jobs"
```

---

### Task 6: Promote Role Choice From Sectors

**Files:**
- Modify: `apps/web/src/pages/settori.tsx`
- Modify: `apps/web/src/pages/settori.test.tsx`
- Modify: `apps/web/src/pages/sector.tsx`
- Create or modify: `apps/web/src/pages/sector.test.tsx`

- [ ] **Step 1: Update sector list tests first**

In `apps/web/src/pages/settori.test.tsx`, add this test inside `describe("Settori adaptive pyramid", () => { ... })`:

```tsx
  it("frames sector selection as the first step before choosing a role", async () => {
    renderSettori();

    await screen.findByTestId("sector-pyramid");

    expect(screen.getByText(/scegli un'area, poi il ruolo su cui puntare/i)).toBeInTheDocument();
    expect(screen.getAllByText(/apri ruoli del settore/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Design & UX/i })).toHaveAttribute("href", "/settore/2#ruoli");
  });
```

- [ ] **Step 2: Run failing sector list test**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/settori.test.tsx --configLoader runner
```

Expected: FAIL because copy and anchor links are still sector-only.

- [ ] **Step 3: Update sector list copy and links**

In `apps/web/src/features/sectors/sectorExplorer.tsx`, change `PyramidCard` link from:

```tsx
      href={`/settore/${sector.id}`}
```

to:

```tsx
      href={`/settore/${sector.id}#ruoli`}
```

Change the bottom CTA text inside `PyramidCard` from:

```tsx
            Apri <ArrowRight className="h-3 w-3" />
```

to:

```tsx
            Apri ruoli del settore <ArrowRight className="h-3 w-3" />
```

In `apps/web/src/pages/settori.tsx`, replace hero heading and paragraph with:

```tsx
              <h1 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">
                Scegli un&apos;area, poi il ruolo su cui puntare.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                La classifica ti aiuta a scegliere il settore; dentro ogni settore trovi i ruoli concreti da approfondire fino ai lavori reali.
              </p>
```

In the catalog list link, change:

```tsx
                  <Link key={sector.id} href={`/settore/${sector.id}`}>
```

to:

```tsx
                  <Link key={sector.id} href={`/settore/${sector.id}#ruoli`}>
```

- [ ] **Step 4: Add sector detail role CTA test**

If `apps/web/src/pages/sector.test.tsx` does not exist, create a minimal test with mocks for `useGetSector`, `useGetSectorRoles`, and `useGetSectorStats`. The test must assert:

```tsx
expect(await screen.findByText("Scegli il ruolo target")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /scegli questo ruolo product designer/i }))
  .toHaveAttribute("href", "/ruolo/55?fromSector=2");
```

If the file exists, add the same assertions to the closest sector detail render test.

- [ ] **Step 5: Promote roles in sector detail**

In `apps/web/src/pages/sector.tsx`, add an early section after `<SectorPremiumTools ... />` and before `<Tabs ...>`:

```tsx
      <section id="ruoli" className="mb-12 rounded-3xl border border-primary/20 bg-primary/5 p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Prossima decisione</p>
            <h2 className="text-2xl font-serif font-bold">Scegli il ruolo target</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Il settore orienta il mercato; il ruolo decide quali competenze costruire e quali lavori cercare.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/ruoli?sectorId=${id}`}>Vedi tutti i ruoli</Link>
          </Button>
        </div>
        {isLoadingRoles ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-44 rounded-2xl" />)}
          </div>
        ) : roles && roles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.slice(0, 6).map((role) => (
              <article key={role.id} className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold text-foreground">{role.title}</h3>
                {role.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{role.description}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {role.skills?.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{skill}</span>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild className="rounded-full">
                    <Link href={`/ruolo/${role.id}?fromSector=${id}`} aria-label={`Scegli questo ruolo ${role.title}`}>
                      Scegli questo ruolo
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full">
                    <Link href={`/ruolo/${role.id}`}>Approfondisci</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Non ci sono ancora ruoli collegati a questo settore.
          </p>
        )}
      </section>
```

Keep the existing `TabsContent value="roles"` for deep browsing, but do not rely on it as the first role decision surface.

- [ ] **Step 6: Run sector tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/pages/settori.test.tsx src/pages/sector.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/sectors/sectorExplorer.tsx apps/web/src/pages/settori.tsx apps/web/src/pages/settori.test.tsx apps/web/src/pages/sector.tsx apps/web/src/pages/sector.test.tsx
git commit -m "feat(sectors): guide users from sectors to roles"
```

---

### Task 7: Update Dashboard, Wendy, And Bussola Copy

**Files:**
- Modify: `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`
- Modify: `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`
- Modify: `apps/web/src/components/dashboard/DashboardWendyPrompts.tsx`
- Modify: `apps/web/src/components/dashboard/DashboardWendyPrompts.test.tsx`
- Modify: `apps/web/src/components/dashboard/JourneyToolsSection.tsx`
- Modify: `apps/web/src/features/compass/BussolaHome.tsx`

- [ ] **Step 1: Update tests for sector-plus-role decision**

In `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`, update the `explore_sectors` expectation:

```ts
    expect(result.nextAction).toEqual({
      label: "Scegli settore e ruolo",
      href: "/settori",
      sectionId: "discovery_feed",
    });
```

In `apps/web/src/components/dashboard/DashboardWendyPrompts.test.tsx`, change the first test to:

```tsx
  it("promotes a phase-specific Wendy prompt for choosing sector and role", async () => {
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    const firstPrompt = getFirstPromptButton();
    expect(firstPrompt).toHaveTextContent(/scegli settore e ruolo/i);

    fireEvent.click(firstPrompt);

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/settore/i));
      expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/ruolo/i));
      expect(wendyMock.open).toHaveBeenCalled();
    });
  });
```

Change the dynamic translation test mock string to:

```ts
    dynamicTranslationMock.mockResolvedValueOnce("Help me choose a sector and role from my profile.");
```

And update expectations:

```ts
      expect(wendyMock.ask).toHaveBeenCalledWith("Help me choose a sector and role from my profile.");
```

```ts
      source: expect.stringMatching(/settore e ruolo/i),
```

- [ ] **Step 2: Run failing dashboard prompt tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/dashboard/dashboard-adaptive-flow.test.ts src/components/dashboard/DashboardWendyPrompts.test.tsx --configLoader runner
```

Expected: FAIL because copy is still sector-only.

- [ ] **Step 3: Update adaptive flow copy**

In `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`, change:

```ts
  explore_sectors: { label: "Esplora settori", href: "/settori", sectionId: "discovery_feed" },
```

to:

```ts
  explore_sectors: { label: "Scegli settore e ruolo", href: "/settori", sectionId: "discovery_feed" },
```

- [ ] **Step 4: Update Wendy prompt**

In `apps/web/src/components/dashboard/DashboardWendyPrompts.tsx`, change the `explore_sectors` prompt to:

```ts
  explore_sectors: {
    Icon: Compass,
    id: "explore_sectors",
    label: "Scegli settore e ruolo",
    message:
      "Aiutami a scegliere un settore e un ruolo target da esplorare partendo dal mio profilo, dai risultati della mappa della chiarezza e dai segnali di mercato.",
  },
```

- [ ] **Step 5: Update tools copy**

In `apps/web/src/components/dashboard/JourneyToolsSection.tsx`, change `exploreSectorsTool`:

```ts
  const exploreSectorsTool: ToolItem = {
    href: "/settori",
    icon: Target,
    title: "Scegli settore e ruolo",
    desc: "Parti da un'area, poi scegli il ruolo target",
  };
```

In `INDECISO_FULL`, replace the `/settori` item with:

```ts
    { href: "/settori",               icon: Target,         title: "Scegli settore e ruolo", desc: "Parti da un'area, poi scegli il ruolo target" },
```

- [ ] **Step 6: Update Bussola copy**

In `apps/web/src/features/compass/BussolaHome.tsx`, in the `sperimenta` tools, replace the `/ruoli` and `/settori` entries with:

```ts
      { href: `${BASE}settori`, icon: Layers, title: "Scegli settore e ruolo", desc: "Trova l'area, poi il ruolo da approfondire" },
      { href: `${BASE}ruoli`, icon: Rocket, title: "Prova una giornata", desc: "Assaggia un ruolo concreto prima di puntarci" },
```

Keep both tools present so no existing path disappears.

- [ ] **Step 7: Run dashboard tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/dashboard/dashboard-adaptive-flow.test.ts src/components/dashboard/DashboardWendyPrompts.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/dashboard/dashboard-adaptive-flow.ts apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts apps/web/src/components/dashboard/DashboardWendyPrompts.tsx apps/web/src/components/dashboard/DashboardWendyPrompts.test.tsx apps/web/src/components/dashboard/JourneyToolsSection.tsx apps/web/src/features/compass/BussolaHome.tsx
git commit -m "feat(discovery): rename sector exploration as direction choice"
```

---

### Task 8: Final Verification And Integration Pass

**Files:**
- Inspect all files touched by Tasks 1-7.

- [ ] **Step 1: Run focused server tests**

Run:

```bash
pnpm --filter @northstar/server exec vitest run src/routes/jobs.test.ts --configLoader runner
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests**

Run:

```bash
pnpm --filter @northstar/web exec vitest run src/components/dashboard/dashboard-adaptive-flow.test.ts src/components/dashboard/DashboardWendyPrompts.test.tsx src/pages/settori.test.tsx src/pages/sector.test.tsx src/pages/ruolo.test.tsx src/pages/lavori.test.tsx --configLoader runner
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run:

```bash
pnpm --filter @northstar/server run typecheck
pnpm --filter @northstar/web run typecheck
```

Expected: both commands PASS.

- [ ] **Step 4: Search for remaining sector-only decision copy**

Run:

```bash
rg -n "Esplora settori|Scegli 3 settori|tre settori|solo settore|Trova lavori per questo ruolo" apps/web/src/components/dashboard apps/web/src/pages apps/web/src/features/compass
```

Expected: no matches in decision-flow copy. Matches in generic catalog contexts are acceptable only when they do not describe the full decision.

- [ ] **Step 5: Verify staged secret safety before final commit**

Run:

```bash
git diff --staged | Select-String -Pattern '(sk-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|password\s*=|secret\s*=|api_key\s*=|OPENAI_API_KEY\s*=|JWT_SECRET\s*=)' -CaseSensitive:$false
```

Expected: no output.

- [ ] **Step 6: Commit verification fixes if any were needed**

If Step 4 or typecheck required edits, commit them:

```bash
git add apps/server/src/routes/jobs.ts apps/server/src/routes/jobs.test.ts apps/server/src/services/company-prospects.ts apps/server/src/services/company-prospects.test.ts apps/web/src/components/dashboard apps/web/src/features/compass apps/web/src/features/sectors apps/web/src/pages
git commit -m "fix(discovery): polish sector role job flow"
```

If no edits were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: Tasks cover dashboard/Bussola copy, sector list, sector detail, role detail, jobs API, local company prospects API, jobs page, fallback states, and tests.
- Scope: persistent selected-direction schema is intentionally not included because the approved first slice uses query/context flow.
- Placeholder scan: no placeholder markers or deferred implementation markers are present.
- Type consistency: server responses use `basedOnProfession`, `basedOnSector`, `basedOnCity`, `filter`, and company prospect fields consistently across API tests, `jobs.ts`, `company-prospects.ts`, and `lavori.tsx`.
