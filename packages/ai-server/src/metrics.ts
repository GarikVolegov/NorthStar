import promClient from "prom-client";
import { ragConfig } from "./config/rag";
import type { Domain, Intent } from "./growth-agent/router-agent";

const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

export const wendyRequestsTotal = new promClient.Counter({
  name: "wendy_requests_total",
  help: "Total requests handled by Wendy, by domain and intent",
  labelNames: ["domain", "intent"] as const,
  registers: [register],
});

export const wendyErrorsTotal = new promClient.Counter({
  name: "wendy_errors_total",
  help: "Total errors by phase and domain",
  labelNames: ["phase", "domain"] as const,
  registers: [register],
});

export const wendyMemoryOpsDuration = new promClient.Histogram({
  name: "wendy_memory_ops_duration_seconds",
  help: "Duration of memory extract/merge operations",
  labelNames: ["operation"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const wendyLatencySeconds = new promClient.Histogram({
  name: "wendy_latency_seconds",
  help: "Latency of each processing phase in seconds",
  labelNames: ["phase"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const wendySupervisorRewritesTotal = new promClient.Counter({
  name: "wendy_supervisor_rewrites_total",
  help: "Number of supervisor rewrites by domain",
  labelNames: ["domain"] as const,
  registers: [register],
});

export const wendyLlmTokensTotal = new promClient.Counter({
  name: "wendy_llm_tokens_total",
  help: "Estimated LLM output tokens by model",
  labelNames: ["model"] as const,
  registers: [register],
});

export const wendyRouterConfidenceHistogram = new promClient.Histogram({
  name: "wendy_router_confidence_histogram",
  help: "Distribution of router confidence scores by domain and intent",
  labelNames: ["domain", "intent"] as const,
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  registers: [register],
});

// ── Tool call metrics ──────────────────────────────────────────────────────────

export const wendyToolCallsTotal = new promClient.Counter({
  name: "wendy_tool_calls_total",
  help: "Number of Wendy tool calls, by tool name and result (ok/error)",
  labelNames: ["tool", "result"] as const,
  registers: [register],
});

export const wendyToolCallDuration = new promClient.Histogram({
  name: "wendy_tool_call_duration_seconds",
  help: "Latency of individual Wendy tool calls",
  labelNames: ["tool"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

export const ragRetrieveDuration = new promClient.Histogram({
  name: "rag_retrieve_duration_seconds",
  help: "RAG retrieve latency by backend and result",
  labelNames: ["backend", "result"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const ragRetrieveTotal = new promClient.Counter({
  name: "rag_retrieve_total",
  help: "Total RAG retrieve calls by backend and result",
  labelNames: ["backend", "result"] as const,
  registers: [register],
});

export const ragFallbackTotal = new promClient.Counter({
  name: "rag_fallback_total",
  help: "Total RAG pgvector-to-JS fallback events by reason",
  labelNames: ["reason"] as const,
  registers: [register],
});

export const ragJsLimitHitTotal = new promClient.Counter({
  name: "rag_js_limit_hit_total",
  help: "Total times JS fallback hit its configured pagination cap",
  labelNames: ["source"] as const,
  registers: [register],
});

export const ragScoreHistogram = new promClient.Histogram({
  name: "rag_score_distribution",
  help: "Distribution of returned RAG similarity scores by backend",
  labelNames: ["backend"] as const,
  buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
  registers: [register],
});

export function recordRequest(domain: Domain, intent: Intent): void {
  wendyRequestsTotal.inc({ domain, intent });
}

export function recordError(phase: string, domain: string): void {
  wendyErrorsTotal.inc({ phase, domain });
}

export function recordMemoryOpDuration(operation: string, seconds: number): void {
  wendyMemoryOpsDuration.observe({ operation }, seconds);
}

export function recordSupervisorRewrite(domain: Domain): void {
  wendySupervisorRewritesTotal.inc({ domain });
}

export function recordRouterConfidence(domain: Domain, intent: Intent, confidence: number): void {
  wendyRouterConfidenceHistogram.observe({ domain, intent }, confidence);
}

export function recordLlmTokens(model: string, chars: number): void {
  const estimatedTokens = Math.ceil(chars / 4);
  wendyLlmTokensTotal.inc({ model }, estimatedTokens);
}

export function recordToolCall(tool: string, result: "ok" | "error", durationSec: number): void {
  wendyToolCallsTotal.inc({ tool, result });
  wendyToolCallDuration.observe({ tool }, durationSec);
}

export function recordRagRetrieve(
  backend: "pgvector" | "js" | "none",
  result: "ok" | "empty" | "error",
  durationSec: number,
  scores: number[] = [],
): void {
  ragRetrieveTotal.inc({ backend, result });
  ragRetrieveDuration.observe({ backend, result }, durationSec);
  for (const score of scores) {
    ragScoreHistogram.observe({ backend }, score);
  }
}

export function recordRagFallback(reason: string): void {
  ragFallbackTotal.inc({ reason });
}

export function recordRagJsLimitHit(source = "knowledge_nodes"): void {
  ragJsLimitHitTotal.inc({ source });
}

type MetricValue = {
  value?: number;
  labels?: Record<string, string>;
  metricName?: string;
};

type MetricSnapshot = {
  values?: MetricValue[];
};

async function getMetricValues(metricName: string): Promise<MetricValue[]> {
  const metric = register.getSingleMetric(metricName);
  if (!metric) return [];
  const snapshot = await (metric.get() as Promise<MetricSnapshot> | MetricSnapshot);
  return snapshot.values ?? [];
}

function sumMetricValues(values: MetricValue[], predicate?: (value: MetricValue) => boolean): number {
  return values.reduce((total, value) => {
    if (predicate && !predicate(value)) return total;
    return total + (value.value ?? 0);
  }, 0);
}

export interface RagMetricsSummary {
  totalRetrieves: number;
  fallbackRate: number;
  emptyResultRate: number;
  jsLimitHits: number;
  avgLatencyMsByBackend: Record<"pgvector" | "js" | "none", number>;
  scoreSamplesByBackend: Record<"pgvector" | "js", number>;
  alertThresholds: {
    fallbackRate: number;
    emptyResultRate: number;
    windowMinutes: number;
  };
}

export async function getRagMetricsSummary(): Promise<RagMetricsSummary> {
  const [
    retrieveValues,
    fallbackValues,
    jsLimitValues,
    latencyValues,
    scoreValues,
  ] = await Promise.all([
    getMetricValues("rag_retrieve_total"),
    getMetricValues("rag_fallback_total"),
    getMetricValues("rag_js_limit_hit_total"),
    getMetricValues("rag_retrieve_duration_seconds"),
    getMetricValues("rag_score_distribution"),
  ]);

  const totalRetrieves = sumMetricValues(retrieveValues);
  const fallbackCount = sumMetricValues(fallbackValues);
  const emptyCount = sumMetricValues(
    retrieveValues,
    (value) => value.labels?.["result"] === "empty",
  );
  const jsLimitHits = sumMetricValues(jsLimitValues);

  const avgLatencyMsByBackend: RagMetricsSummary["avgLatencyMsByBackend"] = {
    pgvector: 0,
    js: 0,
    none: 0,
  };

  for (const backend of Object.keys(avgLatencyMsByBackend) as Array<keyof typeof avgLatencyMsByBackend>) {
    const sum = sumMetricValues(
      latencyValues,
      (value) => value.labels?.["backend"] === backend && value.metricName?.endsWith("_sum") === true,
    );
    const count = sumMetricValues(
      latencyValues,
      (value) => value.labels?.["backend"] === backend && value.metricName?.endsWith("_count") === true,
    );
    avgLatencyMsByBackend[backend] = count > 0 ? (sum / count) * 1000 : 0;
  }

  const scoreSamplesByBackend: RagMetricsSummary["scoreSamplesByBackend"] = {
    pgvector: sumMetricValues(
      scoreValues,
      (value) => value.labels?.["backend"] === "pgvector" && value.metricName?.endsWith("_count") === true,
    ),
    js: sumMetricValues(
      scoreValues,
      (value) => value.labels?.["backend"] === "js" && value.metricName?.endsWith("_count") === true,
    ),
  };

  return {
    totalRetrieves,
    fallbackRate: totalRetrieves > 0 ? fallbackCount / totalRetrieves : 0,
    emptyResultRate: totalRetrieves > 0 ? emptyCount / totalRetrieves : 0,
    jsLimitHits,
    avgLatencyMsByBackend,
    scoreSamplesByBackend,
    alertThresholds: {
      fallbackRate: ragConfig.alerts.fallbackRateThreshold,
      emptyResultRate: ragConfig.alerts.emptyResultRateThreshold,
      windowMinutes: Math.round(ragConfig.alerts.windowMs / 60_000),
    },
  };
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
