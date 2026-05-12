/**
 * Router Memory — "commit-style" routing decision persistence.
 *
 * Every time the router agent classifies a message, the decision
 * (domain, intent, confidence, context hash) is saved as a "commit".
 * Future routing calls load recent commits as context, so the router
 * can make consistent decisions across a conversation.
 */

import { createHash } from "node:crypto";

export interface RouteCommit {
  messageHash: string;
  domain: string;
  intent: string;
  confidence: number;
  contextSummary: string;
  createdAt: Date;
}

const MAX_COMMITS = 20; // max stored per user in memory
const MAX_CONTEXT = 5;  // last N commits injected into prompt

// In-memory store keyed by userId (ephemeral — resets on server restart)
const store = new Map<number, RouteCommit[]>();

function hashMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex").slice(0, 12);
}

/** Save a routing decision */
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
  // Keep only last MAX_COMMITS
  if (commits.length > MAX_COMMITS) {
    commits.splice(0, commits.length - MAX_COMMITS);
  }
  store.set(userId, commits);
}

/** Load recent routing context for prompt injection */
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

/** Clear all commits for a user */
export function clearRoutingHistory(userId: number): void {
  store.delete(userId);
}
