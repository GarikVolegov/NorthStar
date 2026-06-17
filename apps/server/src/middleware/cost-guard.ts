import { type Request, type Response, type NextFunction } from "express";
import { sql, and, gte, eq } from "drizzle-orm";
import { db, aiCostLogTable } from "@workspace/db";
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

type CostGuardPlan = keyof typeof MONTHLY_LIMITS;

declare global {
  namespace Express {
    interface Request {
      costGuard?: {
        plan: CostGuardPlan;
        monthlyLimit: number;
        currentCost: number;
      };
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

async function getPlan(req: Request): Promise<CostGuardPlan> {
  if (process.env.LLM_COST_GUARD_DISABLED === "true") return "enterprise";
  if (req.user?.stripeSubscriptionId?.startsWith("enterprise_"))
    return "enterprise";
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
 * Reads cumulative monthly spend from ai_cost_log.cost_usd_estimate (populated by
 * recordAiCall on the /api/ai/wendy route). llm_usage is deprecated — the cost-guard
 * no longer writes to or reads from it.
 */
export async function costGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  try {
    const userId = req.user.id;
    const plan = await getPlan(req);
    const monthlyLimit = MONTHLY_LIMITS[plan];
    const { start, end } = currentMonthRange();

    if (plan === "enterprise") {
      next();
      return;
    }

    const [result] = await db
      .select({
        totalCost: sql<number>`coalesce(sum(${aiCostLogTable.costUsdEstimate}), 0)::float`,
      })
      .from(aiCostLogTable)
      .where(
        and(
          eq(aiCostLogTable.userId, userId),
          gte(aiCostLogTable.createdAt, start),
          sql`${aiCostLogTable.createdAt} < ${end}`,
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

    req.costGuard = { plan, monthlyLimit, currentCost };
    next();
  } catch (err) {
    rootLogger.error({ err }, "[cost-guard] check failed — allowing request");
    next();
  }
}
