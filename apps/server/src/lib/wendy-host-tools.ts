/**
 * wendy-host-tools.ts — handler server-side per i tool Wendy che
 * dipendono da risorse di apps/server (OpenHuman, Graphify).
 *
 * Vengono intercettati in ai-wendy.ts prima di delegare a executeToolCall
 * di @workspace/ai-server, così il package AI resta agnostico dalle integrazioni.
 */
import { explainGraphifyNode, isGraphifyEnabled, searchGraphify } from "./graphify-client";
import { isOpenHumanEnabled, searchOpenHumanMemory } from "./openhuman-client";
import { recallSemanticMemory } from "./semantic-memory";

export type HostToolResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string; message: string };

export const HOST_TOOL_NAMES = new Set<string>([
  "ask_openhuman_memory",
  "recall_semantic_memory",
  "explain_app_with_graphify",
  "search_code_graph",
  "explain_code_node",
]);

export function isHostTool(name: string): boolean {
  return HOST_TOOL_NAMES.has(name);
}

function pickString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function pickNumber(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
  return fallback;
}

export async function executeHostTool(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<HostToolResult> {
  switch (name) {
    case "ask_openhuman_memory": {
      const query = pickString(args, "query");
      if (!query) return { ok: false, code: "INVALID_INPUT", message: "Manca la query." };
      if (!isOpenHumanEnabled()) {
        return {
          ok: true,
          data: {
            available: false,
            reason: "OpenHuman non è abilitato in questa installazione.",
            results: [],
          },
        };
      }
      const limit = pickNumber(args, "limit", 5);
      try {
        const results = await searchOpenHumanMemory(query, userId, limit);
        return {
          ok: true,
          data: {
            available: true,
            source: "openhuman",
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              title: r.title,
              content: r.content,
              score: r.score,
              updatedAt: r.updatedAt,
              url: r.url,
            })),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, code: "OPENHUMAN_ERROR", message };
      }
    }

    case "recall_semantic_memory": {
      const query = pickString(args, "query");
      if (!query) return { ok: false, code: "INVALID_INPUT", message: "Manca la query." };
      const limit = pickNumber(args, "limit", 5);
      try {
        const recall = await recallSemanticMemory(query, userId, limit);
        return {
          ok: true,
          data: {
            available: recall.available,
            source: "semantic-memory",
            reason: recall.reason,
            count: recall.memories.length,
            results: recall.memories,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, code: "SEMANTIC_MEMORY_ERROR", message };
      }
    }

    case "explain_app_with_graphify": {
      const query = pickString(args, "query");
      if (!query) return { ok: false, code: "INVALID_INPUT", message: "Manca la query." };
      if (!isGraphifyEnabled()) {
        return {
          ok: true,
          data: {
            available: false,
            reason: "Graphify non è abilitato in questa installazione.",
            results: [],
          },
        };
      }
      const limit = pickNumber(args, "limit", 5);
      try {
        const results = await searchGraphify(query, limit);
        return {
          ok: true,
          data: {
            available: true,
            source: "graphify",
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              graph: r.graph,
              label: r.label,
              kind: r.kind,
              sourceFile: r.sourceFile,
              sourceLocation: r.sourceLocation,
              score: r.score,
              neighbors: r.neighbors.slice(0, 6),
            })),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, code: "GRAPHIFY_ERROR", message };
      }
    }

    case "search_code_graph": {
      const query = pickString(args, "query");
      if (!query) return { ok: false, code: "INVALID_INPUT", message: "Manca la query." };
      if (!isGraphifyEnabled()) {
        return {
          ok: true,
          data: {
            available: false,
            reason: "Graphify non è abilitato in questa installazione.",
            results: [],
          },
        };
      }
      const limit = pickNumber(args, "limit", 5);
      try {
        const results = await searchGraphify(query, limit);
        return {
          ok: true,
          data: {
            available: true,
            source: "graphify",
            count: results.length,
            results: results.map((r) => ({
              id: r.id,
              graph: r.graph,
              label: r.label,
              kind: r.kind,
              sourceFile: r.sourceFile,
              sourceLocation: r.sourceLocation,
              score: r.score,
              neighbors: r.neighbors.slice(0, 6),
            })),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, code: "GRAPHIFY_ERROR", message };
      }
    }

    case "explain_code_node": {
      const graph = pickString(args, "graph");
      const id = pickString(args, "id");
      if (!graph || !id) return { ok: false, code: "INVALID_INPUT", message: "Mancano graph o id." };
      if (!isGraphifyEnabled()) {
        return {
          ok: true,
          data: {
            available: false,
            reason: "Graphify non è abilitato in questa installazione.",
            result: null,
          },
        };
      }
      try {
        const result = await explainGraphifyNode(graph, id);
        return {
          ok: true,
          data: {
            available: Boolean(result),
            source: "graphify",
            result,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, code: "GRAPHIFY_ERROR", message };
      }
    }

    default:
      return { ok: false, code: "UNKNOWN_HOST_TOOL", message: `Tool host "${name}" non riconosciuto.` };
  }
}
