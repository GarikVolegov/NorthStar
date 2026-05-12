import { createHash } from "node:crypto";
import { db, routeLogsTable } from "@workspace/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import type { RouteDecision } from "./router-agent";
import { logger } from "../logger";

// ── In-memory routing context (ephemeral, per cross-session coherence) ────────

export interface RouteCommit {
  messageHash: string;
  domain: string;
  intent: string;
  confidence: number;
  contextSummary: string;
  createdAt: Date;
}

const MAX_COMMITS = 20;
const MAX_CONTEXT = 5;

const store = new Map<number, RouteCommit[]>();

function hashMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex").slice(0, 12);
}

/** Save a routing decision to in-memory store for context coherence. */
export function commitRoute(
  userId: number,
  decision: { domain: string; intent: string; confidence: number; reasoning: string },
  message: string,
): void {
  const commits = store.get(userId) ?? [];
  commits.push({
    messageHash: hashMessage(message),
    domain: decision.domain,
    intent: decision.intent,
    confidence: decision.confidence,
    contextSummary: decision.reasoning.slice(0, 120),
    createdAt: new Date(),
  });
  if (commits.length > MAX_COMMITS) {
    commits.splice(0, commits.length - MAX_COMMITS);
  }
  store.set(userId, commits);
}

/** Load recent routing context for prompt injection into the router LLM. */
export function loadRoutingContext(userId: number): string {
  const commits = store.get(userId);
  if (!commits || commits.length === 0) return "";

  const recent = commits.slice(-MAX_CONTEXT);
  const lines = recent.map(
    (c, i) =>
      `  ${i + 1}. "${c.contextSummary}" → ${c.domain}/${c.intent} (conf: ${c.confidence.toFixed(2)})`,
  );

  return [
    "## Cronologia instradamento (commit recenti)",
    "Le seguenti decisioni di routing sono state prese in messaggi precedenti.",
    "Usale come contesto per mantenere coerenza:",
    ...lines,
  ].join("\n");
}

/** Clear all in-memory commits for a user. */
export function clearRoutingHistory(userId: number): void {
  store.delete(userId);
}

// ── Persistent DB logging (for dataset analysis) ─────────────────────────────

const LOG_RETENTION_DAYS = 90;

/** Persist a routing decision to the route_logs table. */
export async function logRouteDecision(
  userId: number,
  decision: RouteDecision,
  message: string,
): Promise<void> {
  try {
    await db.insert(routeLogsTable).values({
      userId,
      message,
      messageHash: hashMessage(message),
      domain: decision.domain,
      intent: decision.intent,
      confidence: decision.confidence,
      threshold: decision.threshold,
      reasoning: decision.reasoning.slice(0, 500),
      isFallback: decision.isFallback ?? false,
      fallbackReason: decision.fallbackReason?.slice(0, 500) ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "logRouteDecision failed");
  }
}

/** Build a human-readable summary of recent routing patterns for a user. */
export async function buildRoutingHistorySummary(userId: number): Promise<string> {
  try {
    const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const logs = await db
      .select({
        domain: routeLogsTable.domain,
        intent: routeLogsTable.intent,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(routeLogsTable)
      .where(
        and(
          eq(routeLogsTable.userId, userId),
          gte(routeLogsTable.createdAt, cutoff),
        ),
      )
      .groupBy(routeLogsTable.domain, routeLogsTable.intent)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    if (logs.length === 0) return "";

    const lines = logs.map(
      (l) => `  - **${l.domain}** con intento **${l.intent}** (${l.count} volte)`,
    );

    return [
      "## Routing recente",
      "Tendenza dell'utente nelle ultime interazioni:",
      ...lines,
      "",
      "Se l'utente è in modalità 'vent' da più turni consecutivi, riconosci lo sfogo ma proponi delicatamente di passare a un piano concreto.",
      "Se l'utente torna sullo stesso tema più volte, sottolinealo con naturalezza.",
    ].join("\n");
  } catch (err) {
    logger.warn({ err }, "buildRoutingHistorySummary failed");
    return "";
  }
}

/** Export routing logs for a specific user (dataset analysis). */
export async function getRoutingLog(
  userId: number,
  limit = 200,
): Promise<Array<{
  id: number;
  message: string;
  domain: string;
  intent: string;
  confidence: number;
  threshold: number;
  reasoning: string | null;
  isFallback: boolean;
  createdAt: Date;
}>> {
  const logs = await db
    .select({
      id: routeLogsTable.id,
      message: routeLogsTable.message,
      domain: routeLogsTable.domain,
      intent: routeLogsTable.intent,
      confidence: routeLogsTable.confidence,
      threshold: routeLogsTable.threshold,
      reasoning: routeLogsTable.reasoning,
      isFallback: routeLogsTable.isFallback,
      createdAt: routeLogsTable.createdAt,
    })
    .from(routeLogsTable)
    .where(eq(routeLogsTable.userId, userId))
    .orderBy(desc(routeLogsTable.createdAt))
    .limit(limit);
  return logs;
}

/** Export routing logs across all users (admin analysis). */
export async function getAllRoutingLogs(
  limit = 1000,
): Promise<Array<{
  id: number;
  userId: number;
  message: string;
  domain: string;
  intent: string;
  confidence: number;
  threshold: number;
  isFallback: boolean;
  createdAt: Date;
}>> {
  const logs = await db
    .select({
      id: routeLogsTable.id,
      userId: routeLogsTable.userId,
      message: routeLogsTable.message,
      domain: routeLogsTable.domain,
      intent: routeLogsTable.intent,
      confidence: routeLogsTable.confidence,
      threshold: routeLogsTable.threshold,
      isFallback: routeLogsTable.isFallback,
      createdAt: routeLogsTable.createdAt,
    })
    .from(routeLogsTable)
    .orderBy(desc(routeLogsTable.createdAt))
    .limit(limit);
  return logs;
}
