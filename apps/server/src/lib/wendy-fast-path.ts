import { getLocalWendyFallbackReply } from "@workspace/ai-server";

export function readPositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function withRouteTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function buildFastPathFallback(message: string): string {
  const knownFallback = getLocalWendyFallbackReply(message);
  if (knownFallback) return knownFallback.text;

  return "Ci sono, ma il modello sta rispondendo troppo lentamente. Prova a rifare la domanda in modo piu diretto oppure dimmi quale pagina o strumento vuoi usare e ti indirizzo subito.";
}
