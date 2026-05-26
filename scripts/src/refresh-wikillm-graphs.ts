import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export type WikiLLMGraphProfile = "code" | "process" | "docs";
export type WikiLLMCorpusPlan = Record<WikiLLMGraphProfile, string[]>;
export interface WikiLLMFallbackGraphInput {
  path: string;
  content: string;
}
type GraphRecord = Record<string, unknown>;
export interface WikiLLMAudit {
  generatedAt: string;
  root: string;
  summary: Record<WikiLLMGraphProfile, { files: number }>;
  included: WikiLLMCorpusPlan;
  excluded: Array<{ path: string; reason: string }>;
  topSources: Array<{ source: string; files: number }>;
  warnings: string[];
}

const PROFILES: WikiLLMGraphProfile[] = ["code", "process", "docs"];

const EXCLUDED_PREFIXES = [
  ".git/",
  ".tmp/",
  ".tools/printed-clis/",
  "apps/server/api/",
  "apps/web/src/locales/",
  "cli-printing-press/",
  "coverage/",
  "dist/",
  "build/",
  "graphify-out/",
  "node_modules/",
  "packages/api-client-react/src/generated/",
  "packages/api-zod/src/generated/",
  "packages/db/drizzle/meta/",
  "playwright-report/",
  "test-results/",
];

