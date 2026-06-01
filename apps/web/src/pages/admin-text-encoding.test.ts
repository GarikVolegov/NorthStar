import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ADMIN_TEXT_SURFACES = [
  "calendar.tsx",
  "admin-affiliazione.tsx",
  "admin-agenti.tsx",
  "admin-crescita.tsx",
  "admin-messaggi.tsx",
  "admin-status.tsx",
] as const;

const MOJIBAKE_PATTERN = /Ã|Â|â/;

describe("admin page text encoding", () => {
  it("keeps visible admin copy readable", () => {
    const pagesDir = resolve(__dirname);
    const offenders = ADMIN_TEXT_SURFACES.flatMap((fileName) => {
      const content = readFileSync(resolve(pagesDir, fileName), "utf8");
      return content
        .split(/\r?\n/)
        .map((line, index) => ({ fileName, lineNumber: index + 1, line }))
        .filter(({ line }) => MOJIBAKE_PATTERN.test(line))
        .map(({ fileName, lineNumber }) => `${fileName}:${lineNumber}`);
    });

    expect(offenders).toEqual([]);
  });
});
