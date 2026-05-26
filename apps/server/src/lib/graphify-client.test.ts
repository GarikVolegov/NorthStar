import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultGraphifyGraphs,
  explainGraphifyNode,
  getGraphifyStatus,
  searchGraphify,
} from "./graphify-client";

const originalEnv = { ...process.env };
let tempDir: string;

async function writeGraph(name: string) {
  const path = join(tempDir, `${name}.json`);
  await writeFile(
    path,
    JSON.stringify({
      nodes: [
        {
          id: "auth",
          label: "Auth Route",
          file_type: "typescript",
          source_file: "apps/server/src/routes/auth.ts",
          source_location: "apps/server/src/routes/auth.ts:10",
          community: 2,
          norm_label: "auth route",
        },
        {
          id: "db",
          label: "Users Table",
          source_file: "packages/db/src/schema.ts",
          community: 2,
        },
      ],
      links: [
        {
          source: "auth",
          target: "db",
          relation: "USES",
        },
      ],
    }),
    "utf8",
  );
  return path;
}

async function writeLegacyGraph(name: string) {
  const path = join(tempDir, `${name}.json`);
  await writeFile(
    path,
    JSON.stringify({
      meta: { name: "legacy" },
      nodes: [
        {
          id: "app-server",
          label: "@northstar/server",
          group: "apps",
          description: "Express API host.",
        },
        {
          id: "pkg-ai-server",
          label: "@workspace/ai-server",
          group: "packages",
          description: "Wendy growth agent package.",
        },
      ],
      edges: [
        {
          from: "app-server",
          to: "pkg-ai-server",
          label: "uses",
          confidence: "EXTRACTED",
        },
      ],
    }),
    "utf8",
  );
  return path;
}