const EXCLUDED_SEGMENTS = new Set([
  ".cache",
  ".pnpm-store",
  ".turbo",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

const EXCLUDED_BASENAMES = new Set([
  "pnpm-lock.yaml",
  "uv.lock",
  "package-lock.json",
  "yarn.lock",
  "skills-lock.json",
]);

const INCLUDED_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

function extension(path: string): string {
  const name = basename(path).toLowerCase();
  const index = name.lastIndexOf(".");
  return index === -1 ? "" : name.slice(index);
}

function exclusionReason(path: string): string | null {
  const normalized = normalizePath(path);
  if (!normalized || normalized.endsWith("/")) return "not-a-file";
  const excludedBasename = basename(normalized);
  if (EXCLUDED_BASENAMES.has(excludedBasename)) return `excluded-basename:${excludedBasename}`;
  const excludedPrefix = EXCLUDED_PREFIXES.find((prefix) => normalized.startsWith(prefix));
  if (excludedPrefix) return `excluded-prefix:${excludedPrefix}`;
  const excludedSegment = normalized.split("/").find((segment) => EXCLUDED_SEGMENTS.has(segment));
  if (excludedSegment) return `excluded-segment:${excludedSegment}`;
  const ext = extension(normalized);
  if (!INCLUDED_EXTENSIONS.has(ext)) return `unsupported-extension:${ext || "none"}`;
  return null;
}

function inclusionRoot(path: string): string {
  const [first, second] = normalizePath(path).split("/");
  if (first === "apps" || first === "packages") return [first, second].filter(Boolean).join("/");
  if (first === "scripts") return "scripts/src";
  return first || "root";
}

export function isWikiLLMCorpusPath(path: string): boolean {
  const normalized = normalizePath(path);
  if (exclusionReason(normalized)) return false;

  return (
    normalized.startsWith("apps/") ||
    normalized.startsWith("api/") ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("lib/") ||
    normalized.startsWith("packages/") ||
    normalized.startsWith("scripts/src/") ||
    /^[A-Z_]+\.md$/.test(normalized) ||
    normalized === "README.md" ||
    normalized === "package.json" ||
    normalized === "pnpm-workspace.yaml" ||
    normalized === "tsconfig.base.json"
  );
}

export function getWikiLLMProfilesForPath(path: string): WikiLLMGraphProfile[] {
  const normalized = normalizePath(path);
  if (!isWikiLLMCorpusPath(normalized)) return [];

  if (
    normalized.startsWith("apps/") ||
    normalized.startsWith("api/") ||
    normalized.startsWith("lib/") ||
    normalized.startsWith("packages/")
  ) {
    return ["code"];
  }

  if (
    normalized.startsWith("scripts/src/") ||
    normalized.startsWith("docs/architecture/") ||
    normalized.startsWith("docs/ai-modules/") ||
    normalized.endsWith("_RULES.md") ||
    normalized === "ARCHITECTURE.md" ||
    normalized === "RUNBOOK.md"
  ) {
    return ["process"];
  }

  return ["docs"];
}

export function planWikiLLMCorpus(paths: string[]): WikiLLMCorpusPlan {
  const plan: WikiLLMCorpusPlan = { code: [], process: [], docs: [] };
  for (const rawPath of paths.map(normalizePath).sort()) {
    for (const profile of getWikiLLMProfilesForPath(rawPath)) {
      plan[profile].push(rawPath);
    }
  }
  return plan;
}

export function buildWikiLLMAudit(root: string, paths: string[]): WikiLLMAudit {
  const normalizedPaths = paths.map(normalizePath).sort();
  const included = planWikiLLMCorpus(normalizedPaths);
  const includedSet = new Set(Object.values(included).flat());
  const excluded = normalizedPaths
    .filter((path) => !includedSet.has(path))
    .map((path) => ({
      path,
      reason: exclusionReason(path) ?? "outside-allowed-roots",
    }));
  const topSourceCounts = new Map<string, number>();
  for (const path of Object.values(included).flat()) {
    const source = inclusionRoot(path);
    topSourceCounts.set(source, (topSourceCounts.get(source) ?? 0) + 1);
  }
  const topSources = [...topSourceCounts.entries()]
    .map(([source, files]) => ({ source, files }))
    .sort((a, b) => b.files - a.files || a.source.localeCompare(b.source))
    .slice(0, 12);
  const warnings = excluded
    .filter((item) =>
      item.path.startsWith(".tools/printed-clis/")
      || item.path.startsWith("apps/web/src/locales/")
      || item.path.startsWith("cli-printing-press/")
      || item.path.startsWith("packages/db/drizzle/meta/"),
    )
    .map((item) => `Excluded noisy source: ${item.path}`);
  return {
    generatedAt: new Date().toISOString(),
    root: resolve(root),
    summary: {
      code: { files: included.code.length },
      process: { files: included.process.length },
      docs: { files: included.docs.length },
    },
    included,
    excluded,
    topSources,
    warnings,
  };
}

function renderAuditMarkdown(audit: WikiLLMAudit): string {
  const summary = PROFILES
    .map((profile) => `- ${profile}: ${audit.summary[profile].files} file(s)`)
    .join("\n");
  const topSources = audit.topSources
    .map((item) => `- ${item.source}: ${item.files}`)
    .join("\n") || "- none";
  const warnings = audit.warnings.slice(0, 30).map((warning) => `- ${warning}`).join("\n") || "- none";
  return `# WikiLLM Graph Refresh Audit

Generated at: ${audit.generatedAt}
Root: ${audit.root}

## Summary
${summary}

## Top Sources
${topSources}

## Warnings
${warnings}

## Excluded
- ${audit.excluded.length} excluded file(s)
`;
}

async function writeWikiLLMAudit(root: string, audit: WikiLLMAudit): Promise<void> {
  const target = join(root, "graphify-out");
  await mkdir(target, { recursive: true });
  await writeFile(join(target, "wikillm-audit.json"), JSON.stringify(audit, null, 2), "utf8");
  await writeFile(join(target, "WIKILLM_AUDIT.md"), renderAuditMarkdown(audit), "utf8");
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

export function graphifyRefreshArgs(profileRoot: string): string[] {
  return ["extract", profileRoot, "--out", profileRoot];
}

function titleFromPath(path: string): string {
  const normalized = normalizePath(path);
  const name = basename(normalized).replace(/\.[^.]+$/, "");
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const FALLBACK_CONCEPTS = [
  { id: "wendy-brain", label: "Wendy Brain", pattern: /\bwendy\b|\bwendy brain\b/i },
  { id: "rag-pipeline", label: "RAG Pipeline", pattern: /\brag\b|\bretriever\b|knowledge base/i },
  { id: "graphify-knowledge-graph", label: "Graphify Knowledge Graph", pattern: /graphify|knowledge graph/i },
  { id: "wikillm-context-router", label: "WikiLLM Context Router", pattern: /wikillm|context router|federated context/i },
  { id: "growth-agent-pipeline", label: "GrowthAgent Pipeline", pattern: /growth[- ]agent|\bpipeline\b/i },
];

export function buildWikiLLMFallbackGraph(
  profile: WikiLLMGraphProfile,
  files: WikiLLMFallbackGraphInput[],
): { nodes: unknown[]; links: unknown[]; meta: Record<string, unknown> } {
  const fileNodes = files.map((file, index) => ({
    id: `${profile}:${normalizePath(file.path)}`,
    label: titleFromPath(file.path),
    type: profile === "code" ? "source" : "document",
    group: profile,
    community: profile,
    source_file: normalizePath(file.path),
    source_location: `${normalizePath(file.path)}:1`,
    description: file.content.replace(/\s+/g, " ").trim().slice(0, 1_500),
    norm_label: normalizePath(file.path).replace(/[/._-]+/g, " "),
    order: index,
  }));
  const conceptHits = new Map<string, Set<string>>();
  for (const concept of FALLBACK_CONCEPTS) {
    for (const file of files) {
      if (concept.pattern.test(file.content) || concept.pattern.test(file.path)) {
        const conceptId = `${profile}:concept:${concept.id}`;
        const fileId = `${profile}:${normalizePath(file.path)}`;
        if (!conceptHits.has(conceptId)) conceptHits.set(conceptId, new Set());
        conceptHits.get(conceptId)?.add(fileId);
      }
    }
  }
  const conceptNodes = FALLBACK_CONCEPTS
    .map((concept) => ({
      concept,
      id: `${profile}:concept:${concept.id}`,
    }))
    .filter((item) => conceptHits.has(item.id))
    .map((item) => ({
      id: item.id,
      label: item.concept.label,
      type: "concept",
      group: profile,
      community: profile,
      source_file: null,
      source_location: null,
      description: `${item.concept.label} concept hub for the ${profile} WikiLLM graph.`,
      norm_label: item.concept.label.toLowerCase(),
    }));
  const conceptLinks = [...conceptHits.entries()].flatMap(([conceptId, fileIds]) =>
    [...fileIds].map((fileId) => ({
      source: conceptId,
      target: fileId,
      relation: "DESCRIBES",
    })),
  );
  return {
    meta: {
      generator: "northstar-wikillm-fallback",
      profile,
      generated_at: new Date().toISOString(),
    },
    nodes: [...conceptNodes, ...fileNodes],
    links: conceptLinks,
  };
}

async function writeFallbackGraph(
  profileRoot: string,
  profile: WikiLLMGraphProfile,
  files: string[],
): Promise<void> {
  const graphifyOut = join(profileRoot, "graphify-out");
  await mkdir(graphifyOut, { recursive: true });
  const graph = buildWikiLLMFallbackGraph(
    profile,
    await Promise.all(
      files.map(async (file) => ({
        path: file,
        content: await readFile(join(profileRoot, file), "utf8").catch(() => ""),
      })),
    ),
  );
  await writeFile(join(graphifyOut, "graph.json"), JSON.stringify(graph, null, 2), "utf8");
  await writeFile(
    join(graphifyOut, "GRAPH_REPORT.md"),
    `# WikiLLM ${profile} Graph\n\nGenerated by NorthStar deterministic fallback.\n\nFiles: ${files.length}\n`,
    "utf8",
  );
  await writeFile(
    join(graphifyOut, "manifest.json"),
    JSON.stringify({ profile, files: files.length, generator: "northstar-wikillm-fallback" }, null, 2),
    "utf8",
  );
}

async function listTrackedFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn("git", ["ls-files"], { cwd: root });
    child.stdout?.on("data", (chunk) => output.push(String(chunk)));
    child.stderr?.pipe(process.stderr);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`git ls-files exited with ${code}`));
    });
  });
  return output.join("").split(/\r?\n/).filter(Boolean);
}

