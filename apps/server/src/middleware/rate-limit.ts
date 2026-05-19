import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request } from "express";
import { getEffectivePlan, planMeets } from "./check-feature";

function requestIpKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

function buildOptions(overrides: Partial<Options>): Partial<Options> {
  const base: Partial<Options> = {
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: requestIpKey,
    message: { error: "Troppe richieste. Riprova tra poco." },
  };
  return { ...base, ...overrides };
}

export const globalLimiter = rateLimit(
  buildOptions({
    windowMs: 60 * 1000,
    max: 100,
    skip: () => process.env.NODE_ENV === "development",
  }),
);

export const wendyLimiter = rateLimit(
  buildOptions({
    windowMs: 60 * 1000,
    max: 30,
    skip: (_req: Request) =>
      process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true",
  }),
);

export const wendyIpLimiter = rateLimit(
  buildOptions({
    windowMs: 60 * 1000,
    max: 10,
    keyGenerator: requestIpKey,
    skip: (_req: Request) =>
      process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true",
    message: { error: "Troppe richieste da questo IP. Riprova tra poco." },
  }),
);

export const authLimiter = rateLimit(
  buildOptions({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: "Troppi tentativi di login. Riprova tra 15 minuti." },
  }),
);

export const adminLimiter = rateLimit(
  buildOptions({ windowMs: 60 * 1000, max: 200 }),
);

const FREE_AI_DAILY_LIMIT = parseInt(process.env.FREE_AI_DAILY_LIMIT ?? "10", 10);
const PRO_AI_DAILY_LIMIT = parseInt(process.env.PRO_AI_DAILY_LIMIT ?? "200", 10);

export const planQuotaLimiter = rateLimit(
  buildOptions({
    windowMs: 86400 * 1000,
    max: async (req: Request) => {
      const userId = (req as any).user?.id;
      if (!userId) return FREE_AI_DAILY_LIMIT;
      const currentPlan = await getEffectivePlan(userId);
      return planMeets(currentPlan, "pro") ? PRO_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT;
    },
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      return userId ? `plan-user-${userId}` : `plan-ip-${requestIpKey(req)}`;
    },
    skip: (_req: Request) =>
      process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true",
    message: {
      error: "Hai raggiunto il limite giornaliero dei messaggi.",
      code: "QUOTA_EXCEEDED",
    },
  }),
);
