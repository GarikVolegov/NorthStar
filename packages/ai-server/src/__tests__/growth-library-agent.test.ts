import { describe, expect, it } from "vitest";
import {
  analyzeGrowthLibraryGaps,
  buildCuratedGrowthArticle,
  normalizeGrowthCategory,
} from "../discovery-agent/growth-library-agent";

describe("growth-library-agent", () => {
  it("normalizes enriched growth discoveries into publishable articles", () => {
    const article = buildCuratedGrowthArticle({
      title: "Come proteggere il focus nel lavoro ibrido",
      urlHash: "abcdef1234567890",
      category: "habits_productivity",
      summary: "Tre segnali pratici su riunioni, blocchi di lavoro e notifiche.",
      insightText: "Per NorthStar conta perche trasforma produttivita in scelte operative.",
      difficulty: "medium",
      skillTags: ["focus", "time blocking"],
    });

    expect(article).toMatchObject({
      slug: "curated-abcdef1234567890",
      title: "Come proteggere il focus nel lavoro ibrido",
      category: "produttivita",
      difficulty: "medium",
      tags: ["focus", "time blocking"],
      status: "published",
    });
    expect(article.content).toContain("Perche conta");
    expect(article.content).toContain("Tre segnali pratici");
  });

  it("maps discovery categories to the fixed growth library taxonomy", () => {
    expect(normalizeGrowthCategory("finance_advice", [])).toBe("finanza");
    expect(normalizeGrowthCategory("career_guide", [])).toBe("carriera");
    expect(normalizeGrowthCategory("unknown", ["sleep", "stress"])).toBe("salute");
    expect(normalizeGrowthCategory("unknown", [])).toBe("mindset");
  });

  it("detects recent category gaps below the publication floor", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");
    const gaps = analyzeGrowthLibraryGaps([
      { category: "mindset", createdAt: new Date("2026-05-20T12:00:00.000Z") },
      { category: "mindset", createdAt: new Date("2026-05-21T12:00:00.000Z") },
      { category: "carriera", createdAt: new Date("2026-05-22T12:00:00.000Z") },
      { category: "carriera", createdAt: new Date("2026-05-23T12:00:00.000Z") },
      { category: "carriera", createdAt: new Date("2026-05-24T12:00:00.000Z") },
      { category: "finanza", createdAt: new Date("2026-04-01T12:00:00.000Z") },
    ], now);

    expect(gaps).toEqual(expect.arrayContaining([
      { category: "mindset", recentCount: 2, suggestedTopic: expect.any(String) },
      { category: "finanza", recentCount: 0, suggestedTopic: expect.any(String) },
    ]));
    expect(gaps.some((gap) => gap.category === "carriera")).toBe(false);
  });
});
