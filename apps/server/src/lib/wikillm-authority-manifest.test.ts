import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadWikiLLMAuthorityManifest,
  matchWikiLLMAuthority,
} from "./wikillm-authority-manifest";

const originalEnv = { ...process.env };
let tempDir: string;

describe("wikillm-authority-manifest", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    tempDir = await mkdtemp(join(tmpdir(), "northstar-wikillm-manifest-"));
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns null when the configured manifest is missing", () => {
    process.env.WIKILLM_AUTHORITY_MANIFEST = join(tempDir, "missing.json");

    expect(loadWikiLLMAuthorityManifest()).toBeNull();
    expect(matchWikiLLMAuthority("apps/server/src/lib/graphify-client.ts", "code")).toBeNull();
  });

  it("matches source paths by profile and applies default authority weights", async () => {
    const manifestPath = join(tempDir, "config", "wikillm", "authority-manifest.json");
    await mkdir(join(tempDir, "config", "wikillm"), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: "growth-agent",
            match: "packages/ai-server/src/growth-agent/",
            profiles: ["code"],
            domains: ["wendy"],
            authority: "support",
            reason: "Motore profondo di Wendy.",
            tags: ["agent"],
          },
          {
            id: "process-only",
            match: "packages/ai-server/src/growth-agent/",
            profiles: ["process"],
            domains: ["process"],
            authority: "core",
            reason: "Non deve valere nel grafo code.",
          },
        ],
      }),
      "utf8",
    );
    process.env.WIKILLM_AUTHORITY_MANIFEST = manifestPath;

    expect(matchWikiLLMAuthority("packages/ai-server/src/growth-agent/agent.ts", "code")).toMatchObject({
      entryId: "growth-agent",
      authority: "support",
      weight: 0.65,
      reason: "Motore profondo di Wendy.",
      domains: ["wendy"],
      tags: ["agent"],
    });
  });
});
