import { sql } from "drizzle-orm";
import { statusForValue } from "./thresholds";
import type {
  ComputeVitalSignsOptions,
  MonthlyCountRow,
  SectorVitalsQueryArgs,
  SectorVitalsRepository,
  VitalKey,
  VitalSign,
  VitalSigns,
} from "./types";

const DEFAULT_GEOGRAPHY = "IT";
const CACHE_TTL_MS = 60 * 60 * 1000;

const memoryCache = new Map<string, { expiresAt: number; value: VitalSigns }>();

export async function computeVitalSigns(
  sectorId: number,
  geography = DEFAULT_GEOGRAPHY,
  options: ComputeVitalSignsOptions = {},
): Promise<VitalSigns> {
  if (!Number.isInteger(sectorId) || sectorId <= 0) {
    throw new Error("sectorId must be a positive integer");
  }

  const now = options.now ?? new Date();
  const normalizedGeography = geography.trim() || DEFAULT_GEOGRAPHY;
  const cacheKey = `${sectorId}:${normalizedGeography}`;
  const cacheEnabled = options.cache !== false;

  if (cacheEnabled) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiresAt > now.getTime()) return cached.value;
  }

  const periods = getLastMonthPeriods(now, 12);
  const repository = options.repository ?? createDbSectorVitalsRepository();
  const query: SectorVitalsQueryArgs = { sectorId, geography: normalizedGeography, periods };
  const sectorName = await repository.getSectorName(sectorId);

  const [
    jobCounts,
    roleCounts,
    newJobTitleSignals,
    contentCounts,
    roleCompetition,
    adrenalineStrength,
  ] = await Promise.all([
    repository.getJobPostingMonthlyCounts(query),
    repository.getDistinctRoleTitleMonthlyCounts(query),
    repository.getNewJobTitleSignalCounts(query),
    repository.getContentMonthlyCounts({ ...query, sectorName }),
    repository.getRoleCompetitionMonthlyCounts(query),
    repository.getAdrenalineMonthlyStrength(query),
  ]);

  const pulseSeries = toSeries(periods, jobCounts);
  const oxygenSeries = sumSeries(
    toSeries(periods, roleCounts),
    toSeries(periods, newJobTitleSignals),
  );
  const temperatureSeries = toSeries(periods, contentCounts);
  const pressureSeries = toSeries(periods, roleCompetition);
  const adrenalineSeries = toSeries(
    periods,
    adrenalineStrength.map((row) => ({
      period: row.period,
      count: Math.round(row.averageStrength * 100),
    })),
  );

  const signs: Record<VitalKey, VitalSign> = {
    pulse: buildSign("pulse", pulseSeries, "job_posting_snapshots"),
    oxygen: buildSign("oxygen", oxygenSeries, "job_posting_snapshots+weak_signals:new_job_title"),
    temperature: buildSign("temperature", temperatureSeries, "news_articles+growth_articles"),
    pressure: buildSign("pressure", pressureSeries, "job_posting_snapshots:role_competition_proxy"),
    adrenaline: buildSign("adrenaline", adrenalineSeries, "weak_signals:emerging_strength"),
  };

  const value: VitalSigns = {
    sectorId,
    computedAt: now.toISOString(),
    geography: normalizedGeography,
    signs,
  };

  if (cacheEnabled) {
    memoryCache.set(cacheKey, { expiresAt: now.getTime() + CACHE_TTL_MS, value });
  }

  return value;
}

export function clearSectorVitalsCache(): void {
  memoryCache.clear();
}

function buildSign(key: VitalKey, sparkline: number[], source: string): VitalSign {
  const value = sparkline.at(-1) ?? 0;
  return {
    key,
    value,
    status: statusForValue(key, value),
    sparkline,
    delta: quarterDelta(sparkline),
    source,
  };
}

