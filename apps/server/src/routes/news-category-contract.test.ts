import { describe, expect, it } from "vitest";
import { mapNewsCategoryForUi, resolveNewsCategoryFilter } from "../lib/news-category";

describe("news category contract", () => {
  it("maps UI category filters to the stored news categories and sectors", () => {
    expect(resolveNewsCategoryFilter("general")).toBeNull();
    expect(resolveNewsCategoryFilter("technology")).toEqual(expect.objectContaining({
      categories: expect.arrayContaining(["tech_news", "ai_lavoro"]),
      sectors: expect.arrayContaining(["Tecnologia & Software", "AI & Automazione"]),
    }));
    expect(resolveNewsCategoryFilter("business")).toEqual(expect.objectContaining({
      categories: expect.arrayContaining(["economia"]),
      sectors: expect.arrayContaining(["Mercato del Lavoro"]),
    }));
    expect(resolveNewsCategoryFilter("education")).toEqual(expect.objectContaining({
      sectors: expect.arrayContaining(["Educazione & Formazione"]),
    }));
  });

  it("normalizes stored categories back to UI category ids", () => {
    expect(mapNewsCategoryForUi("tech_news", ["Tecnologia & Software"])).toBe("technology");
    expect(mapNewsCategoryForUi("economia", ["Mercato del Lavoro"])).toBe("business");
    expect(mapNewsCategoryForUi("finanza", ["Finanza & Fintech"])).toBe("finance");
    expect(mapNewsCategoryForUi("sanita_lavoro", ["Sanita & Life Sciences"])).toBe("health");
    expect(mapNewsCategoryForUi("unknown", [])).toBe("general");
  });
});
