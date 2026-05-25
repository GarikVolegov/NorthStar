/**
 * agent-registry.ts — fonte di verita` server-side sullo stato degli agenti AI.
 *
 * Anagrafica: `agent_employees` (DB). Stato live derivato da `agent_tasks` +
 * `ai_request_log` (per Wendy). Polling throttled + EventEmitter per SSE.
 *
 * Pattern: Singleton class + Node EventEmitter (no nuove dipendenze).
 *
 * @pattern Singleton + Polling Aggregator + EventEmitter
 */
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  agentEmployeesTable,
  agentTasksTable,
  aiRequestLogTable,
  db,
} from "@workspace/db";
import type {
  AgentEvent,
  AgentEventType,
  AgentSnapshot,
  AgentStatus,
  AgentTaskRef,
  RegistryAggregates,
  RegistrySnapshot,
} from "@workspace/api-zod/agent-registry";
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ component: "agent-registry" });

const WENDY_SLUG = "wendy";
const DEFAULT_POLL_MS = 1500;
const ERROR_WINDOW_MS = 60_000;
const WENDY_ACTIVE_WINDOW_MS = 30_000;
const DEFAULT_OVERRIDE_TTL_MS = 60_000;
const MAX_EVENTS_PER_AGENT = 50;
const RECENT_EVENTS_PER_SNAPSHOT = 10;

interface AgentOverride {
  status?: AgentStatus;
  currentTask?: AgentTaskRef | null;
  expiresAt: number;
}

interface AgentUpdateInput {
  status?: AgentStatus;
  currentTask?: AgentTaskRef | null;
  ttlMs?: number;
}

class AgentRegistry extends EventEmitter {
  private static instance: AgentRegistry | null = null;

