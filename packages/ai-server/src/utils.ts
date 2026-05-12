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
