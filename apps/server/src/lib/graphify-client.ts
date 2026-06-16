import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  matchWikiLLMAuthority,
  type WikiLLMAuthorityLevel,
} from "./wikillm-authority-manifest";

export type GraphifyState = "disabled" | "ready" | "degraded" | "empty";

export interface GraphifyGraphStatus {
  name: string;
  path: string;
  status: "ready" | "missing" | "error";
  nodes: number;
  links: number;
  updatedAt: string | null;
  message?: string;
}

export interface GraphifyStatus {
  enabled: boolean;
  state: GraphifyState;
  graphs: GraphifyGraphStatus[];
  checkedAt: string;
}

export interface GraphifyNeighbor {
  id: string;
  label: string;
  relation: string | null;
}

export interface GraphifyResult {
  id: string;
  graph: string;
  label: string;
  kind: string | null;
  source: "graphify";
  sourceFile: string | null;
  sourceLocation: string | null;
  community: string | null;
  score: number;
  authority?: WikiLLMAuthorityLevel;
  authorityReason?: string;
  authorityWeight?: number;
  neighbors: GraphifyNeighbor[];
}

export type GraphifyProfile = "code" | "process" | "docs" | "all" | (string & {});

export interface GraphifySearchOptions {
  limit?: number;
  profile?: GraphifyProfile;
}

interface GraphNode {
  id: string;
  label: string;
  kind: string | null;
  sourceFile: string | null;
  sourceLocation: string | null;
  community: string | null;
  searchable: string;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string | null;
}

interface GraphIndex {
  name: string;
  path: string;
  mtimeMs: number;
  nodes: Map<string, GraphNode>;
  links: GraphLink[];
}

const DEFAULT_GRAPHS =
  "code:graphify-out/code/graph.json,process:graphify-out/process/graph.json,docs:graphify-out/docs/graph.json";
const DEFAULT_QUERY_LIMIT = 8;
const DEFAULT_MAX_CONTEXT_CHARS = 4_000;
const graphCache = new Map<string, GraphIndex>();

export function isGraphifyEnabled(): boolean {
  return process.env.GRAPHIFY_ENABLED === "true";
}

export function getDefaultGraphifyGraphs(): string {
  return DEFAULT_GRAPHS;
}

function queryLimit(): number {
  const parsed = Number.parseInt(process.env.GRAPHIFY_QUERY_LIMIT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUERY_LIMIT;
}

function maxContextChars(): number {
  const parsed = Number.parseInt(process.env.GRAPHIFY_MAX_CONTEXT_CHARS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONTEXT_CHARS;
}

function workspaceRoot(): string {
  let cursor = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(cursor, "pnpm-workspace.yaml"))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

function configuredGraphs(): Array<{ name: string; path: string }> {
  const raw = process.env.GRAPHIFY_GRAPHS?.trim() || DEFAULT_GRAPHS;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator === -1) {
        const path = resolvePath(entry);
        return { name: entry.replace(/[^a-z0-9_-]+/gi, "-"), path };
      }
      const name = entry.slice(0, separator).trim();
      const graphPath = entry.slice(separator + 1).trim();
      return { name, path: resolvePath(graphPath) };
    });
}

function resolvePath(path: string): string {
  return isAbsolute(path) ? path : resolve(workspaceRoot(), path);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  const record = asRecord(value);
  return readString(record?.id);
}

function normalizeNode(value: unknown): GraphNode | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = readString(record.id);
  if (!id) return null;
  const label = readString(record.label) ?? readString(record.name) ?? id;
  const kind = readString(record.file_type) ?? readString(record.type);
  const sourceFile = readString(record.source_file) ?? readString(record.file);
  const group = readString(record.group);
  const description = readString(record.description);
  const sourceLocation =
    readString(record.source_location) ?? readString(record.location);
  const communityValue = record.community;
  const community =
    typeof communityValue === "number" || typeof communityValue === "string"
      ? String(communityValue)
      : null;
  const normLabel = readString(record.norm_label);
  return {
    id,
    label,
    kind,
    sourceFile,
    sourceLocation,
    community,
    searchable: [
      id,
      label,
      normLabel,
      kind,
      group,
      description,
      sourceFile,
      sourceLocation,
      community,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" ")
      .toLowerCase(),
  };
}