  private timer: NodeJS.Timeout | null = null;
  private lastHash = "";
  private lastSnapshot: RegistrySnapshot | null = null;
  private overrides = new Map<string, AgentOverride>();
  private events = new Map<string, AgentEvent[]>();
  private lastDerivedStatus = new Map<string, AgentStatus>();
  private lastTerminalTaskId = new Map<string, number>();

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
      AgentRegistry.instance.setMaxListeners(50);
    }
    return AgentRegistry.instance;
  }

  start(intervalMs: number = DEFAULT_POLL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.refresh().catch((err) => {
        log.warn({ err }, "registry refresh failed");
      });
    }, intervalMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
    log.info({ intervalMs }, "agent registry polling started");
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.removeAllListeners();
    log.info("agent registry stopped");
  }

  async refresh(): Promise<RegistrySnapshot> {
    const snapshot = await this.computeSnapshot();
    const hash = hashSnapshot(snapshot);
    if (hash !== this.lastHash) {
      this.lastHash = hash;
      this.lastSnapshot = snapshot;
      this.emit("change", snapshot);
    }
    return snapshot;
  }

  async getSnapshot(): Promise<RegistrySnapshot> {
    if (this.lastSnapshot) return this.lastSnapshot;
    return this.refresh();
  }

  update(slug: string, partial: AgentUpdateInput): void {
    const ttl = partial.ttlMs ?? DEFAULT_OVERRIDE_TTL_MS;
    const prev = this.overrides.get(slug);
    const next: AgentOverride = { expiresAt: Date.now() + ttl };
    if (partial.status !== undefined) next.status = partial.status;
    if (partial.currentTask !== undefined) next.currentTask = partial.currentTask;
    this.overrides.set(slug, next);
    if (partial.status && partial.status !== prev?.status) {
      this.pushEvent(slug, "status_change", `Stato push -> ${partial.status}`);
    }
    void this.refresh().catch((err) => {
      log.warn({ err, slug }, "registry refresh after update failed");
    });
  }

  clear(slug: string): void {
    const had = this.overrides.delete(slug);
    if (!had) return;
    this.pushEvent(slug, "status_change", "Override rimosso, torna a derivazione DB");
    void this.refresh().catch((err) => {
      log.warn({ err, slug }, "registry refresh after clear failed");
    });
  }

  pushEvent(slug: string, type: AgentEventType, description: string): void {
    const ring = this.events.get(slug) ?? [];
    ring.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      type,
      description,
    });
    if (ring.length > MAX_EVENTS_PER_AGENT) {
      ring.splice(0, ring.length - MAX_EVENTS_PER_AGENT);
    }
    this.events.set(slug, ring);
  }

  getEvents(slug: string, limit: number = RECENT_EVENTS_PER_SNAPSHOT): AgentEvent[] {
    const ring = this.events.get(slug) ?? [];
    return ring.slice(-limit);
  }

  private async computeSnapshot(): Promise<RegistrySnapshot> {
    const employees = await db
      .select()
      .from(agentEmployeesTable)
      .orderBy(agentEmployeesTable.sortOrder, agentEmployeesTable.id);

    if (employees.length === 0) {
      return {
        generatedAt: new Date().toISOString(),
        agents: [],
        aggregates: { online: 0, executing: 0, tokensTotalToday: 0 },
      };
    }

    const slugs = employees.map((e) => e.slug);
    const taskRows = await db
      .select()
      .from(agentTasksTable)
      .where(inArray(agentTasksTable.agentSlug, slugs))
      .orderBy(desc(agentTasksTable.updatedAt))
      .limit(slugs.length * 4);

    const tasksBySlug = new Map<string, typeof taskRows>();
    for (const row of taskRows) {
      const list = tasksBySlug.get(row.agentSlug) ?? [];
      list.push(row);
      tasksBySlug.set(row.agentSlug, list);
    }

    const wendyLastRequest = employees.some((e) => e.slug === WENDY_SLUG)
      ? await fetchLastWendyRequestAt()
      : null;

    const now = Date.now();
    // Pulizia opportunistica degli override scaduti.
    for (const [slug, ovr] of this.overrides) {
      if (ovr.expiresAt <= now) this.overrides.delete(slug);
    }

    const agents: AgentSnapshot[] = employees.map((emp) => {
      const tasks = tasksBySlug.get(emp.slug) ?? [];
      const running = tasks.find((t) => t.status === "running") ?? null;
      const queued = tasks.find((t) => t.status === "queued") ?? null;
      const lastFinished =
        tasks.find(
          (t) =>
            t.status === "completed" ||
            t.status === "failed" ||
            t.status === "cancelled",
        ) ?? null;

      let status: AgentStatus;
      if (!emp.isActive) {
        status = "offline";
      } else if (emp.slug === WENDY_SLUG) {
        status = deriveWendyStatus(wendyLastRequest, now);
      } else if (running) {
        status = "executing";
      } else if (queued) {
        status = "thinking";
      } else if (
        lastFinished &&
        lastFinished.status === "failed" &&
        lastFinished.completedAt &&
        now - lastFinished.completedAt.getTime() < ERROR_WINDOW_MS
      ) {
        status = "error";
      } else {
        status = "idle";
      }

      let currentTask = toTaskRef(running);

      // Override push-based: ha precedenza solo se l'agente e` active e
      // l'override non e` scaduto. Override non sovrascrive `offline`.
      const ovr = this.overrides.get(emp.slug);
      if (ovr && ovr.expiresAt > now && emp.isActive) {
        if (ovr.status !== undefined) status = ovr.status;
        if (ovr.currentTask !== undefined) currentTask = ovr.currentTask;
      }

      // Rilevamento transizioni terminali su agent_tasks (per il log eventi).
      if (lastFinished && this.lastTerminalTaskId.get(emp.slug) !== lastFinished.id) {
        const seenBefore = this.lastTerminalTaskId.has(emp.slug);
        this.lastTerminalTaskId.set(emp.slug, lastFinished.id);
        if (seenBefore) {
          const eventType: AgentEventType =
            lastFinished.status === "completed" ? "task_completed" : "task_failed";
          this.pushEvent(emp.slug, eventType, `Task #${lastFinished.id}: ${lastFinished.title}`);
        }
      }

      // Rilevamento transizioni di status derivato (post-override).
      const prevStatus = this.lastDerivedStatus.get(emp.slug);
      if (prevStatus && prevStatus !== status) {
        this.pushEvent(emp.slug, "status_change", `${prevStatus} -> ${status}`);
      }
      this.lastDerivedStatus.set(emp.slug, status);

      return {
        id: emp.id,
        slug: emp.slug,
        name: emp.name,
        role: emp.role,
        domain: emp.domain,
        avatar: emp.avatar,
        color: emp.color,
        description: emp.description,
        capabilities: (emp.capabilities ?? []) as string[],
        status,
        isActive: emp.isActive,
        currentTask,
        lastTask: toTaskRef(lastFinished),
        systemPrompt: emp.systemPrompt,
        sortOrder: emp.sortOrder,
        updatedAt: new Date().toISOString(),
        recentEvents: this.getEvents(emp.slug),
      };
    });

    const aggregates: RegistryAggregates = {
      online: agents.filter((a) => a.isActive).length,
      executing: agents.filter((a) => a.status === "executing").length,
      tokensTotalToday: await fetchTokensTotalToday(),
    };

    return {
      generatedAt: new Date().toISOString(),
      agents,
      aggregates,
    };
  }
}