function quarterDelta(series: number[]): number {
  const current = sum(series.slice(-3));
  const previous = sum(series.slice(-6, -3));
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumSeries(left: number[], right: number[]): number[] {
  return left.map((value, index) => value + (right[index] ?? 0));
}

function toSeries(periods: string[], rows: MonthlyCountRow[]): number[] {
  const byPeriod = new Map(rows.map((row) => [row.period, Number(row.count) || 0]));
  return periods.map((period) => byPeriod.get(period) ?? 0);
}

function getLastMonthPeriods(now: Date, count: number): string[] {
  const periods: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() - (count - 1));
  for (let index = 0; index < count; index += 1) {
    periods.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periods;
}

function createDbSectorVitalsRepository(): SectorVitalsRepository {
  return {
    async getSectorName(sectorId) {
      const { db, sectorsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [sector] = await db
        .select({ name: sectorsTable.name })
        .from(sectorsTable)
        .where(eq(sectorsTable.id, sectorId))
        .limit(1);
      return sector?.name ?? null;
    },

    async getJobPostingMonthlyCounts(args) {
      const periods = textArray(args.periods);
      return executeCountRows(sql`
        SELECT period, COALESCE(SUM(count), 0)::int AS count
        FROM job_posting_snapshots
        WHERE sector_id = ${args.sectorId}
          AND geography = ${args.geography}
          AND period = ANY(${periods})
        GROUP BY period
        ORDER BY period
      `);
    },

    async getDistinctRoleTitleMonthlyCounts(args) {
      const periods = textArray(args.periods);
      return executeCountRows(sql`
        SELECT period, COUNT(DISTINCT role_title)::int AS count
        FROM job_posting_snapshots
        WHERE sector_id = ${args.sectorId}
          AND geography = ${args.geography}
          AND period = ANY(${periods})
        GROUP BY period
        ORDER BY period
      `);
    },

    async getNewJobTitleSignalCounts(args) {
      const periods = textArray(args.periods);
      return executeCountRows(sql`
        SELECT to_char(date_trunc('month', last_seen_at), 'YYYY-MM') AS period,
               COUNT(*)::int AS count
        FROM weak_signals
        WHERE signal_type = 'new_job_title'
          AND linked_sector_ids @> ARRAY[${String(args.sectorId)}]::text[]
          AND (${args.geography} = ANY(geographies) OR cardinality(geographies) = 0)
          AND to_char(date_trunc('month', last_seen_at), 'YYYY-MM') = ANY(${periods})
        GROUP BY period
        ORDER BY period
      `);
    },

    async getContentMonthlyCounts(args) {
      if (!args.sectorName) return [];
      const periods = textArray(args.periods);
      return executeCountRows(sql`
        SELECT period, SUM(count)::int AS count
        FROM (
          SELECT to_char(date_trunc('month', COALESCE(published_at, created_at)), 'YYYY-MM') AS period,
                 COUNT(*)::int AS count
          FROM news_articles
          WHERE sector_names @> ARRAY[${args.sectorName}]::text[]
            AND to_char(date_trunc('month', COALESCE(published_at, created_at)), 'YYYY-MM') = ANY(${periods})
          GROUP BY period
          UNION ALL
          SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,
                 COUNT(*)::int AS count
          FROM growth_articles
          WHERE sector_links @> ARRAY[${args.sectorName}]::text[]
            AND to_char(date_trunc('month', created_at), 'YYYY-MM') = ANY(${periods})
          GROUP BY period
        ) monthly_content
        GROUP BY period
        ORDER BY period
      `);
    },

    async getRoleCompetitionMonthlyCounts(args) {
      const periods = textArray(args.periods);
      return executeCountRows(sql`
        SELECT period, COUNT(*)::int AS count
        FROM (
          SELECT period, role_title
          FROM job_posting_snapshots
          WHERE sector_id = ${args.sectorId}
            AND geography = ${args.geography}
            AND period = ANY(${periods})
          GROUP BY period, role_title
        ) role_periods
        GROUP BY period
        ORDER BY period
      `);
    },

    async getAdrenalineMonthlyStrength(args) {
      const { db } = await import("@workspace/db");
      const periods = textArray(args.periods);
      const result = await db.execute<{
        period: string;
        average_strength: string | number | null;
        count: string | number;
      }>(sql`
        SELECT to_char(date_trunc('month', last_seen_at), 'YYYY-MM') AS period,
               COALESCE(AVG(strength), 0) AS average_strength,
               COUNT(*)::int AS count
        FROM weak_signals
        WHERE status = 'emerging'
          AND strength > 0.5
          AND linked_sector_ids @> ARRAY[${String(args.sectorId)}]::text[]
          AND (${args.geography} = ANY(geographies) OR cardinality(geographies) = 0)
          AND to_char(date_trunc('month', last_seen_at), 'YYYY-MM') = ANY(${periods})
        GROUP BY period
        ORDER BY period
      `);
      return result.rows.map((row) => ({
        period: row.period,
        averageStrength: Number(row.average_strength ?? 0),
        count: Number(row.count ?? 0),
      }));
    },
  };
}

function textArray(values: string[]): ReturnType<typeof sql> {
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
}

async function executeCountRows(query: ReturnType<typeof sql>): Promise<MonthlyCountRow[]> {
  const { db } = await import("@workspace/db");
  const result = await db.execute<{ period: string; count: string | number }>(query);
  return result.rows.map((row) => ({ period: row.period, count: Number(row.count) || 0 }));
}
