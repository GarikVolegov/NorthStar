import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOGO_PRESETS } from "@workspace/api-zod/logo-presets";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("logo preset assets", () => {
  it("has a public asset for every configured app logo preset", () => {
    for (const preset of LOGO_PRESETS) {
      const assetPath = path.join(root, "apps/web/public", preset.assetUrl);
      expect(existsSync(assetPath), `${preset.id} asset missing at ${preset.assetUrl}`).toBe(true);
    }
  });
});
