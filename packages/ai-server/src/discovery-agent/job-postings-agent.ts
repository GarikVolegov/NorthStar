import { and, eq, sql } from "drizzle-orm";
import { db, jobPostingSnapshotsTable, professionsTable } from "@workspace/db";
import type { NewJobPostingSnapshot } from "@workspace/db";
import { wendyConfig } from "../config/wendy";
import { logger } from "../logger";

const KNOWN_SKILLS = [
  "typescript",
  "javascript",
  "react",
  "node",
  "python",
  "sql",
  "excel",
  "power bi",
  "data analysis",
  "machine learning",
  "cloud",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "sales",
  "marketing",
  "seo",
  "project management",
  "product management",
];

interface ProfessionInput {
  id: number;
  title: string;
  sectorId: number | null;
  skills: string[];
}

export interface PostingAggregate {
  source: string;
  count: number;
  topSkills: string[];
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
}

interface PriorSnapshot {
  roleTitle: string;
  source: string;
  count: number;
}

interface AdzunaJob {
  description?: string;
  title?: string;
  salary_min?: number | null;
  salary_max?: number | null;
}

interface AdzunaPayload {
  count?: number;
  results?: AdzunaJob[];
}

export function extractSkillsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  return KNOWN_SKILLS.filter((skill) => normalized.includes(skill));
}

