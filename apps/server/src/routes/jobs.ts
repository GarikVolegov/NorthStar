import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  jobPostingSnapshotsTable,
  professionsTable,
  sectorsTable,
  testSessionsTable,
} from "@workspace/db";
import { sendOptionalReadFallback } from "../lib/persistence";
import { requireAuth } from "../middleware/auth";

const JOBS_NOT_CONFIGURED = {
  status: "not_configured",
  reason: "jobs_provider_not_connected",
  action: "connect_jobs_provider",
} as const;

const JOBS_READ_ONLY = {
  code: "JOBS_READ_ONLY",
  error: "La job board usa dati aggregati di mercato e non consente modifiche manuali agli annunci.",
  action: "refresh_market_snapshots",
} as const;

export interface JobCardRecord {
  id: number;
  title: string;
  company: string;
  location: string;
  type: "market-signal";
  sector: string;
  tags: string[];
  url: string;
  salary: string;
  matchScore: number;
  source: string;
  sourceLabel: string;
  count: number;
  period: string;
  growthRate: number | null;
  isAggregate: true;
}

export interface JobsFeedResponse {
  jobs: JobCardRecord[];
  basedOnSector: string | null;
  totalCount: number;
  status: "ok" | "empty" | "not_configured";
  reason?: string;
  action?: string;
  personalized: boolean;
  source: "job_posting_snapshots";
  period: string | null;
}

export interface JobsStore {
  list(userId: number): Promise<JobsFeedResponse>;
  find(id: number, userId: number): Promise<JobCardRecord | null>;
}

type SnapshotRow = {
  id: number;
  roleTitle: string;
  sectorId: number | null;
  professionId: number | null;
  count: number;
  period: string;
  geography: string;
  topSkills: string[];
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  growthRate: number | null;
  source: string;
  sectorName: string | null;
  professionTitle: string | null;
  professionSalaryRange: string | null;
};

type LatestProfile = {
  confirmedSectorId: number | null;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number }>;
};

function titleCaseRole(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function geographyLabel(value: string): string {
  const normalized = value.toUpperCase();
  if (normalized === "GB") return "Regno Unito";
  if (normalized === "IT") return "Italia";
  if (normalized === "EU") return "Europa";
  if (normalized === "US") return "Stati Uniti";
  return normalized || "Mercato globale";
}

function sourceLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === "adzuna") return "Adzuna";
  if (normalized === "jooble") return "Jooble";
  if (normalized.includes("indeed")) return "Indeed";
  if (normalized.includes("infojobs")) return "InfoJobs";
  return value || "Fonte mercato";
}

function salaryLabel(row: Pick<SnapshotRow, "avgSalaryMin" | "avgSalaryMax" | "professionSalaryRange">): string {
  if (row.avgSalaryMin && row.avgSalaryMax) {
    return `${row.avgSalaryMin.toLocaleString("it-IT")} - ${row.avgSalaryMax.toLocaleString("it-IT")} EUR`;
  }
  if (row.avgSalaryMin) return `Da ${row.avgSalaryMin.toLocaleString("it-IT")} EUR`;
  if (row.avgSalaryMax) return `Fino a ${row.avgSalaryMax.toLocaleString("it-IT")} EUR`;
  return row.professionSalaryRange ?? "";
}

function searchUrl(title: string, geography: string): string {
  const url = new URL("https://www.linkedin.com/jobs/search/");
  url.searchParams.set("keywords", title);
  url.searchParams.set("location", geographyLabel(geography));
  return url.toString();
}

function recommendationScore(profile: LatestProfile | null, sectorId: number | null): number | null {
  if (!profile || !sectorId) return null;
  if (profile.confirmedSectorId === sectorId) return 95;
  const recommendation = profile.recommendations.find((item) => item.sectorId === sectorId);
  return recommendation?.matchScore ?? null;
}

function demandScore(row: Pick<SnapshotRow, "count" | "growthRate">): number {
  const volume = Math.min(35, Math.round(Math.log10(Math.max(1, row.count)) * 18));
  const growth = row.growthRate == null ? 15 : Math.max(0, Math.min(25, Math.round(row.growthRate * 100)));
  return Math.max(45, Math.min(92, 35 + volume + growth));
}

function mapSnapshot(row: SnapshotRow, profile: LatestProfile | null): JobCardRecord {
  const title = row.professionTitle ?? titleCaseRole(row.roleTitle);
  return {
    id: row.id,
    title,
    company: `${sourceLabel(row.source)} - ${row.count.toLocaleString("it-IT")} segnali`,
    location: geographyLabel(row.geography),
    type: "market-signal",
    sector: row.sectorName ?? "Mercato lavoro",
    tags: row.topSkills.slice(0, 6),
    url: searchUrl(title, row.geography),
    salary: salaryLabel(row),
    matchScore: recommendationScore(profile, row.sectorId) ?? demandScore(row),
    source: row.source,
    sourceLabel: sourceLabel(row.source),
    count: row.count,
    period: row.period,
    growthRate: row.growthRate,
    isAggregate: true,
  };
}

