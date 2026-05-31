/**
 * Quality Optimizer Job
 *
 * Runs daily. Analyses the last 30 days of ai_request_log + supervisor_logs
 * + wendy_feedback to detect quality regressions and propose config changes.
 *
 * Three analyses:
 *
 * 1. PLATITUDE PATTERN LEARNING
 *    Reads supervisor_logs where score_before < threshold (rewrites triggered).
 *    Sends the rewritten drafts to GPT-4o-mini asking for recurring generic phrases.
 *    Proposes new PLATITUDE_PATTERNS if novel phrases found.
 *
 * 2. ROUTING THRESHOLD CALIBRATION
 *    For each domain × intent with avg supervisor_score < 0.65 in last 30 days
 *    and ≥ 20 samples: proposes +0.05 threshold increase (capped at 0.90).
 *    For domains with avg > 0.85 and ≥ 20 samples: proposes -0.05 relaxation.
 *
 * 3. MODEL ESCALATION
 *    For domain × intent combos where down-vote rate > 30% and ≥ 10 feedbacks:
 *    proposes escalating from current tier to the next one.
 *
 * All proposals are fire-and-forget: written to wendy_optimizer_proposals with
 * status='pending'. An admin must approve before any change takes effect.
 * autoApprove is intentionally false — changes to AI behaviour need human sign-off.
 */
import { aiCostLogTable, db, supervisorLogs, wendyOptimizerProposalsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openai } from "../client";
import { selectModelFor } from "../model-router";
import { logger } from "../logger";
import { wendyConfig } from "../config/wendy";

// ── Helpers ───────────────────────────────────────────────────────────────────

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 86_400_000);
}

function isDuplicateProposal(
  existing: Array<{ type: string; payload: unknown }>,
  type: string,
  matchKey: string,
  matchValue: unknown,
): boolean {
  return existing.some((p) => {
    if (p.type !== type) return false;
    const payload = p.payload as Record<string, unknown>;
    return payload[matchKey] === matchValue;
  });
}

// ── Analysis 1: Platitude pattern learning ───────────────────────────────────