async function copyProfileCorpus(root: string, tempRoot: string, profile: WikiLLMGraphProfile, files: string[]): Promise<string> {
  const profileRoot = join(tempRoot, profile);
  await rm(profileRoot, { recursive: true, force: true });
  await mkdir(profileRoot, { recursive: true });
  for (const file of files) {
    const source = resolve(root, file);
    const target = resolve(profileRoot, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { force: true });
  }
  return profileRoot;
}

async function publishGraph(root: string, profile: WikiLLMGraphProfile, profileRoot: string): Promise<void> {
  const generated = join(profileRoot, "graphify-out");
  const target = join(root, "graphify-out", profile);
  await rm(target, { recursive: true, force: true });
  await mkdir(dirname(target), { recursive: true });
  await cp(generated, target, { recursive: true, force: true });
}

function readArray(record: GraphRecord, key: string): GraphRecord[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is GraphRecord => Boolean(item) && typeof item === "object")
    : [];
}

function readNodeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && typeof (value as GraphRecord).id === "string") {
    return (value as GraphRecord).id as string;
  }
  return null;
}

export function mergeWikiLLMGraphs(
  graphs: Array<{ profile: WikiLLMGraphProfile; graph: GraphRecord }>,
): { nodes: GraphRecord[]; links: GraphRecord[]; meta: GraphRecord } {
  const nodes: GraphRecord[] = [];
  const links: GraphRecord[] = [];
  for (const item of graphs) {
    const idMap = new Map<string, string>();
    for (const node of readArray(item.graph, "nodes")) {
      const oldId = readNodeId(node.id);
      if (!oldId) continue;
      const id = `${item.profile}:${oldId}`;
      idMap.set(oldId, id);
      nodes.push({ ...node, id, profile: item.profile });
    }
    const rawLinks = readArray(item.graph, "links").length > 0
      ? readArray(item.graph, "links")
      : readArray(item.graph, "edges");
    for (const link of rawLinks) {
      const source = readNodeId(link.source) ?? readNodeId(link.from);
      const target = readNodeId(link.target) ?? readNodeId(link.to);
      if (!source || !target) continue;
      links.push({
        ...link,
        source: idMap.get(source) ?? `${item.profile}:${source}`,
        target: idMap.get(target) ?? `${item.profile}:${target}`,
        profile: item.profile,
      });
    }
  }
  return {
    meta: {
      generator: "northstar-wikillm-federated-merge",
      generated_at: new Date().toISOString(),
      profiles: graphs.map((item) => item.profile),
    },
    nodes,
    links,
  };
}

