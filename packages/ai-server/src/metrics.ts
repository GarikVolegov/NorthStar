import promClient from "prom-client";
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

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
