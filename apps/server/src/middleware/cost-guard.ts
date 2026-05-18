import { type Request, type Response, type NextFunction } from "express";
import { sql, and, gte, eq } from "drizzle-orm";
import { db, llmUsageTable } from "@workspace/db";
import { rootLogger } from "./logger";
import { getEffectivePlan } from "./check-feature";

// ── Config ──────────────────────────────────────────────────────────

/**
 * Monthly LLM cost limits (USD) per plan.
 * Override via env: LLM_COST_LIMIT_FREE, LLM_COST_LIMIT_PRO, LLM_COST_LIMIT_ENTERPRISE
 */
const MONTHLY_LIMITS = {
  free: parseFloat(process.env.LLM_COST_LIMIT_FREE ?? "0.50"),
  pro: parseFloat(process.env.LLM_COST_LIMIT_PRO ?? "10.00"),
  enterprise: parseFloat(process.env.LLM_COST_LIMIT_ENTERPRISE ?? "100.00"),
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

/** Determine the user's plan tier based on the effective internal entitlement. */
async function getPlan(req: Request): Promise<"free" | "pro" | "enterprise"> {
  if (process.env.LLM_COST_GUARD_DISABLED === "true") return "enterprise";
  // Enterprise: manual flag or specific env
  if (req.user?.stripeSubscriptionId?.startsWith("enterprise_")) return "enterprise";
  if (!req.user?.id) return "free";
  const currentPlan = await getEffectivePlan(req.user.id);
  return currentPlan === "free" ? "free" : "pro";
}

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// ── Middleware ───────────────────────────────────────────────────────

/**
 * LLM Cost Guard Middleware
 *
 * Checks cumulative monthly LLM spend before allowing the request through.
 * If the user's plan limit is exceeded, returns 403 with COST_LIMIT_EXCEEDED.
 *
 * Usage:
 *   router.post("/ask", requireAuth, costGuard, wendyLimiter, handler);
 */
export async function costGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    const userId = req.user.id;
    const plan = await getPlan(req);
    const monthlyLimit = MONTHLY_LIMITS[plan];
    const { start, end } = currentMonthRange();

    // Skip check for enterprise (unlimited)
    if (plan === "enterprise") {
      next();
      return;
    }

    // Aggregate monthly cost from llm_usage
    const [result] = await db
      .select({
        totalCost: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
      })
      .from(llmUsageTable)
      .where(
        and(
          eq(llmUsageTable.userId, userId),
          gte(llmUsageTable.createdAt, start),
          sql`${llmUsageTable.createdAt} < ${end}`,
        ),
      );

    const currentCost = result?.totalCost ?? 0;

    if (currentCost >= monthlyLimit) {
      rootLogger.warn(
        { userId, plan, currentCost, monthlyLimit },
        "[cost-guard] Monthly LLM cost limit exceeded",
      );

      res.status(403).json({
        error: "Hai raggiunto il limite di costo mensile per l'AI.",
        code: "COST_LIMIT_EXCEEDED",
        plan,
        limit: monthlyLimit,
        current: currentCost,
      });
      return;
    }

    // Attach current usage info so downstream code can log it
    (req as any).costGuard = { plan, monthlyLimit, currentCost };
    next();
  } catch (err) {
    // If the guard itself fails (e.g. DB error), allow the request through
    // but log the error. Better to serve slightly over budget than break.
    rootLogger.error({ err }, "[cost-guard] check failed — allowing request");
    next();
  }
}