function normalizeLink(value: unknown): GraphLink | null {
  const record = asRecord(value);
  if (!record) return null;
  const source = readId(record.source) ?? readId(record.from);
  const target = readId(record.target) ?? readId(record.to);
  if (!source || !target) return null;
  return {
    source,
    target,
    relation:
      readString(record.relation) ??
      readString(record.type) ??
      readString(record.label),
  };
}

async function loadGraph(name: string, path: string): Promise<GraphIndex> {
  const stat = statSync(path);
  const cached = graphCache.get(name);
  if (cached && cached.path === path && cached.mtimeMs === stat.mtimeMs) {
    return cached;
  }

  const payload = JSON.parse(await readFile(path, "utf8")) as unknown;
  const record = asRecord(payload);
  const rawNodes = Array.isArray(record?.nodes) ? record.nodes : [];
  const rawLinks = Array.isArray(record?.links)
    ? record.links
    : Array.isArray(record?.edges)
      ? record.edges
      : [];
  const nodes = new Map<string, GraphNode>();
  for (const rawNode of rawNodes) {
    const node = normalizeNode(rawNode);
    if (node) nodes.set(node.id, node);
  }
  const links = rawLinks
    .map(normalizeLink)
    .filter((link): link is GraphLink => link !== null);
  const index = { name, path, mtimeMs: stat.mtimeMs, nodes, links };
  graphCache.set(name, index);
  return index;
}

async function loadAvailableGraphs(profile: GraphifyProfile = "all"): Promise<GraphIndex[]> {
  if (!isGraphifyEnabled()) return [];
  const loaded: GraphIndex[] = [];
  for (const graph of configuredGraphs()) {
    if (profile !== "all" && graph.name !== profile) continue;
    if (!existsSync(graph.path)) continue;
    try {
      loaded.push(await loadGraph(graph.name, graph.path));
    } catch {
      // Status reports parse errors; search keeps the runtime best-effort.
    }
  }
  return loaded;
}

function neighborsFor(index: GraphIndex, nodeId: string): GraphifyNeighbor[] {
  return index.links
    .filter((link) => link.source === nodeId || link.target === nodeId)
    .slice(0, 6)
    .map((link) => {
      const otherId = link.source === nodeId ? link.target : link.source;
      const other = index.nodes.get(otherId);
      return {
        id: otherId,
        label: other?.label ?? otherId,
        relation: link.relation,
      };
    });
}

function scoreNode(node: GraphNode, terms: string[], graph: string): number {
  const lexicalScore = terms.reduce((score, term) => {
    if (node.id.toLowerCase() === term) return score + 6;
    if (node.label.toLowerCase() === term) return score + 5;
    if (node.label.toLowerCase().includes(term)) return score + 4;
    if (node.sourceFile?.toLowerCase().includes(term)) return score + 3;
    if (node.searchable.includes(term)) return score + 1;
    return score;
  }, 0);
  if (lexicalScore === 0) return 0;
  const authority = matchWikiLLMAuthority(node.sourceFile, graph);
  return authority ? lexicalScore + authority.weight * 4 : lexicalScore;
}

const LOW_SIGNAL_LABELS = new Set([
  "body",
  "default",
  "desc",
  "description",
  "label",
  "name",
  "primarykey",
  "subtitle",
  "title",
  "type",
  "version",
]);

const NOISY_SOURCE_PATTERNS = [
  /(^|[/\\])\.tools[/\\]printed-clis[/\\]/,
  /(^|[/\\])apps[/\\]server[/\\]api[/\\]index\.(js|cjs)$/,
  /(^|[/\\])apps[/\\]web[/\\]src[/\\]locales[/\\]/,
  /(^|[/\\])cli-printing-press[/\\]/,
  /(^|[/\\])packages[/\\]api-client-react[/\\]src[/\\]generated[/\\]/,
  /(^|[/\\])packages[/\\]api-zod[/\\]src[/\\]generated[/\\]/,
  /(^|[/\\])packages[/\\]db[/\\]drizzle[/\\]meta[/\\]/,
];

function normalizedLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isNoisySourceFile(sourceFile: string | null): boolean {
  if (!sourceFile) return false;
  return NOISY_SOURCE_PATTERNS.some((pattern) => pattern.test(sourceFile));
}

function dedupeKey(result: GraphifyResult): string {
  const label = normalizedLabel(result.label);
  if (LOW_SIGNAL_LABELS.has(label)) return `low-signal:${label}`;
  return `${result.graph}:${label}:${result.sourceFile ?? result.id}`;
}

