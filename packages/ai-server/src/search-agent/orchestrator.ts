import { or, sql } from "drizzle-orm";
import { db, sectorsTable, professionsTable, growthArticlesTable, newsArticlesTable } from "@workspace/db";
import { runGrowthAgent, type GrowthAgentOptions } from "../growth-agent/agent";
import { routeQuery }                              from "../search-router/router";
import { loadMemory, buildMemorySection }          from "../growth-agent/memory-manager";
import { logger }                                  from "../logger";
import type { UserContext }                        from "../growth-agent/prompt-builder";
import type { ChatMessage }                        from "../growth-agent/agent";
import type { RouterOutput }                       from "../search-router/router";

// ── Public types ────────────────────────────────────────────────────────────

export interface SearchResult {
  type:
    | "sector"
    | "role"
    | "article"
    | "news"
    | "idea"
    | "objective"
    | "calendar"
    | "certification"
    | "memory"
    | "workspace"
    | "profile";
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
}

export type SearchOrchestratorEvent =
  | { type: "route";   route: RouterOutput }
  | { type: "results"; results: SearchResult[] }
  | { type: "status";  value: string }
  | { type: "token";   value: string }
  | { type: "sources"; chunks: Array<{ content: string; source: string; score: number }> }
  | { type: "done";    finalText: string; agentsUsed: string[] }
  | { type: "error";   message: string };

export interface SearchOrchestratorOptions {
  query:       string;
  userId:      number;
  sessionId?:  number;
  userContext: UserContext & { memorySection?: string };
  history?:    ChatMessage[];
  requestId?:  string;
  prefetchedResults?: SearchResult[];
}

// ── Internal hybrid DB search ────────────────────────────────────────────────

async function hybridDbSearch(query: string): Promise<SearchResult[]> {
  const pattern = `%${query}%`;

  const [sectors, roles, articles, newsItems] = await Promise.all([
    db
      .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description, icon: sectorsTable.icon, color: sectorsTable.color })
      .from(sectorsTable)
      .where(or(sql`${sectorsTable.name} ILIKE ${pattern}`, sql`${sectorsTable.description} ILIKE ${pattern}`))
      .limit(4),
    db
      .select({ id: professionsTable.id, title: professionsTable.title, description: professionsTable.description })
      .from(professionsTable)
      .where(or(sql`${professionsTable.title} ILIKE ${pattern}`, sql`${professionsTable.description} ILIKE ${pattern}`))
      .limit(4),
    db
      .select({ id: growthArticlesTable.id, title: growthArticlesTable.title, description: growthArticlesTable.description, slug: growthArticlesTable.slug })
      .from(growthArticlesTable)
      .where(or(sql`${growthArticlesTable.title} ILIKE ${pattern}`, sql`${growthArticlesTable.description} ILIKE ${pattern}`))
      .limit(3),
    db
      .select({ id: newsArticlesTable.id, title: newsArticlesTable.title, summary: newsArticlesTable.summary })
      .from(newsArticlesTable)
      .where(or(sql`${newsArticlesTable.title} ILIKE ${pattern}`, sql`${newsArticlesTable.summary} ILIKE ${pattern}`))
      .limit(3),
  ]);

  return [
    ...sectors.map((s) => ({ type: "sector" as const, id: s.id, title: s.name,  description: s.description ?? "", url: `/settore/${s.id}`,                 icon: s.icon  ?? "layers",    color: s.color  ?? "#6366f1" })),
    ...roles.map((r)   => ({ type: "role"   as const, id: r.id, title: r.title, description: r.description   ?? "", url: `/ruolo/${r.id}`,                  icon: "briefcase",            color: "#10b981" })),
    ...articles.map((a)=> ({ type: "article" as const,id: a.id, title: a.title, description: a.description   ?? "", url: `/crescita/articolo/${a.slug}`,    icon: "book-open-text",       color: "#f59e0b" })),
    ...newsItems.map((n)=>({ type: "news"   as const, id: n.id, title: n.title, description: n.summary        ?? "", url: `/news`,                          icon: "newspaper",            color: "#8b5cf6" })),
  ];
}

// Intenti che richiedono risposta conversazionale dall'AI
const AI_INTENTS = new Set(["explore", "learn", "solve", "compare", "find_job"]);

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function* runSearchOrchestrator(
  opts: SearchOrchestratorOptions,
): AsyncGenerator<SearchOrchestratorEvent> {
  const { query, userId, sessionId, userContext, history = [], requestId, prefetchedResults } = opts;
  const agentsUsed: string[] = [];

  yield { type: "status", value: "🔍 Analizzo la tua ricerca..." };

  // ── Fase 1: DB search + route classification in parallelo ─────────────────
  let route: RouterOutput;
  let results: SearchResult[];

  try {
    [route, results] = await Promise.all([
      routeQuery({ q: query, history }),
      prefetchedResults ? Promise.resolve(prefetchedResults) : hybridDbSearch(query),
    ]);
    agentsUsed.push("hybrid-search", "search-router");
  } catch (err) {
    logger.warn({ err, query }, "[orchestrator] phase-1 failed");
    yield { type: "error", message: "Errore nella ricerca. Riprova." };
    return;
  }

  yield { type: "route",   route };
  yield { type: "results", results };

  // ── Fase 2: AI conversazionale (growth agent) ─────────────────────────────
  if (!AI_INTENTS.has(route.intent)) {
    // Intento "clarify" o bassa confidence → solo risultati DB
    yield { type: "done", finalText: "", agentsUsed };
    return;
  }

  yield { type: "status", value: "🤖 Coinvolgo l'AI..." };

  // Carica memoria utente se non già presente nel contesto
  let enrichedContext = userContext;
  if (!userContext.memorySection) {
    try {
      const userMemory = await loadMemory(userId);
      enrichedContext = { ...userContext, memorySection: buildMemorySection(userMemory) };
    } catch {
      // Continua senza memoria
    }
  }

  const growthOpts: GrowthAgentOptions = {
    userId,
    sessionId,
    userContext:  enrichedContext,
    history,
    userMessage:  query,
    maxHistory:   8,
    requestId,
  };

  let finalText = "";

  try {
    for await (const event of runGrowthAgent(growthOpts)) {
      if (event.type === "token") {
        finalText += event.value;
        yield { type: "token", value: event.value };
      } else if (event.type === "status") {
        yield { type: "status", value: event.value };
      } else if (event.type === "done") {
        agentsUsed.push("growth-agent");
        const sources = (event.sources ?? []).map((c) => ({
          content: c.content.slice(0, 200),
          source:  c.source,
          score:   c.score,
        }));
        if (sources.length > 0) yield { type: "sources", chunks: sources };
        break;
      } else if (event.type === "error") {
        yield { type: "error", message: event.message };
        return;
      }
    }
  } catch (err) {
    logger.warn({ err, userId, query }, "[orchestrator] growth agent error");
    yield { type: "error", message: "Errore durante l'elaborazione AI." };
    return;
  }

  logger.info({ userId, query, intent: route.intent, agentsUsed }, "[orchestrator] done");
  yield { type: "done", finalText, agentsUsed };
}