function deriveWendyStatus(
  lastRequestAt: Date | null,
  now: number,
): AgentStatus {
  if (!lastRequestAt) return "idle";
  return now - lastRequestAt.getTime() < WENDY_ACTIVE_WINDOW_MS
    ? "executing"
    : "idle";
}

async function fetchTokensTotalToday(): Promise<number> {
  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [aiRow] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${aiRequestLogTable.inputTokens} + ${aiRequestLogTable.outputTokens}), 0)::int`,
      })
      .from(aiRequestLogTable)
      .where(gte(aiRequestLogTable.createdAt, startOfDay));

    const [taskRow] = await db
      .select({
        total: sql<number>`COALESCE(SUM(((${agentTasksTable.outputMeta}->>'tokensUsed')::int)), 0)::int`,
      })
      .from(agentTasksTable)
      .where(gte(agentTasksTable.completedAt, startOfDay));

    return (aiRow?.total ?? 0) + (taskRow?.total ?? 0);
  } catch (err) {
    log.warn({ err }, "fetchTokensTotalToday failed");
    return 0;
  }
}

async function fetchLastWendyRequestAt(): Promise<Date | null> {
  try {
    const rows = await db
      .select({ createdAt: aiRequestLogTable.createdAt })
      .from(aiRequestLogTable)
      .where(
        and(
          gte(
            aiRequestLogTable.createdAt,
            new Date(Date.now() - WENDY_ACTIVE_WINDOW_MS * 2),
          ),
          eq(aiRequestLogTable.status, "success"),
        ),
      )
      .orderBy(desc(aiRequestLogTable.createdAt))
      .limit(1);
    return rows[0]?.createdAt ?? null;
  } catch (err) {
    log.warn({ err }, "deriveWendyStatus query failed");
    return null;
  }
}

function toTaskRef(
  row:
    | {
        id: number;
        title: string;
        status: "queued" | "running" | "completed" | "failed" | "cancelled";
        startedAt: Date | null;
        completedAt: Date | null;
        outputMeta: { tokensUsed?: number; modelUsed?: string } | null;
      }
    | null
    | undefined,
): AgentTaskRef | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.completedAt ? row.completedAt.toISOString() : null,
    tokensUsed: row.outputMeta?.tokensUsed ?? null,
    modelUsed: row.outputMeta?.modelUsed ?? null,
  };
}

function hashSnapshot(snapshot: RegistrySnapshot): string {
  // Hash leggero: status + currentTask + lastTask.id + isActive + ultimo evento.
  // generatedAt e` escluso per evitare emit ad ogni tick.
  // currentTask include title+startedAt per catturare push override su Wendy
  // (id=0 in tutti gli override).
  const parts = snapshot.agents.map((a) => {
    const lastEvent = a.recentEvents[a.recentEvents.length - 1];
    return [
      a.slug,
      a.status,
      a.isActive ? 1 : 0,
      a.currentTask
        ? `${a.currentTask.id}#${a.currentTask.title}#${a.currentTask.startedAt ?? "-"}`
        : "-",
      a.lastTask?.id ?? "-",
      a.systemPrompt.length,
      lastEvent ? `${a.recentEvents.length}@${lastEvent.id}` : "0",
    ].join(":");
  });
  return parts.join("|");
}

export const agentRegistry = AgentRegistry.getInstance();
