import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db, jobPostingSnapshotsTable, skillCooccurrencesTable, weakSignalsTable } from "@workspace/db";
import { searchMemoryGraph } from "../memory-graph";
import { logger } from "../logger";
import { readWeakSignalStatus } from "./tool-arg-utils";
import { queryEmbedding, type ToolResult } from "./tool-handlers";

function err(code: string, message: string): ToolResult {
  return { ok: false, code, message };
}

export async function handleSearchRag(
  args: {
    query: string;
    filters?: {
      geography?:      string[];
      sourceTypes?:    string[];
      minTrustScore?:  number;
      maxAgeMonths?:   number;
    };
    topK?: number;
  },
): Promise<ToolResult> {
  if (!args.query?.trim()) return err("INVALID_INPUT", "Query RAG vuota");

  const topK = Math.min(args.topK ?? 5, 10);
  const minTrust = args.filters?.minTrustScore ?? 0.55;
  const maxAgeMonths = args.filters?.maxAgeMonths ?? 24;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);

  try {
    const vec = await queryEmbedding(args.query).catch(() => null);
    if (!vec) return err("UNAVAILABLE", "Servizio embedding temporaneamente non disponibile");

    const vectorLiteral = `[${vec.join(",")}]`;

    // Costruisci filtri geografici come condizione SQL
    const geoFilter = args.filters?.geography?.length
      ? sql`AND rc.geography && ${args.filters.geography}::text[]`
      : sql``;

    const sourceTypeFilter = args.filters?.sourceTypes?.length
      ? sql`AND rs.source_type = ANY(${args.filters.sourceTypes}::text[])`
      : sql``;

    const rows = await db.execute<{
      id:          number;
      content:     string;
      source_name: string;
      published_at: string | null;
      geography:   string[];
      trust_score: number;
      similarity:  number;
    }>(sql`
      SELECT
        rc.id,
        rc.content,
        rs.name AS source_name,
        rc.published_at,
        rc.geography,
        rc.trust_score,
        1 - (rc.embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM rag_chunks rc
      JOIN rag_sources rs ON rc.source_id = rs.id
      WHERE rc.embedding IS NOT NULL
        AND rc.trust_score >= ${minTrust}
        AND (rc.published_at IS NULL OR rc.published_at >= ${cutoffDate.toISOString()}::timestamptz)
        ${geoFilter}
        ${sourceTypeFilter}
      ORDER BY rc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `);

    if (rows.rows.length === 0) {
      return { ok: true, data: { chunks: [], totalFound: 0 } };
    }

    return {
      ok: true,
      data: {
        chunks: rows.rows.map((r) => ({
          content:     r.content,
          sourceName:  r.source_name,
          publishedAt: r.published_at ?? "",
          geography:   r.geography,
          similarity:  Math.round(r.similarity * 1000) / 1000,
          trustScore:  r.trust_score,
        })),
        totalFound: rows.rows.length,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_rag error");
    return err("UNAVAILABLE", "Ricerca knowledge base temporaneamente non disponibile");
  }
}

// ── 18b. search_memory_graph ────────────────────────────────────────────────

export async function handleSearchMemoryGraph(
  args: { query: string; limit?: number; includeCandidates?: boolean },
  userId: number,
): Promise<ToolResult> {
  if (!args.query?.trim()) return err("INVALID_INPUT", "Query memoria vuota");

  try {
    const result = await searchMemoryGraph({
      userId,
      query: args.query,
      ...(args.limit === undefined ? {} : { limit: args.limit }),
      includeCandidates: Boolean(args.includeCandidates),
    });

    return {
      ok: true,
      data: {
        ...result,
        guidance:
          result.results.length > 0
            ? "Cita le fonti interne e segnala se la confidence e bassa."
            : "Nessuna memoria personale rilevante trovata: non inventare dettagli sull'utente.",
      },
    };
  } catch (e) {
    logger.warn({ e, args, userId }, "[tool] search_memory_graph error");
    return err("UNAVAILABLE", "Memoria semantica temporaneamente non disponibile");
  }
}

// ── 19. get_weak_signals ─────────────────────────────────────────────────────

export async function handleGetWeakSignals(
  args: {
    sectorId?: string;
    status?:   string;
    limit?:    number;
    geography?: string;
  },
): Promise<ToolResult> {
  const limit = Math.min(args.limit ?? 5, 10);
  const status = readWeakSignalStatus(args.status);

  try {
    const rows = await db
      .select({
        id:              weakSignalsTable.id,
        signalType:      weakSignalsTable.signalType,
        title:           weakSignalsTable.title,
        description:     weakSignalsTable.description,
        strength:        weakSignalsTable.strength,
        status:          weakSignalsTable.status,
        linkedRoleIds:   weakSignalsTable.linkedRoleIds,
        linkedSkillIds:  weakSignalsTable.linkedSkillIds,
        geographies:     weakSignalsTable.geographies,
        firstSeenAt:     weakSignalsTable.firstSeenAt,
      })
      .from(weakSignalsTable)
      .where(
        and(
          eq(weakSignalsTable.status, status),
          args.sectorId
            ? sql`${weakSignalsTable.linkedSectorIds} @> ARRAY[${args.sectorId}]::text[]`
            : undefined,
          args.geography
            ? sql`${weakSignalsTable.geographies} @> ARRAY[${args.geography}]::text[]`
            : undefined,
        ),
      )
      .orderBy(desc(weakSignalsTable.strength))
      .limit(limit);

    return {
      ok: true,
      data: {
        signals: rows.map((s) => ({
          id:           s.id,
          signalType:   s.signalType,
          title:        s.title,
          description:  s.description,
          strength:     Math.round(s.strength * 100) / 100,
          status:       s.status,
          linkedRoles:  s.linkedRoleIds,
          linkedSkills: s.linkedSkillIds,
          geographies:  s.geographies,
          firstSeenAt:  s.firstSeenAt?.toISOString() ?? "",
        })),
        totalFound: rows.length,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_weak_signals error");
    return err("UNAVAILABLE", "Segnali deboli temporaneamente non disponibili");
  }
}

// ── 20. get_job_posting_trend ────────────────────────────────────────────────

export async function handleGetJobPostingTrend(
  args: {
    roleTitle?:   string;
    professionId?: number;
    geography:    string;
    periods:      string[];
  },
): Promise<ToolResult> {
  if (!args.roleTitle && !args.professionId)
    return err("INVALID_INPUT", "Specifica roleTitle o professionId");
  if (!args.periods?.length)
    return err("INVALID_INPUT", "Specifica almeno un periodo (es. '2025-01')");

  const periods = args.periods.slice(0, 12); // max 12 mesi

  try {
    const rows = await db
      .select({
        period:       jobPostingSnapshotsTable.period,
        count:        jobPostingSnapshotsTable.count,
        topSkills:    jobPostingSnapshotsTable.topSkills,
        avgSalaryMin: jobPostingSnapshotsTable.avgSalaryMin,
        avgSalaryMax: jobPostingSnapshotsTable.avgSalaryMax,
        growthRate:   jobPostingSnapshotsTable.growthRate,
        roleTitle:    jobPostingSnapshotsTable.roleTitle,
      })
      .from(jobPostingSnapshotsTable)
      .where(
        and(
          eq(jobPostingSnapshotsTable.geography, args.geography),
          sql`${jobPostingSnapshotsTable.period} = ANY(${periods}::text[])`,
          args.professionId
            ? eq(jobPostingSnapshotsTable.professionId, args.professionId)
            : ilike(jobPostingSnapshotsTable.roleTitle, `%${args.roleTitle}%`),
        ),
      )
      .orderBy(jobPostingSnapshotsTable.period)
      .limit(12);

    if (rows.length === 0) {
      return { ok: true, data: { roleTitle: args.roleTitle ?? "", trend: [], growthRate: 0, direction: "stable" } };
    }

    const firstRow = rows[0];
    const lastRow  = rows[rows.length - 1];
    if (!firstRow || !lastRow) {
      return { ok: true, data: { roleTitle: args.roleTitle ?? "", trend: [], growthRate: 0, direction: "stable" } };
    }
    const first = firstRow.count;
    const last  = lastRow.count;
    const growthRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    const direction  = growthRate > 5 ? "up" : growthRate < -5 ? "down" : "stable";

    return {
      ok: true,
      data: {
        roleTitle:  firstRow.roleTitle,
        trend:      rows.map((r) => ({
          period:       r.period,
          count:        r.count,
          topSkills:    r.topSkills,
          avgSalaryMin: r.avgSalaryMin,
          avgSalaryMax: r.avgSalaryMax,
        })),
        growthRate,
        direction,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_job_posting_trend error");
    return err("UNAVAILABLE", "Trend job posting temporaneamente non disponibili");
  }
}

// ── 21. get_skill_cooccurrences ──────────────────────────────────────────────

export async function handleGetSkillCooccurrences(
  args: {
    skillName:    string;
    professionId?: number;
    limit?:        number;
  },
): Promise<ToolResult> {
  if (!args.skillName?.trim()) return err("INVALID_INPUT", "skillName obbligatorio");
  const limit = Math.min(args.limit ?? 8, 15);

  try {
    const rows = await db
      .select({
        coSkillName:   skillCooccurrencesTable.coSkillName,
        frequency:     skillCooccurrencesTable.frequency,
        frequencyRate: skillCooccurrencesTable.frequencyRate,
        period:        skillCooccurrencesTable.period,
      })
      .from(skillCooccurrencesTable)
      .where(
        and(
          ilike(skillCooccurrencesTable.skillName, args.skillName),
          args.professionId
            ? eq(skillCooccurrencesTable.professionId, args.professionId)
            : undefined,
        ),
      )
      .orderBy(desc(skillCooccurrencesTable.frequencyRate))
      .limit(limit);

    return {
      ok: true,
      data: {
        skill:    args.skillName,
        coSkills: rows.map((r) => ({
          name:          r.coSkillName,
          frequency:     r.frequency,
          frequencyRate: Math.round(r.frequencyRate * 1000) / 10, // percentuale
          period:        r.period,
        })),
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] get_skill_cooccurrences error");
    return err("UNAVAILABLE", "Co-occorrenze skill temporaneamente non disponibili");
  }
}