function topSkillsFromTexts(texts: string[], fallback: string[] = []): string[] {
  const counts = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let order = 0;
  for (const skill of fallback) {
    counts.set(skill.toLowerCase(), (counts.get(skill.toLowerCase()) ?? 0) + 1);
    if (!firstSeen.has(skill.toLowerCase())) firstSeen.set(skill.toLowerCase(), order++);
  }
  for (const text of texts) {
    for (const skill of extractSkillsFromText(text)) {
      counts.set(skill, (counts.get(skill) ?? 0) + 1);
      if (!firstSeen.has(skill)) firstSeen.set(skill, order++);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0))
    .map(([skill]) => skill)
    .slice(0, 10);
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export function parseAdzunaJobs(payload: AdzunaPayload, fallbackSkills: string[] = []): Omit<PostingAggregate, "source"> {
  const jobs = payload.results ?? [];
  return {
    count: Number(payload.count ?? jobs.length),
    topSkills: topSkillsFromTexts(jobs.map((job) => `${job.title ?? ""} ${job.description ?? ""}`), fallbackSkills),
    avgSalaryMin: average(jobs.map((job) => job.salary_min)),
    avgSalaryMax: average(jobs.map((job) => job.salary_max)),
  };
}

function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousPeriod(period: string): string {
  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return currentPeriod(date);
}

function computeGrowthRate(count: number, previousCount: number | undefined): number | null {
  if (!previousCount || previousCount <= 0) return null;
  return Math.round(((count - previousCount) / previousCount) * 1000) / 1000;
}

export function buildJobSnapshotRows(
  profession: ProfessionInput,
  period: string,
  geography: string,
  aggregates: PostingAggregate[],
  priorSnapshots: PriorSnapshot[],
): NewJobPostingSnapshot[] {
  const roleTitle = profession.title.trim().toLowerCase();
  return aggregates.map((aggregate) => {
    const previous = priorSnapshots.find((snapshot) =>
      snapshot.roleTitle === roleTitle && snapshot.source === aggregate.source);
    return {
      roleTitle,
      sectorId: profession.sectorId,
      professionId: profession.id,
      count: aggregate.count,
      period,
      geography,
      topSkills: aggregate.topSkills.slice(0, 10),
      avgSalaryMin: aggregate.avgSalaryMin,
      avgSalaryMax: aggregate.avgSalaryMax,
      growthRate: computeGrowthRate(aggregate.count, previous?.count),
      source: aggregate.source,
    };
  });
}

async function fetchAdzunaAggregate(profession: ProfessionInput): Promise<PostingAggregate | null> {
  const { adzunaAppId, adzunaApiKey, adzunaCountry } = wendyConfig.jobPostings;
  if (!adzunaAppId || !adzunaApiKey) return null;
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/1`);
  url.searchParams.set("app_id", adzunaAppId);
  url.searchParams.set("app_key", adzunaApiKey);
  url.searchParams.set("what", profession.title);
  url.searchParams.set("where", "italia");
  url.searchParams.set("results_per_page", "25");

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const parsed = parseAdzunaJobs(await res.json() as AdzunaPayload, profession.skills);
  return { source: "adzuna", ...parsed };
}

function parseJoobleCount(text: string): number {
  const itemMatches = text.match(/<item\b/gi);
  if (itemMatches) return itemMatches.length;
  try {
    const json = JSON.parse(text) as { totalCount?: number; jobs?: unknown[] };
    return Number(json.totalCount ?? json.jobs?.length ?? 0);
  } catch {
    return 0;
  }
}

async function fetchJoobleAggregate(profession: ProfessionInput): Promise<PostingAggregate | null> {
  const { joobleApiKey } = wendyConfig.jobPostings;
  if (!joobleApiKey) return null;
  const res = await fetch(`https://jooble.org/api/${joobleApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: profession.title, location: "Italia" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Jooble ${res.status}`);
  const text = await res.text();
  return {
    source: "jooble",
    count: parseJoobleCount(text),
    topSkills: profession.skills.map((skill) => skill.toLowerCase()).slice(0, 10),
    avgSalaryMin: null,
    avgSalaryMax: null,
  };
}

async function collectAggregates(profession: ProfessionInput): Promise<PostingAggregate[]> {
  const settled = await Promise.allSettled([
    fetchAdzunaAggregate(profession),
    fetchJoobleAggregate(profession),
  ]);
  return settled.flatMap((result) => {
    if (result.status === "rejected") {
      logger.warn({ err: result.reason, profession: profession.title }, "[job-postings] provider failed");
      return [];
    }
    return result.value ? [result.value] : [];
  });
}

export interface JobPostingsAgentResult {
  inserted: number;
  updated: number;
  processedProfessions: number;
}

export async function runJobPostingsAgent(now = new Date()): Promise<JobPostingsAgentResult> {
  const period = currentPeriod(now);
  const prev = previousPeriod(period);
  const geography = wendyConfig.jobPostings.adzunaCountry.toUpperCase();
  let inserted = 0;
  let updated = 0;

  const professions = await db
    .select({
      id: professionsTable.id,
      title: professionsTable.title,
      sectorId: professionsTable.sectorId,
      skills: professionsTable.skills,
    })
    .from(professionsTable)
    .where(eq(professionsTable.isActive, true))
    .limit(wendyConfig.jobPostings.maxProfessionsPerRun);

  for (const profession of professions) {
    const aggregates = await collectAggregates(profession);
    if (aggregates.length === 0) continue;

    const roleTitle = profession.title.trim().toLowerCase();
    const priorSnapshots = await db
      .select({
        roleTitle: jobPostingSnapshotsTable.roleTitle,
        source: jobPostingSnapshotsTable.source,
        count: jobPostingSnapshotsTable.count,
      })
      .from(jobPostingSnapshotsTable)
      .where(and(
        eq(jobPostingSnapshotsTable.roleTitle, roleTitle),
        eq(jobPostingSnapshotsTable.period, prev),
      ));

    const rows = buildJobSnapshotRows(profession, period, geography, aggregates, priorSnapshots);
    for (const row of rows) {
      const returning = await db
        .insert(jobPostingSnapshotsTable)
        .values(row)
        .onConflictDoUpdate({
          target: [
            jobPostingSnapshotsTable.roleTitle,
            jobPostingSnapshotsTable.period,
            jobPostingSnapshotsTable.geography,
            jobPostingSnapshotsTable.source,
          ],
          set: {
            count: sql`excluded.count`,
            topSkills: sql`excluded.top_skills`,
            avgSalaryMin: sql`excluded.avg_salary_min`,
            avgSalaryMax: sql`excluded.avg_salary_max`,
            growthRate: sql`excluded.growth_rate`,
          },
        })
        .returning({ id: jobPostingSnapshotsTable.id });
      if (returning.length > 0) updated += 1;
    }
    inserted += rows.length;
  }

  return { inserted, updated, processedProfessions: professions.length };
}