function normalizeRecommendations(value: unknown): LatestProfile["recommendations"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { sectorId?: unknown; sectorName?: unknown; matchScore?: unknown };
    if (typeof candidate.sectorId !== "number" || typeof candidate.matchScore !== "number") return [];
    return [{
      sectorId: candidate.sectorId,
      sectorName: typeof candidate.sectorName === "string" ? candidate.sectorName : `Settore ${candidate.sectorId}`,
      matchScore: candidate.matchScore,
    }];
  });
}

function basedOnSectorName(profile: LatestProfile | null, jobs: JobCardRecord[]): string | null {
  if (!profile) return null;
  if (profile.confirmedSectorId) {
    const job = jobs.find((item) => item.matchScore >= 90);
    if (job?.sector && job.sector !== "Mercato lavoro") return job.sector;
  }
  return profile.recommendations[0]?.sectorName ?? null;
}

async function latestProfile(userId: number): Promise<LatestProfile | null> {
  const [session] = await db
    .select({
      confirmedSectorId: testSessionsTable.confirmedSectorId,
      recommendations: testSessionsTable.recommendations,
    })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  if (!session) return null;
  return {
    confirmedSectorId: session.confirmedSectorId,
    recommendations: normalizeRecommendations(session.recommendations),
  };
}

async function latestPeriod(): Promise<string | null> {
  const [row] = await db
    .select({ period: jobPostingSnapshotsTable.period })
    .from(jobPostingSnapshotsTable)
    .orderBy(desc(jobPostingSnapshotsTable.period))
    .limit(1);
  return row?.period ?? null;
}

async function snapshotRows(period: string, id?: number): Promise<SnapshotRow[]> {
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
    .where(id
      ? eq(jobPostingSnapshotsTable.id, id)
      : eq(jobPostingSnapshotsTable.period, period))
    .orderBy(desc(jobPostingSnapshotsTable.count))
    .limit(id ? 1 : 24);

  return rows;
}

export function createDbJobsStore(): JobsStore {
  return {
    async list(userId) {
      const [profile, period] = await Promise.all([latestProfile(userId), latestPeriod()]);
      if (!period) {
        return {
          jobs: [],
          basedOnSector: null,
          totalCount: 0,
          status: "empty",
          personalized: false,
          source: "job_posting_snapshots",
          period: null,
        };
      }

      const jobs = (await snapshotRows(period)).map((row) => mapSnapshot(row, profile));
      jobs.sort((a, b) => b.matchScore - a.matchScore || b.count - a.count);
      return {
        jobs,
        basedOnSector: basedOnSectorName(profile, jobs),
        totalCount: jobs.length,
        status: jobs.length > 0 ? "ok" : "empty",
        personalized: Boolean(profile?.confirmedSectorId || profile?.recommendations.length),
        source: "job_posting_snapshots",
        period,
      };
    },

    async find(id, userId) {
      const profile = await latestProfile(userId);
      const [row] = await snapshotRows("", id);
      return row ? mapSnapshot(row, profile) : null;
    },
  };
}

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

export function createJobsRouter({ store = createDbJobsStore() }: { store?: JobsStore } = {}) {
  const jobsRouter = Router();

  jobsRouter.get("/", requireAuth, async (req, res) => {
    try {
      const response = await store.list(req.user!.id);
      res.json(response);
    } catch (err) {
      req.log?.error?.({ err }, "jobs get error");
      if (
        sendOptionalReadFallback(req, res, err, "jobs.list", {
          jobs: [],
          basedOnSector: null,
          totalCount: 0,
          ...JOBS_NOT_CONFIGURED,
          personalized: false,
          source: "job_posting_snapshots",
          period: null,
        })
      ) return;
      res.status(500).json({ error: "Errore nel caricamento dei lavori" });
    }
  });

  jobsRouter.get("/:id", requireAuth, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id ?? "", 10);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "ID lavoro non valido" });
        return;
      }

      const job = await store.find(id, req.user!.id);
      if (!job) {
        res.status(404).json({ error: "Segnale lavoro non trovato" });
        return;
      }
      res.json(job);
    } catch (err) {
      req.log?.error?.({ err }, "jobs detail error");
      if (sendOptionalReadFallback(req, res, err, "jobs.detail", JOBS_NOT_CONFIGURED)) return;
      res.status(500).json({ error: "Errore nel caricamento del lavoro" });
    }
  });

  jobsRouter.post("/", requireAuth, (_req, res) => {
    res.status(405).json(JOBS_READ_ONLY);
  });

  jobsRouter.patch("/:id", requireAuth, (_req, res) => {
    res.status(405).json(JOBS_READ_ONLY);
  });

  jobsRouter.delete("/:id", requireAuth, (_req, res) => {
    res.status(405).json(JOBS_READ_ONLY);
  });

  return jobsRouter;
}

export default createJobsRouter();