describe("graphify-client", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    tempDir = await mkdtemp(join(tmpdir(), "northstar-graphify-"));
    process.env.GRAPHIFY_ENABLED = "true";
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports disabled status without reading graphs", async () => {
    process.env.GRAPHIFY_ENABLED = "false";
    process.env.GRAPHIFY_GRAPHS = `apps:${join(tempDir, "missing.json")}`;

    await expect(getGraphifyStatus()).resolves.toMatchObject({
      enabled: false,
      state: "disabled",
    });
  });

  it("indexes nodes and links from configured graph files", async () => {
    const graphPath = await writeGraph("apps");
    process.env.GRAPHIFY_GRAPHS = `apps:${graphPath}`;

    const results = await searchGraphify("auth users", 5);

    expect(results[0]).toMatchObject({
      id: "auth",
      graph: "apps",
      label: "Auth Route",
      source: "graphify",
      sourceFile: "apps/server/src/routes/auth.ts",
      community: "2",
    });
    expect(results[0]?.neighbors[0]).toMatchObject({
      id: "db",
      label: "Users Table",
      relation: "USES",
    });
  });

  it("indexes legacy graphify edges that use from/to/label", async () => {
    const graphPath = await writeLegacyGraph("root");
    process.env.GRAPHIFY_GRAPHS = `root:${graphPath}`;

    const results = await searchGraphify("server ai", 5);
    const appServer = results.find((result) => result.id === "app-server");

    expect(appServer).toMatchObject({
      id: "app-server",
      graph: "root",
      label: "@northstar/server",
    });
    expect(appServer?.neighbors[0]).toMatchObject({
      id: "pkg-ai-server",
      label: "@workspace/ai-server",
      relation: "uses",
    });
  });

  it("filters search by graph profile", async () => {
    const codePath = await writeGraph("code");
    const docsPath = await writeLegacyGraph("docs");
    process.env.GRAPHIFY_GRAPHS = `code:${codePath},docs:${docsPath}`;

    const results = await searchGraphify("server", { limit: 5, profile: "docs" });

    expect(results.map((result) => result.graph)).toEqual(["docs", "docs"]);
    expect(results.map((result) => result.id)).toContain("app-server");
  });

  it("deduplicates repeated low-signal labels and suppresses generated noise", async () => {
    const graphPath = join(tempDir, "noisy.json");
    await writeFile(
      graphPath,
      JSON.stringify({
        nodes: [
          {
            id: "title-1",
            label: "title",
            source_file: "apps/server/src/routes/wiki.ts",
          },
          {
            id: "title-2",
            label: "title",
            source_file: "packages/ai-server/src/wiki/chat.ts",
          },
          {
            id: "generated",
            label: "Auth Route",
            source_file: "apps/web/src/locales/en/translation.json",
          },
          {
            id: "real",
            label: "Wiki Context Router",
            source_file: "apps/server/src/lib/wikillm-context-router.ts",
          },
        ],
        links: [],
      }),
      "utf8",
    );
    process.env.GRAPHIFY_GRAPHS = `code:${graphPath}`;

    const titleResults = await searchGraphify("title", { limit: 10 });
    const wikiResults = await searchGraphify("wiki", { limit: 10 });

    expect(titleResults).toHaveLength(1);
    expect(wikiResults.map((result) => result.id)).toContain("real");
    expect(wikiResults.map((result) => result.id)).not.toContain("generated");
  });

  it("uses the WikiLLM authority manifest as a soft ranking boost", async () => {
    const graphPath = join(tempDir, "authority.json");
    const manifestPath = join(tempDir, "config", "wikillm", "authority-manifest.json");
    await mkdir(join(tempDir, "config", "wikillm"), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: "wikillm-core",
            match: "apps/server/src/lib/wikillm-context-router.ts",
            profiles: ["code"],
            domains: ["wikillm"],
            authority: "core",
            weight: 1,
            reason: "Router condiviso WikiLLM.",
            tags: ["router"],
          },
          {
            id: "wiki-route-support",
            match: "apps/server/src/routes/wiki.ts",
            profiles: ["code"],
            domains: ["wikillm"],
            authority: "support",
            weight: 0.65,
            reason: "Entrypoint Wiki.",
            tags: ["route"],
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      graphPath,
      JSON.stringify({
        nodes: [
          {
            id: "route",
            label: "Wiki Pipeline",
            source_file: "apps/server/src/routes/wiki.ts",
          },
          {
            id: "router",
            label: "Wiki Pipeline",
            source_file: "apps/server/src/lib/wikillm-context-router.ts",
          },
        ],
        links: [],
      }),
      "utf8",
    );
    process.env.WIKILLM_AUTHORITY_MANIFEST = manifestPath;
    process.env.GRAPHIFY_GRAPHS = `code:${graphPath}`;

    const results = await searchGraphify("wiki pipeline", { limit: 5, profile: "code" });

    expect(results[0]).toMatchObject({
      id: "router",
      authority: "core",
      authorityReason: "Router condiviso WikiLLM.",
      authorityWeight: 1,
    });
    expect(results[1]).toMatchObject({
      id: "route",
      authority: "support",
      authorityWeight: 0.65,
    });
  });

  it("explains a node with neighbors", async () => {
    const graphPath = await writeGraph("apps");
    process.env.GRAPHIFY_GRAPHS = `apps:${graphPath}`;

    await expect(explainGraphifyNode("apps", "auth")).resolves.toMatchObject({
      id: "auth",
      graph: "apps",
      neighbors: [{ id: "db", label: "Users Table", relation: "USES" }],
    });
  });

  it("marks missing graph files as degraded", async () => {
    process.env.GRAPHIFY_GRAPHS = `apps:${join(tempDir, "missing.json")}`;

    await expect(getGraphifyStatus()).resolves.toMatchObject({
      enabled: true,
      state: "degraded",
      graphs: [
        {
          name: "apps",
          status: "missing",
        },
      ],
    });
  });

  it("includes the workspace root graph as the primary default graph", () => {
    expect(getDefaultGraphifyGraphs()).toBe(
      "code:graphify-out/code/graph.json,process:graphify-out/process/graph.json,docs:graphify-out/docs/graph.json",
    );
  });
});
