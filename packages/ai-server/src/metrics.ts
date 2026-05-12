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

export function recordRequest(domain: Domain, intent: Intent): void {
  wendyRequestsTotal.inc({ domain, intent });
}

export function recordSupervisorRewrite(domain: Domain): void {
  wendySupervisorRewritesTotal.inc({ domain });
}

export function recordLlmTokens(model: string, chars: number): void {
  const estimatedTokens = Math.ceil(chars / 4);
  wendyLlmTokensTotal.inc({ model }, estimatedTokens);
}

export function getMetricsContentType(): string {
  return register.contentType;
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