function toResult(index: GraphIndex, node: GraphNode, score: number): GraphifyResult {
  const authority = matchWikiLLMAuthority(node.sourceFile, index.name);
  const result: GraphifyResult = {
    id: node.id,
    graph: index.name,
    label: node.label,
    kind: node.kind,
    source: "graphify",
    sourceFile: node.sourceFile,
    sourceLocation: node.sourceLocation,
    community: node.community,
    score,
    neighbors: neighborsFor(index, node.id),
  };
  if (authority) {
    result.authority = authority.authority;
    result.authorityReason = authority.reason;
    result.authorityWeight = authority.weight;
  }
  return result;
}

export async function getGraphifyStatus(): Promise<GraphifyStatus> {
  const checkedAt = new Date().toISOString();
  if (!isGraphifyEnabled()) {
    return { enabled: false, state: "disabled", graphs: [], checkedAt };
  }

  const graphs: GraphifyGraphStatus[] = [];
  for (const graph of configuredGraphs()) {
    if (!existsSync(graph.path)) {
      graphs.push({
        name: graph.name,
        path: graph.path,
        status: "missing",
        nodes: 0,
        links: 0,
        updatedAt: null,
      });
      continue;
    }
    try {
      const index = await loadGraph(graph.name, graph.path);
      graphs.push({
        name: graph.name,
        path: graph.path,
        status: "ready",
        nodes: index.nodes.size,
        links: index.links.length,
        updatedAt: new Date(index.mtimeMs).toISOString(),
      });
    } catch (err) {
      graphs.push({
        name: graph.name,
        path: graph.path,
        status: "error",
        nodes: 0,
        links: 0,
        updatedAt: null,
        message: err instanceof Error ? err.message : "Graphify graph unreadable",
      });
    }
  }

  const ready = graphs.filter((graph) => graph.status === "ready").length;
  const state: GraphifyState =
    ready === 0 ? "degraded" : ready === graphs.length ? "ready" : "degraded";
  return { enabled: true, state, graphs, checkedAt };
}

export async function searchGraphify(
  query: string,
  options: number | GraphifySearchOptions = queryLimit(),
): Promise<GraphifyResult[]> {
  const opts: GraphifySearchOptions =
    typeof options === "number" ? { limit: options } : options;
  const limit = opts.limit ?? queryLimit();
  const profile = opts.profile ?? "all";
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];

  const results: GraphifyResult[] = [];
  for (const index of await loadAvailableGraphs(profile)) {
    for (const node of index.nodes.values()) {
      if (isNoisySourceFile(node.sourceFile)) continue;
      const score = scoreNode(node, terms, index.name);
      if (score > 0) results.push(toResult(index, node, score));
    }
  }
  const deduped = new Map<string, GraphifyResult>();
  for (const result of results.sort((a, b) => b.score - a.score)) {
    const key = dedupeKey(result);
    if (!deduped.has(key)) deduped.set(key, result);
  }
  return [...deduped.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export async function explainGraphifyNode(
  graph: string,
  id: string,
): Promise<GraphifyResult | null> {
  const config = configuredGraphs().find((item) => item.name === graph);
  if (!isGraphifyEnabled() || !config || !existsSync(config.path)) return null;
  const index = await loadGraph(config.name, config.path);
  const node = index.nodes.get(id);
  return node ? toResult(index, node, 1) : null;
}

export async function buildGraphifyContext(
  query: string,
  options: GraphifySearchOptions = {},
): Promise<string> {
  try {
    const results = await searchGraphify(query, { limit: queryLimit(), ...options });
    if (results.length === 0) return "";
    const lines = results.map((item, index) => {
      const location = item.sourceLocation ?? item.sourceFile ?? item.graph;
      const authority = item.authority
        ? ` authority=${item.authority} weight=${item.authorityWeight ?? "n/a"}`
        : "";
      const neighbors = item.neighbors
        .slice(0, 3)
        .map((neighbor) => neighbor.label)
        .join(", ");
      const suffix = neighbors ? `; collegato a: ${neighbors}` : "";
      const reason = item.authorityReason ? `; authority reason: ${item.authorityReason}` : "";
      return `${index + 1}. [source: graphify graph=${item.graph} community=${item.community ?? "n/a"}${authority}] ${item.label} (${location})${suffix}${reason}`;
    });
    const context = `\n\n## Contesto Graphify\n${lines.join("\n")}`;
    return context.length > maxContextChars()
      ? `${context.slice(0, maxContextChars())}\n[Graphify context truncated]`
      : context;
  } catch {
    return "";
  }
}
