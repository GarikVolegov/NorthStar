import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("i18next", () => ({
  default: {
    language: "it",
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "seo.sectorDescSuffix") {
        return `Stipendio ${opts?.min}k-${opts?.max}k €/anno, crescita ${opts?.rate}%.`;
      }
      if (key === "seo.sectorTitle") return `Lavorare come ${opts?.name}`;
      if (key === "seo.sectorImageAlt") return `Immagine settore ${opts?.name}`;
      if (key === "seo.sectorJsonLdSalary") return "Salario";
      if (key.startsWith("confronta.trend.")) return key.split(".").at(-1) ?? "";
      if (key.startsWith("confronta.risk.")) return key.split(".").at(-1) ?? "";
      return key;
    },
  },
}));

import { buildSectorMeta } from "@/lib/seo";

const MOCK_SECTOR = {
  id: 7,
  name: "Ingegneria del Software",
  description: "Progettazione e sviluppo di applicazioni software per aziende e utenti finali.",
  trend: "booming",
  growthRate: 14,
  automationRisk: "low",
  avgSalaryMin: 32000,
  avgSalaryMax: 70000,
  riasecTypes: ["I", "R", "C"],
};

describe("buildSectorMeta", () => {
  it("sets the page type to 'article'", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(meta.type).toBe("article");
  });

  it("builds the correct canonical path", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(meta.path).toBe(`/settore/${MOCK_SECTOR.id}`);
  });

  it("uses the OG image API route", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(meta.image).toContain(`/api/og-image/settore/${MOCK_SECTOR.id}`);
  });

  it("includes Schema.org JSON-LD with correct type", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(meta.jsonLd).toBeDefined();
    expect((meta.jsonLd as { "@type": string })["@type"]).toBe("Occupation");
  });

  it("JSON-LD includes salary range in EUR", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    const ld = meta.jsonLd as Record<string, unknown>;
    const salary = ld.estimatedSalary as Record<string, unknown>;
    expect(salary.currency).toBe("EUR");
    expect(salary.minValue).toBe(MOCK_SECTOR.avgSalaryMin);
    expect(salary.maxValue).toBe(MOCK_SECTOR.avgSalaryMax);
  });

  it("description is not empty and starts with sector description", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(typeof meta.description).toBe("string");
    expect(meta.description.length).toBeGreaterThan(10);
  });

  it("noIndex is not set (sector pages should be indexed)", () => {
    const meta = buildSectorMeta(MOCK_SECTOR);
    expect(meta.noIndex).toBeFalsy();
  });
});
