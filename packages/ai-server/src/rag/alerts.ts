import { ragConfig } from "../config/rag";
import { logger } from "../logger";

type RagEvent = {
  at: number;
  fallback: boolean;
  empty: boolean;
};

const events: RagEvent[] = [];
const lastAlertAt = new Map<string, number>();

function prune(now: number): void {
  const cutoff = now - ragConfig.alerts.windowMs;
  while (events.length > 0 && (events[0]?.at ?? now) < cutoff) {
    events.shift();
  }
}

async function sendSentryAlert(key: string, message: string, extra: Record<string, unknown>): Promise<void> {
  const sentry = (globalThis as { Sentry?: { captureMessage?: (message: string, context?: unknown) => void } }).Sentry;
  if (!sentry?.captureMessage) return;
  sentry.captureMessage(message, {
    level: "warning",
    tags: { subsystem: "rag", alert: key },
    extra,
  });
}

async function sendPagerAlert(message: string, extra: Record<string, unknown>): Promise<void> {
  const url = process.env.PAGERDUTY_EVENTS_URL || process.env.RAG_PAGER_WEBHOOK_URL;
  if (!url || typeof fetch !== "function") return;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, severity: "warning", source: "ai-server.rag", extra }),
  });
}

async function maybeAlert(
  key: string,
  rate: number,
  threshold: number,
  total: number,
): Promise<void> {
  if (rate <= threshold) return;
  const now = Date.now();
  const previous = lastAlertAt.get(key) ?? 0;
  if (now - previous < ragConfig.alerts.cooldownMs) return;
  lastAlertAt.set(key, now);

  const message = `[rag] ${key} ${(rate * 100).toFixed(1)}% over ${Math.round(ragConfig.alerts.windowMs / 60_000)}m`;
  const extra = { rate, threshold, total, windowMs: ragConfig.alerts.windowMs };
  logger.warn(extra, message);

  await Promise.allSettled([
    sendSentryAlert(key, message, extra),
    sendPagerAlert(message, extra),
  ]);
}

export function recordRagAlertSample(sample: { fallback: boolean; empty: boolean }): void {
  const now = Date.now();
  events.push({ at: now, fallback: sample.fallback, empty: sample.empty });
  prune(now);

  const total = events.length;
  if (total < ragConfig.alerts.minSamples) return;
  const fallbackRate = events.filter((event) => event.fallback).length / total;
  const emptyRate = events.filter((event) => event.empty).length / total;

  void maybeAlert("fallback_rate", fallbackRate, ragConfig.alerts.fallbackRateThreshold, total);
  void maybeAlert("empty_result_rate", emptyRate, ragConfig.alerts.emptyResultRateThreshold, total);
}

export function resetRagAlertSamples(): void {
  events.length = 0;
  lastAlertAt.clear();
}
