import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
    expect(getDefaultGraphifyGraphs()).toContain("root:graphify-out/graph.json");
    expect(getDefaultGraphifyGraphs()).toContain("apps:apps/graphify-out/graph.json");
    expect(getDefaultGraphifyGraphs()).toContain("packages:packages/graphify-out/graph.json");
  });
});
