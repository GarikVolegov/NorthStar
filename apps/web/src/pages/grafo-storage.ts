import type { GraphData, GraphEdge, GraphNode } from "./grafo-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStoredGraph(raw: string): Pick<GraphData, "nodes" | "edges"> {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) return { nodes: [], edges: [] };
  return {
    nodes: Array.isArray(parsed.nodes) ? (parsed.nodes as GraphNode[]) : [],
    edges: Array.isArray(parsed.edges) ? (parsed.edges as GraphEdge[]) : [],
  };
}

export function readChatChunkText(payload: string): string | null {
  const parsed = JSON.parse(payload) as unknown;
  if (!isRecord(parsed) || typeof parsed.text !== "string") return null;
  return parsed.text;
}
