import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type CorpusModule = {
  buildWikiLLMFallbackGraph(profile: "code" | "process" | "docs", files: Array<{ path: string; content: string }>): {
    nodes: Array<{ id: string; label: string; source_file: string | null; description: string }>;
    links: Array<{ source: string; target: string; relation: string }>;
  };
  buildWikiLLMAudit(root: string, paths: string[]): {
    summary: Record<"code" | "process" | "docs", { files: number }>;
    excluded: Array<{ path: string; reason: string }>;
    topSources: Array<{ source: string; files: number }>;
    warnings: string[];
  };
  getWikiLLMProfilesForPath(path: string): string[];
  graphifyRefreshArgs(profileRoot: string): string[];
  isWikiLLMCorpusPath(path: string): boolean;
  mergeWikiLLMGraphs(graphs: Array<{ profile: "code" | "process" | "docs"; graph: Record<string, unknown> }>): {
    nodes: Array<{ id: string; profile: string }>;
    links: Array<{ source: string; target: string; profile: string }>;
  };
  planWikiLLMCorpus(paths: string[]): Record<"code" | "process" | "docs", string[]>;
};

let corpus: CorpusModule;

describe("refresh-wikillm-graphs corpus planning", () => {
  beforeAll(async () => {
    const moduleUrl = pathToFileURL(
      resolve(process.cwd(), "../../scripts/src/refresh-wikillm-graphs.ts"),
    ).href;
    corpus = await import(moduleUrl) as CorpusModule;
  });

  it("excludes generated, vendored, cache, and repetitive low-signal paths", () => {
    const excluded = [
      ".brain/40_Agent_Context/tools/printed-clis/openai/internal/types/types.go",
      "apps/server/api/index.js",
      "apps/server/api/index.js",
      "apps/web/src/locales/it/translation.json",
      "packages/db/drizzle/meta/0005_snapshot.json",
      "packages/api-client-react/src/generated/api.ts",
      "graphify-out/graph.json",
      "node_modules/pkg/index.js",
    ];

    for (const path of excluded) {
      expect(corpus.isWikiLLMCorpusPath(path), path).toBe(false);
    }
  });

  it("keeps useful monorepo source, docs, scripts, and runtime adapters", () => {
    const included = [
      "apps/server/src/lib/graphify-client.ts",
      "apps/server/src/routes/wiki.ts",
      "apps/web/src/features/knowledge-graph/KnowledgeGraphCanvas.tsx",
      "packages/ai-server/src/wiki/chat.ts",
      "packages/db/src/schema/wendyBrain.ts",
      "scripts/src/seed-rag.ts",
      "docs/architecture/northstar-system-map.md",
      "README.md",
      ".brain/20_Product/ARCHITECTURE.md",
      "packages/ml-service/lib/ml/embedder.py",
    ];

    for (const path of included) {
      expect(corpus.isWikiLLMCorpusPath(path), path).toBe(true);
    }
  });

  it("assigns clean files to federated graph profiles", () => {
    expect(corpus.getWikiLLMProfilesForPath("apps/server/src/routes/wiki.ts")).toEqual(["code"]);
    expect(corpus.getWikiLLMProfilesForPath("packages/ai-server/src/wendy-brain.ts")).toEqual(["code"]);
    expect(corpus.getWikiLLMProfilesForPath("scripts/src/seed-rag.ts")).toEqual(["process"]);
    expect(corpus.getWikiLLMProfilesForPath("docs/architecture/northstar-system-map.md")).toEqual(["process"]);
    expect(corpus.getWikiLLMProfilesForPath("docs/openhuman-integration.md")).toEqual(["docs"]);
    expect(corpus.getWikiLLMProfilesForPath("README.md")).toEqual(["docs"]);
  });

  it("builds a deterministic profile plan without excluded files", () => {
    const plan = corpus.planWikiLLMCorpus([
      "apps/server/src/lib/graphify-client.ts",
      "apps/web/src/locales/en/translation.json",
      "docs/openhuman-integration.md",
      "scripts/src/seed-rag.ts",
      "cli-printing-press/internal/pipeline/state.go",
    ]);

    expect(plan.code).toEqual(["apps/server/src/lib/graphify-client.ts"]);
    expect(plan.docs).toEqual(["docs/openhuman-integration.md"]);
    expect(plan.process).toEqual(["scripts/src/seed-rag.ts"]);
    expect(Object.values(plan).flat()).not.toContain("apps/web/src/locales/en/translation.json");
  });

  it("builds an audit report for included, excluded, and noisy sources", () => {
    const audit = corpus.buildWikiLLMAudit(process.cwd(), [
      "apps/server/src/lib/graphify-client.ts",
      "apps/server/src/routes/wiki.ts",
      "docs/openhuman-integration.md",
      "scripts/src/seed-rag.ts",
      "apps/web/src/locales/en/translation.json",
      "cli-printing-press/internal/pipeline/state.go",
    ]);

    expect(audit.summary).toMatchObject({
      code: { files: 2 },
      docs: { files: 1 },
      process: { files: 1 },
    });
    expect(audit.excluded).toContainEqual({
      path: "apps/web/src/locales/en/translation.json",
      reason: "excluded-prefix:apps/web/src/locales/",
    });
    expect(audit.topSources[0]).toEqual({ source: "apps/server", files: 2 });
    expect(audit.warnings).toContain("Excluded noisy source: apps/web/src/locales/en/translation.json");
  });

  it("uses graphify extract for fresh temporary corpora", () => {
    expect(corpus.graphifyRefreshArgs("C:/repo/.tmp/wikillm-graphs/code")).toEqual([
      "extract",
      "C:/repo/.tmp/wikillm-graphs/code",
      "--out",
      "C:/repo/.tmp/wikillm-graphs/code",
    ]);
  });

  it("builds Graphify-compatible fallback graphs for process and docs profiles", () => {
    const graph = corpus.buildWikiLLMFallbackGraph("process", [
      {
        path: "docs/ai-modules/ROUTER.md",
        content: "Wendy Brain, RAG pipeline and Graphify context router.",
      },
    ]);

    expect(graph.nodes).toContainEqual(expect.objectContaining({
      label: "Wendy Brain",
      source_file: null,
    }));
    expect(graph.nodes).toContainEqual(expect.objectContaining({
      label: "RAG Pipeline",
      source_file: null,
    }));
    expect(graph.nodes).toContainEqual(expect.objectContaining({
      label: "ROUTER",
      source_file: "docs/ai-modules/ROUTER.md",
      description: "Wendy Brain, RAG pipeline and Graphify context router.",
    }));
    expect(graph.links).toContainEqual(expect.objectContaining({
      relation: "DESCRIBES",
      target: "process:docs/ai-modules/ROUTER.md",
    }));
  });

  it("merges federated profile graphs into a clean root graph", () => {
    const merged = corpus.mergeWikiLLMGraphs([
      {
        profile: "code",
        graph: {
          nodes: [{ id: "router", label: "Router" }],
          links: [{ source: "router", target: "wiki", relation: "USES" }],
        },
      },
      {
        profile: "process",
        graph: {
          nodes: [{ id: "process:docs/ROUTER.md", label: "ROUTER" }],
          links: [],
        },
      },
    ]);

    expect(merged.nodes.map((node) => node.id)).toEqual([
      "code:router",
      "process:process:docs/ROUTER.md",
    ]);
    expect(merged.links[0]).toMatchObject({
      source: "code:router",
      target: "code:wiki",
      profile: "code",
    });
  });
});
