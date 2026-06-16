import { rootLogger } from "../middleware/logger";
import { getStats } from "./monitor";
import { db, llmUsageTable } from "@workspace/db";
import { gte, sql } from "drizzle-orm";

const ERROR_RATE_THRESHOLD = parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD ?? "0.05");
const P95_THRESHOLD_MS = parseInt(process.env.ALERT_P95_THRESHOLD_MS ?? "2000", 10);
const LLM_COST_SPIKE_THRESHOLD = parseFloat(process.env.ALERT_LLM_COST_SPIKE ?? "2.0");
const CHECK_INTERVAL_MS = parseInt(process.env.ALERT_CHECK_INTERVAL_MS ?? "60000", 10);
const SLACK_WEBHOOK_URL = process.env.ALERT_SLACK_WEBHOOK_URL ?? "";

interface Alert {
  level: "warn" | "error";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

let alertHistory: Alert[] = [];
const MAX_ALERT_HISTORY = 100;

async function sendSlack(alert: Alert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const color = alert.level === "error" ? "danger" : "warning";
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [{
          color,
          title: alert.title,
          text: alert.message,
          fields: alert.metadata
            ? Object.entries(alert.metadata).map(([k, v]) => ({ title: k, value: String(v), short: true }))
            : undefined,
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
  } catch {
    // silent
  }
}

function emit(alert: Alert): void {
  alertHistory.unshift(alert);
  if (alertHistory.length > MAX_ALERT_HISTORY) alertHistory.pop();

  const logFn = alert.level === "error" ? rootLogger.error : rootLogger.warn;
  logFn({ alert: alert.title, ...alert.metadata }, alert.message);

  if (SLACK_WEBHOOK_URL) {
    sendSlack(alert).catch(() => {});
  }
}

async function checkErrorRate(): Promise<void> {
  const stats = getStats();
  if (!stats || stats.total < 10) return;

  if (stats.errorRate > ERROR_RATE_THRESHOLD) {
    emit({
      level: stats.errorRate > 0.1 ? "error" : "warn",
      title: "Error Rate Alert",
      message: `Error rate ${(stats.errorRate * 100).toFixed(1)}% exceeds threshold of ${(ERROR_RATE_THRESHOLD * 100).toFixed(1)}%`,
      metadata: { errorRate: stats.errorRate, errors: stats.errors, total: stats.total },
    });
  }
}

async function checkP95(): Promise<void> {
  const stats = getStats();
  if (!stats || stats.total < 10) return;

  if (stats.p95 > P95_THRESHOLD_MS) {
    emit({
      level: stats.p95 > 5000 ? "error" : "warn",
      title: "P95 Latency Alert",
      message: `P95 latency ${stats.p95}ms exceeds threshold of ${P95_THRESHOLD_MS}ms`,
      metadata: { p95: stats.p95, threshold: P95_THRESHOLD_MS },
    });
  }
}

async function checkLlmCostSpike(): Promise<void> {
  try {
    const now = new Date();
    const currentHourStart = new Date(now);
    currentHourStart.setMinutes(0, 0, 0);
    const previousHourStart = new Date(currentHourStart);
    previousHourStart.setHours(previousHourStart.getHours() - 1);

    const [current] = await db
      .select({ cost: sql<number>`COALESCE(SUM(estimated_cost_usd), 0)` })
      .from(llmUsageTable)
      .where(gte(llmUsageTable.createdAt, currentHourStart));

    const [previous] = await db
      .select({ cost: sql<number>`COALESCE(SUM(estimated_cost_usd), 0)` })
      .from(llmUsageTable)
      .where(gte(llmUsageTable.createdAt, previousHourStart));

    const currentCost = Number(current?.cost ?? 0);
    const prevCost = Number(previous?.cost ?? 0);

    if (prevCost > 0 && currentCost > prevCost * LLM_COST_SPIKE_THRESHOLD) {
      emit({
        level: "warn",
        title: "LLM Cost Spike Alert",
        message: `LLM cost ${currentCost.toFixed(4)} is ${(currentCost / prevCost).toFixed(1)}x previous hour`,
        metadata: { currentHourCost: currentCost, previousHourCost: prevCost, ratio: currentCost / prevCost },
      });
    }
  } catch {
    // silent — cost check is best-effort
  }
}

export function startAlertChecker(): void {
  rootLogger.info({ intervalMs: CHECK_INTERVAL_MS }, "Alert checker started");
  const run = (): void => {
    checkErrorRate().catch(() => {});
    checkP95().catch(() => {});
    checkLlmCostSpike().catch(() => {});
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
}

export function getAlertHistory(): Alert[] {
  return [...alertHistory];
}
