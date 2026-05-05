import { type Request, type Response, type NextFunction } from "express";

interface BucketEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs: number;
  freeLimit: number;
  premiumLimit: number;
  group: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const userId = res.locals.userId as number | undefined;
    const isPremium = !!(res.locals.user as { stripeSubscriptionId?: string } | undefined)
      ?.stripeSubscriptionId;

    const key = userId ? `user:${userId}:${options.group}` : `ip:${req.ip}:${options.group}`;
    const limit = isPremium ? options.premiumLimit : options.freeLimit;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= limit) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: "Limite richieste AI raggiunto. Riprova tra poco.",
        retryAfter: retryAfterSec,
        isPremiumFeature: !isPremium,
        message: isPremium
          ? `Limite ${options.premiumLimit} richieste/ora raggiunto. Riprova tra ${Math.ceil(retryAfterSec / 60)} minuti.`
          : `Hai raggiunto il limite di ${options.freeLimit} richieste/ora. Passa a Premium per richieste illimitate.`,
      });
      return;
    }

    bucket.count++;
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(limit - bucket.count));
    next();
  };
}

export const aiChatRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  freeLimit: 20,
  premiumLimit: 500,
  group: "ai-chat",
});

export const aiGenerationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  freeLimit: 5,
  premiumLimit: 50,
  group: "ai-generation",
});
