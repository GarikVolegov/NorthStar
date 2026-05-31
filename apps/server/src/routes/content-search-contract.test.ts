import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clampContentLimit, readContentSearchQuery } from "../lib/content-search";

describe("content search contracts", () => {
  it("normalizes the query aliases used by news, growth and Wendy tools", () => {
    expect(readContentSearchQuery({ q: " AI " })).toBe("AI");
    expect(readContentSearchQuery({ query: "leadership" })).toBe("leadership");
    expect(readContentSearchQuery({ search: "produttivita" })).toBe("produttivita");
    expect(readContentSearchQuery({ topic: "burnout" })).toBe("burnout");
    expect(readContentSearchQuery({ q: ["first", "second"] })).toBe("first");
    expect(readContentSearchQuery({})).toBe("");
  });

  it("clamps content limits to a safe range", () => {
    expect(clampContentLimit(undefined, 20, 100)).toBe(20);
    expect(clampContentLimit("0", 20, 100)).toBe(20);
    expect(clampContentLimit("-10", 20, 100)).toBe(20);
    expect(clampContentLimit("12", 20, 100)).toBe(12);
    expect(clampContentLimit("999", 20, 100)).toBe(100);
  });

  it("keeps public discovery surfaces public at the route mount", () => {
    const routeConfig = readFileSync(join(process.cwd(), "src/route-config.ts"), "utf8");

    expect(routeConfig).toMatch(/path:\s*"\/api\/crescita"[\s\S]*?auth:\s*"public"/);
    expect(routeConfig).toMatch(/path:\s*"\/api\/search"[\s\S]*?auth:\s*"public"/);
    expect(routeConfig).toMatch(/path:\s*"\/api\/search\/route"[\s\S]*?auth:\s*"public"/);
    expect(routeConfig).toMatch(/path:\s*"\/api\/search\/hybrid"[\s\S]*?auth:\s*"public"/);
  });
});