async function analysePlatitudePatterns(since: Date): Promise<void> {
  const rewrites = await db
    .select({ draft: supervisorLogs.draft, reasons: supervisorLogs.reasons })
    .from(supervisorLogs)
    .where(
      sql`${supervisorLogs.createdAt} >= ${since}
        AND ${supervisorLogs.scoreBefore} < ${wendyConfig.supervisor.passThreshold}`,
    )
    .limit(200);

  if (rewrites.length < 10) return; // not enough signal

  const sampleDrafts = rewrites
    .slice(0, 40)
    .map((r) => r.draft.slice(0, 300))
    .join("\n---\n");

  const route = selectModelFor("memory-extract"); // gpt-4o-mini
  let rawJson: string;
  try {
    const resp = await openai.chat.completions.create({
      model: route.model,
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Analizza questi testi che sono stati riscritti perché contenevano frasi generiche o motivazionali vuote.
Identifica fino a 5 nuove frasi/pattern generici ricorrenti che NON sono già nella lista esistente.
Rispondi SOLO con JSON: { "patterns": [{ "pattern": "regex-like phrase", "examples": ["frase esatta 1", "frase esatta 2"] }] }
Se non trovi pattern nuovi, rispondi: { "patterns": [] }`,
        },
        { role: "user", content: sampleDrafts },
      ],
    });
    rawJson = resp.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    logger.warn({ err }, "[quality-optimizer] platitude analysis LLM call failed");
    return;
  }

  let parsed: { patterns?: Array<{ pattern: string; examples?: string[] }> };
  try {
    parsed = JSON.parse(rawJson) as typeof parsed;
  } catch {
    return;
  }

  const proposals = (parsed.patterns ?? []).filter((p) => p.pattern?.trim());
  if (proposals.length === 0) return;

  const existing = await db
    .select({ type: wendyOptimizerProposalsTable.type, payload: wendyOptimizerProposalsTable.payload })
    .from(wendyOptimizerProposalsTable)
    .where(sql`${wendyOptimizerProposalsTable.type} = 'platitude_pattern' AND ${wendyOptimizerProposalsTable.status} != 'rejected'`);

  for (const p of proposals) {
    if (isDuplicateProposal(existing, "platitude_pattern", "pattern", p.pattern)) continue;
    await db.insert(wendyOptimizerProposalsTable).values({
      type: "platitude_pattern",
      payload: { pattern: p.pattern, examplePhrases: p.examples ?? [] },
      evidence: { samplesAnalysed: rewrites.length, since: since.toISOString() },
    }).catch((err) => logger.warn({ err }, "[quality-optimizer] proposal insert failed"));
    logger.info({ pattern: p.pattern }, "[quality-optimizer] proposed platitude pattern");
  }
}

// ── Analysis 2: Routing threshold calibration ────────────────────────────────

async function analyseRoutingThresholds(since: Date): Promise<void> {
  const stats = await db
    .select({
      domain:   aiCostLogTable.domain,
      intent:   aiCostLogTable.intent,
      count:    sql<number>`count(*)::int`,
      avgScore: sql<number>`avg(${aiCostLogTable.supervisorScore})`,
    })
    .from(aiCostLogTable)
    .where(
      sql`${aiCostLogTable.createdAt} >= ${since}
        AND ${aiCostLogTable.domain} IS NOT NULL
        AND ${aiCostLogTable.supervisorScore} IS NOT NULL`,
    )
    .groupBy(aiCostLogTable.domain, aiCostLogTable.intent)
    .having(sql`count(*) >= 20`);

  if (stats.length === 0) return;

  const existing = await db
    .select({ type: wendyOptimizerProposalsTable.type, payload: wendyOptimizerProposalsTable.payload })
    .from(wendyOptimizerProposalsTable)
    .where(sql`${wendyOptimizerProposalsTable.type} = 'threshold_adjust' AND ${wendyOptimizerProposalsTable.status} = 'pending'`);

  for (const row of stats) {
    if (!row.domain || !row.intent) continue;
    const key = `${row.domain}:${row.intent}`;

    if (row.avgScore < 0.65) {
      // Quality too low — propose raising threshold (stricter routing)
      const currentThreshold =
        (wendyConfig.router.intentThresholds[row.intent]?.base ?? 0.60);
      const proposed = Math.min(0.90, currentThreshold + 0.05);
      if (isDuplicateProposal(existing, "threshold_adjust", "domainIntent", key)) continue;
      await db.insert(wendyOptimizerProposalsTable).values({
        type: "threshold_adjust",
        payload: { domain: row.domain, intent: row.intent, domainIntent: key, direction: "increase", delta: 0.05, newValue: proposed },
        evidence: { avgScore: row.avgScore, sampleCount: row.count, since: since.toISOString() },
      }).catch((err) => logger.warn({ err }, "[quality-optimizer] threshold proposal failed"));

    } else if (row.avgScore > 0.85) {
      // Quality high — propose relaxing threshold (more traffic through pipeline)
      const currentThreshold =
        (wendyConfig.router.intentThresholds[row.intent]?.base ?? 0.60);
      const proposed = Math.max(0.30, currentThreshold - 0.05);
      if (isDuplicateProposal(existing, "threshold_adjust", "domainIntent", key)) continue;
      await db.insert(wendyOptimizerProposalsTable).values({
        type: "threshold_adjust",
        payload: { domain: row.domain, intent: row.intent, domainIntent: key, direction: "decrease", delta: 0.05, newValue: proposed },
        evidence: { avgScore: row.avgScore, sampleCount: row.count, since: since.toISOString() },
      }).catch((err) => logger.warn({ err }, "[quality-optimizer] threshold proposal failed"));
    }
  }
}

// ── Analysis 3: Model escalation from down-vote rate ────────────────────────

const TIER_ESCALATION: Record<string, string> = {
  nano:      "micro",
  micro:     "standard",
  standard:  "reasoning",
};

async function analyseModelEscalation(since: Date): Promise<void> {
  // Use ai_cost_log.user_feedback to get per-domain down-vote rates.
  const feedbackStats = await db
    .select({
      domain:    aiCostLogTable.domain,
      intent:    aiCostLogTable.intent,
      tier:      aiCostLogTable.tier,
      total:     sql<number>`count(*)::int`,
      downVotes: sql<number>`count(*) filter (where ${aiCostLogTable.userFeedback} = 'down')::int`,
    })
    .from(aiCostLogTable)
    .where(
      sql`${aiCostLogTable.createdAt} >= ${since}
        AND ${aiCostLogTable.domain} IS NOT NULL
        AND ${aiCostLogTable.userFeedback} IS NOT NULL`,
    )
    .groupBy(aiCostLogTable.domain, aiCostLogTable.intent, aiCostLogTable.tier)
    .having(sql`count(*) >= 10`);

  if (feedbackStats.length === 0) return;

  const existing = await db
    .select({ type: wendyOptimizerProposalsTable.type, payload: wendyOptimizerProposalsTable.payload })
    .from(wendyOptimizerProposalsTable)
    .where(sql`${wendyOptimizerProposalsTable.type} = 'model_escalation' AND ${wendyOptimizerProposalsTable.status} = 'pending'`);

  for (const row of feedbackStats) {
    if (!row.domain || !row.intent || !row.tier) continue;
    const downRate = row.downVotes / row.total;
    if (downRate < 0.30) continue;

    const nextTier = TIER_ESCALATION[row.tier];
    if (!nextTier) continue; // already at highest tier

    const key = `${row.domain}:${row.intent}`;
    if (isDuplicateProposal(existing, "model_escalation", "domainIntent", key)) continue;

    await db.insert(wendyOptimizerProposalsTable).values({
      type: "model_escalation",
      payload: { domain: row.domain, intent: row.intent, domainIntent: key, currentTier: row.tier, proposedTier: nextTier },
      evidence: { downVoteRate: downRate, total: row.total, downVotes: row.downVotes, since: since.toISOString() },
    }).catch((err) => logger.warn({ err }, "[quality-optimizer] escalation proposal failed"));
    logger.info({ domain: row.domain, intent: row.intent, downRate }, "[quality-optimizer] proposed model escalation");
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function runQualityOptimizerJob(): Promise<{ proposed: number }> {
  const since = thirtyDaysAgo();
  const countBefore = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wendyOptimizerProposalsTable)
    .where(sql`${wendyOptimizerProposalsTable.status} = 'pending'`)
    .then((r) => r[0]?.count ?? 0);

  await Promise.allSettled([
    analysePlatitudePatterns(since),
    analyseRoutingThresholds(since),
    analyseModelEscalation(since),
  ]);

  const countAfter = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(wendyOptimizerProposalsTable)
    .where(sql`${wendyOptimizerProposalsTable.status} = 'pending'`)
    .then((r) => r[0]?.count ?? 0);

  const proposed = countAfter - countBefore;
  logger.info({ proposed }, "[quality-optimizer] job completed");
  return { proposed };
}
