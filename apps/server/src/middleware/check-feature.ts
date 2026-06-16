/**
 * check-feature.ts — gate accesso alle feature per piano.
 *
 * Usa la tabella subscriptions per determinare il piano effettivo dell'utente.
 * Non blocca con 403 — restituisce { allowed, requiredPlan } per gestione soft.
 *
 * SECURITY: userId sempre da JWT (req.user.id), mai dal body.
 */
import { db, subscriptionsTable } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { cached, cacheDel } from "../lib/redis";

// ── Feature gate definitions ──────────────────────────────────────────────────

export const FEATURE_GATES = {
  // Wendy
  wendy_unlimited:       "pro",
  wendy_focus_mode:      "pro",
  wendy_long_memory:     "pro",
  wendy_briefing_auto:   "pro",
  wendy_briefing_daily:  "team",

  // RAG e intelligence
  rag_search:            "pro",
  weak_signals:          "pro",
  job_posting_trends:    "pro",

  // Piani
  unlimited_plans:       "pro",
  export_plan_pdf:       "pro",
  export_plan_csv:       "team",

  // File
  file_upload:           "pro",

  // Collaborazione
  workspace_shared:      "team",
  mentor_mode:           "team",
  team_dashboard:        "team",
} as const satisfies Record<string, "free" | "pro" | "team">;

export type FeatureKey = keyof typeof FEATURE_GATES;

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2 };

// ── Subscription lookup (cached in shared Redis per 60s) ──────────────────────
//
// Shared Redis cache (not in-process) so the effective plan is consistent across
// replicas / serverless instances: after a webhook upgrade or cancellation,
// invalidatePlanCache() clears it for every instance. Best-effort — if Redis is
// down, cached() always recomputes from the DB (fail-open, never stale).

const PLAN_CACHE_TTL_SECONDS = 60;
const planCacheKey = (userId: number): string => `plan:${userId}`;

export async function getEffectivePlan(userId: number): Promise<"free" | "pro" | "team"> {
  return cached(planCacheKey(userId), PLAN_CACHE_TTL_SECONDS, async () => {
    const [sub] = await db
      .select({ plan: subscriptionsTable.plan, validUntil: subscriptionsTable.validUntil })
      .from(subscriptionsTable)
      .where(and(
        eq(subscriptionsTable.userId, userId),
        isNull(subscriptionsTable.cancelledAt),
      ))
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(1);

    const plan     = sub?.plan ?? "free";
    const expired  = sub?.validUntil ? sub.validUntil < new Date() : false;
    return (expired ? "free" : plan) as "free" | "pro" | "team";
  });
}

export function planMeets(currentPlan: string, requiredPlan: "free" | "pro" | "team"): boolean {
  return (PLAN_RANK[currentPlan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0);
}

/**
 * Clear the cached plan for a user across all instances. Synchronous signature
 * (fire-and-forget) so call sites — including the Stripe webhook — stay simple;
 * the Redis delete is best-effort and the 60s TTL bounds any residual staleness.
 */
export function invalidatePlanCache(userId: number): void {
  void cacheDel(planCacheKey(userId));
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function checkFeatureAccess(
  userId: number,
  feature: FeatureKey,
): Promise<{ allowed: boolean; requiredPlan: string; currentPlan: string }> {
  const required    = FEATURE_GATES[feature];
  const currentPlan = await getEffectivePlan(userId);
  const allowed     = planMeets(currentPlan, required);
  return { allowed, requiredPlan: required, currentPlan };
}

/** Express middleware factory — risponde con SSE gate event o JSON 402 */
export function requireFeature(feature: FeatureKey, responseType: "json" | "sse" = "json") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

    const { allowed, requiredPlan, currentPlan } = await checkFeatureAccess(userId, feature);
    if (allowed) { next(); return; }

    if (responseType === "sse") {
      res.setHeader("Content-Type", "text/event-stream");
      res.write(`data: ${JSON.stringify({ type: "gate", feature, requiredPlan, currentPlan })}\n\n`);
      res.end();
    } else {
      res.status(402).json({ code: "PLAN_REQUIRED", feature, requiredPlan, currentPlan });
    }
  };
}
