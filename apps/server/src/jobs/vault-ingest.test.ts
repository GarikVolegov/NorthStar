import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../middleware/logger", () => ({
  rootLogger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  ragChunksTable: {
    sourceId: "source_id",
  },
  ragSourcesTable: {
    id: "id",
    obsidianPath: "obsidian_path",
    sourceType: "source_type",
    name: "name",
  },
}));

vi.mock("@workspace/ai-server", () => ({
  generateEmbedding: vi.fn(),
}));

import {
  ingestVaultFile,
  parseFrontmatter,
  splitMarkdown,
  walkMarkdown,
  type VaultIngestDeps,
} from "./vault-ingest";

let tempDir: string;

describe("vault-ingest", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "northstar-brain-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("parses runtime frontmatter with inline tags", () => {
    const parsed = parseFrontmatter(`---
layer: product
runtime: true
tags: [L3, product, rag]
---

# RAG`);

    expect(parsed).toMatchObject({
      frontmatter: {
        layer: "product",
        runtime: true,
        tags: ["L3", "product", "rag"],
      },
      body: "# RAG",
    });
  });

  it("walks markdown files without entering 90_Code", async () => {
    await mkdir(join(tempDir, "20_Product"), { recursive: true });
    await mkdir(join(tempDir, "90_Code", "Nodes"), { recursive: true });
    await writeFile(join(tempDir, "20_Product", "Wendy.md"), "# Wendy", "utf8");
    await writeFile(join(tempDir, "90_Code", "Nodes", "auto.md"), "# Auto", "utf8");

    const files = await walkMarkdown(tempDir, { maxFiles: 20 });

    expect(files.map((file) => file.replaceAll("\\", "/"))).toEqual([
      expect.stringContaining("20_Product/Wendy.md"),
    ]);
  });

  it("skips files that are not runtime true without touching storage", async () => {
    const filePath = join(tempDir, "Draft.md");
    await writeFile(filePath, `---
layer: product
runtime: false
---

# Draft`, "utf8");
    const deps = makeDeps();

    await expect(ingestVaultFile(filePath, deps)).resolves.toEqual({ kind: "runtime-false" });
    expect(deps.findExistingSource).not.toHaveBeenCalled();
    expect(deps.generateEmbedding).not.toHaveBeenCalled();
  });

  it("skips unchanged runtime files after refreshing lastIngestedAt", async () => {
    const filePath = join(tempDir, "Wendy.md");
    await writeFile(filePath, `---
layer: product
runtime: true
tags: [L3, wendy]
---

# Wendy

Stable runtime note.`, "utf8");
    const deps = makeDeps({
      existingSource: {
        id: 7,
        currentHash: ".brain/Wendy.md#needs-test-hash",
      },
    });

    const first = await ingestVaultFile(filePath, deps);
    expect(first.kind).toBe("ingested");

    const expectedHash = createHash("sha256")
      .update("# Wendy\n\nStable runtime note.")
      .digest("hex")
      .slice(0, 12);
    const sourceName = `.brain/Wendy.md#${expectedHash}`;
    expect(deps.insertSource).toHaveBeenCalledWith(expect.objectContaining({ name: sourceName }));
    const unchangedDeps = makeDeps({
      existingSource: { id: 7, currentHash: sourceName },
    });

    await expect(ingestVaultFile(filePath, unchangedDeps)).resolves.toEqual({
      kind: "unchanged",
      sourceId: 7,
    });
    expect(unchangedDeps.updateSource).toHaveBeenCalledWith(7);
    expect(unchangedDeps.deleteChunks).not.toHaveBeenCalled();
    expect(unchangedDeps.generateEmbedding).not.toHaveBeenCalled();
  });

  it("splits markdown into stable bounded chunks", () => {
    expect(splitMarkdown("One\n\nTwo\n\nThree", 8)).toEqual(["One\n\nTwo", "Three"]);
  });
});

function makeDeps(opts: {
  existingSource?: { id: number; currentHash: string } | null;
} = {}): VaultIngestDeps & {
  insertSource: ReturnType<typeof vi.fn>;
  updateSource: ReturnType<typeof vi.fn>;
  deleteChunks: ReturnType<typeof vi.fn>;
  generateEmbedding: ReturnType<typeof vi.fn>;
} {
  const insertSource = vi.fn(async () => ({ id: 7 }));
  const updateSource = vi.fn(async () => undefined);
  const deleteChunks = vi.fn(async () => undefined);
  const insertChunk = vi.fn(async () => undefined);
  const generateEmbedding = vi.fn(async () => Array.from({ length: 1536 }, () => 0.1));

  return {
    cwd: tempDir,
    virtualRoot: ".brain",
    findExistingSource: vi.fn(async () => opts.existingSource ?? null),
    insertSource,
    updateSource,
    deleteChunks,
    insertChunk,
    generateEmbedding,
  };
}
