/**
 * supervisor-pattern-analyzer.ts
 * Weekly self-improvement job for the SupervisorAgent.
 *
 * WHAT IT DOES
 * ────────────
 * 1. Reads the last 7 days of supervisor_logs (rewrites only).
 * 2. Sends the batch to GPT-4o-mini with a structured analysis prompt.
 * 3. GPT-4o-mini returns:
 *    - new PLATITUDE_PATTERNS to add (regex strings)
 *    - new ACTION_PATTERNS to add (regex strings)
 *    - summary of dominant failure reasons
 * 4. Logs the proposal to console / a Slack webhook (if configured).
 *    The proposal is NOT auto-applied — a human reviews and merges.
 *
 * HOW TO RUN
 * ──────────
 * Option A — cron (recommended):
 *   Add to your cron / Vercel cron job:
 *   0 9 * * 1  npx tsx src/growth-agent/supervisor-pattern-analyzer.ts
 *
 * Option B — manual:
 *   npx tsx src/growth-agent/supervisor-pattern-analyzer.ts
 *
 * Option C — HTTP endpoint (add a protected POST /api/admin/analyze-supervisor):
 *   import { runPatternAnalysis } from "./supervisor-pattern-analyzer";
 *   router.post("/admin/analyze-supervisor", adminOnly, () => runPatternAnalysis());
 */
import { logger } from "../logger";
import { openai } from "../client";
import { db } from "../db/client";
import { supervisorLogs } from "../db/schema";
import { gte } from "drizzle-orm";
import { selectModelFor } from "../model-router";

export interface PatternProposal {
  newPlatitudePatterns: string[]; // regex strings to add to PLATITUDE_PATTERNS
  newActionPatterns:    string[]; // regex strings to add to ACTION_PATTERNS
  dominantReasons:      string[]; // top failure reasons from the week
  totalRewrites:        number;
  analyzedAt:           string;   // ISO timestamp
}

export async function runPatternAnalysis(): Promise<PatternProposal | null> {
  if (!db) {
    logger.warn("[pattern-analyzer] DB not available, skipping.");
    return null;
  }

  // ── 1. Fetch last 7 days of logs ───────────────────────────────────────
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const logs = await db
    .select()
    .from(supervisorLogs)
    .where(gte(supervisorLogs.createdAt, since))
    .limit(200); // cap to avoid token overflow

  if (!logs.length) {
    logger.info("[pattern-analyzer] No rewrite logs in last 7 days. Nothing to analyze.");
    return null;
  }

  logger.info({ logCount: logs.length }, "[pattern-analyzer] Analyzing rewrite logs from last 7 days");

  // ── 2. Build compact batch for GPT-4o-mini ─────────────────────────────
  // Truncate drafts to 300 chars to keep prompt compact
  const batch = logs.map((l, i) => {
    const reasons = (() => { try { return JSON.parse(l.reasons) as string[]; } catch { return [l.reasons]; } })();
    return (
      `--- LOG ${i + 1} | domain:${l.domain} intent:${l.intent} score:${l.scoreBefore} ---\n` +
      `REASONS: ${reasons.join(" | ")}\n` +
      `DRAFT (first 300 chars): ${l.draft.slice(0, 300)}\n` +
      `REWRITTEN (first 200 chars): ${l.finalText.slice(0, 200)}`
    );
  }).join("\n\n");

  const systemPrompt = `
Sei un analista di qualit\u00e0 per un sistema di AI coaching (NorthStar).
Ricevi un batch di risposte che il SupervisorAgent ha riscritto perch\u00e9 non superavano il quality gate.

Il tuo compito:
1. Identifica frasi GENERICHE o PLATITUDINI ricorrenti nelle bozze non riuscite.
   Proponi nuovi pattern regex da aggiungere a PLATITUDE_PATTERNS.
   Formato: /pattern regex/i  (stringa raw, sar\u00e0 usata con new RegExp)

2. Identifica PATTERN DI AZIONE che potrebbero essere aggiunti ad ACTION_PATTERNS
   per rilevare meglio risposte actionable in italiano.

3. Elenca i 3-5 motivi di fallimento pi\u00f9 frequenti.

Rispondi SOLO con JSON valido in questo formato:
{
  "newPlatitudePatterns": ["pattern1", "pattern2"],
  "newActionPatterns": ["pattern1"],
  "dominantReasons": ["reason1", "reason2", "reason3"]
}`.trim();

  // ── 3. Call LLM (router-selected) ────────────────────────────────────────
  let proposal: PatternProposal;
  try {
    const route = selectModelFor("supervisor-pattern");
    const res = await openai.chat.completions.create({
      model:           route.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `BATCH (${logs.length} logs):\n\n${batch}` },
      ],
      response_format: { type: "json_object" },
      temperature:     0,
      max_tokens:      800,
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as {
      newPlatitudePatterns?: string[];
      newActionPatterns?:    string[];
      dominantReasons?:      string[];
    };

    proposal = {
      newPlatitudePatterns: parsed.newPlatitudePatterns ?? [],
      newActionPatterns:    parsed.newActionPatterns    ?? [],
      dominantReasons:      parsed.dominantReasons      ?? [],
      totalRewrites:        logs.length,
      analyzedAt:           new Date().toISOString(),
    };
  } catch (err) {
    logger.error({ err }, "[pattern-analyzer] GPT call failed");
    return null;
  }

  // ── 4. Log proposal ───────────────────────────────────────────────────
  logger.info({
    totalRewrites: proposal.totalRewrites,
    analyzedAt: proposal.analyzedAt,
    platitudePatterns: proposal.newPlatitudePatterns,
    actionPatterns: proposal.newActionPatterns,
    dominantReasons: proposal.dominantReasons,
  }, "[pattern-analyzer] SUPERVISOR PATTERN PROPOSAL");

  // Optional: post to Slack if webhook is configured
  const slackUrl = process.env.SLACK_SUPERVISOR_WEBHOOK;
  if (slackUrl && proposal.newPlatitudePatterns.length > 0) {
    const text = [
      `*NorthStar Supervisor — Weekly Pattern Proposal*`,
      `Rewrites analyzed: ${proposal.totalRewrites}`,
      ``,
      `*New PLATITUDE_PATTERNS:*`,
      ...proposal.newPlatitudePatterns.map((p) => `\`/${p}/i\``),
      ``,
      `*New ACTION_PATTERNS:*`,
      ...proposal.newActionPatterns.map((p) => `\`/${p}/i\``),
      ``,
      `*Dominant failure reasons:*`,
      ...proposal.dominantReasons.map((r) => `\u2022 ${r}`),
    ].join("\n");

    fetch(slackUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
    }).catch((e: unknown) => logger.warn({ err: e }, "[pattern-analyzer] Slack post failed"));
  }

  return proposal;
}

// Allow running directly: npx tsx src/growth-agent/supervisor-pattern-analyzer.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  runPatternAnalysis().then(() => process.exit(0)).catch((err) => logger.error({ err }, "[pattern-analyzer] run failed"));
}