async function writeMergedGraph(root: string): Promise<void> {
  const graphs = (
    await Promise.all(
      PROFILES.map(async (profile) => {
        const path = join(root, "graphify-out", profile, "graph.json");
        try {
          return { profile, graph: JSON.parse(await readFile(path, "utf8")) as GraphRecord };
        } catch {
          return null;
        }
      }),
    )
  ).filter((item): item is { profile: WikiLLMGraphProfile; graph: GraphRecord } => item !== null);
  if (graphs.length === 0) return;
  await writeFile(
    join(root, "graphify-out", "graph.json"),
    JSON.stringify(mergeWikiLLMGraphs(graphs), null, 2),
    "utf8",
  );
}

export async function refreshWikiLLMGraphs(root = process.cwd()): Promise<WikiLLMCorpusPlan> {
  const resolvedRoot = resolve(root);
  const paths = await listTrackedFiles(resolvedRoot);
  const audit = buildWikiLLMAudit(resolvedRoot, paths);
  const plan = audit.included;
  const tempRoot = join(tmpdir(), "northstar-wikillm-graphs");
  await mkdir(tempRoot, { recursive: true });

  for (const profile of PROFILES) {
    if (plan[profile].length === 0) continue;
    const profileRoot = await copyProfileCorpus(resolvedRoot, tempRoot, profile, plan[profile]);
    if (profile === "code") {
      await run("graphify", graphifyRefreshArgs(profileRoot), resolvedRoot);
    } else {
      await writeFallbackGraph(profileRoot, profile, plan[profile]);
    }
    await publishGraph(resolvedRoot, profile, profileRoot);
  }

  await writeWikiLLMAudit(resolvedRoot, audit);
  await writeMergedGraph(resolvedRoot);
  return plan;
}

async function main(): Promise<void> {
  const rootArg = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : process.cwd();
  const dryRun = process.argv.includes("--dry-run");
  const root = resolve(rootArg);
  const audit = buildWikiLLMAudit(root, await listTrackedFiles(root));
  const plan = audit.included;

  for (const profile of PROFILES) {
    console.log(`${profile}: ${plan[profile].length} file(s)`);
  }
  console.log(`excluded: ${audit.excluded.length} file(s)`);
  console.log(`audit: graphify-out/WIKILLM_AUDIT.md`);

  if (!dryRun) {
    await refreshWikiLLMGraphs(root);
  } else {
    await writeWikiLLMAudit(root, audit);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
