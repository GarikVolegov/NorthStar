import { describe, it, expect } from "vitest";
import {
  getStaticNewsItems,
  getStaticNewsDetail,
  isStaticNewsId,
} from "./news-fallback";

describe("news-fallback", () => {
  it("returns a non-empty set with the NewsListItem shape", () => {
    const items = getStaticNewsItems();
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(typeof it.id).toBe("string");
      expect(typeof it.title).toBe("string");
      expect(it.detailUrl).toBe(`/news/${it.id}`);
      expect(it.plan).toBe("free");
      // publishedAt is a valid ISO date in the past
      const ts = new Date(it.publishedAt).getTime();
      expect(Number.isNaN(ts)).toBe(false);
      expect(ts).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  it("respects the limit", () => {
    expect(getStaticNewsItems({ limit: 2 })).toHaveLength(2);
    expect(getStaticNewsItems({ limit: 1 })).toHaveLength(1);
  });

  it("filters by category when items exist for it", () => {
    const tech = getStaticNewsItems({ category: "technology" });
    expect(tech.length).toBeGreaterThan(0);
    expect(tech.every((i) => i.category === "technology")).toBe(true);
  });

  it("never returns empty: unknown category falls back to the full set", () => {
    const items = getStaticNewsItems({ category: "does-not-exist" });
    expect(items.length).toBeGreaterThan(0);
  });

  it("matches a sector loosely and still never returns empty", () => {
    expect(getStaticNewsItems({ sector: "Tecnologia" }).length).toBeGreaterThan(0);
    expect(getStaticNewsItems({ sector: "settore-inesistente" }).length).toBeGreaterThan(0);
  });

  it("serves a detail (with markdown content) for a known sample id", () => {
    const detail = getStaticNewsDetail("sample-1");
    expect(detail).not.toBeNull();
    expect(detail?.content).toContain("###");
    expect(detail?.id).toBe("sample-1");
  });

  it("returns null for an unknown detail id", () => {
    expect(getStaticNewsDetail("sample-does-not-exist")).toBeNull();
    expect(getStaticNewsDetail("123")).toBeNull();
  });

  it("recognises static ids", () => {
    expect(isStaticNewsId("sample-1")).toBe(true);
    expect(isStaticNewsId("42")).toBe(false);
  });
});
