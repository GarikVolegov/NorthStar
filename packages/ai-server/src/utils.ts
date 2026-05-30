import { logger } from "./logger";

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  serviceName: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        clearTimeout(timeout);
        reject(new Error(`${serviceName} timeout after ${ms}ms`));
      }, ms);
    }),
  ]);
}

export async function gracefulDegrade<T>(
  promise: Promise<T>,
  fallback: T,
  logMessage: string,
): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    logger.warn({ err }, logMessage);
    return fallback;
  }
}

/** Type guard for a plain object (non-null, non-array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Clamp a possibly-undefined number into [0, 1], falling back when non-finite. */
export function clamp01(value: number | undefined, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, Number(value)));
}

/** Run `mapper` over `items` with a bounded worker pool, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await mapper(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
