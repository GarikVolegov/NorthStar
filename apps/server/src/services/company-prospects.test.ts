import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/ai-server", () => ({ searchWeb: vi.fn() }));
vi.mock("@workspace/db", () => ({
  db: {},
  professionsTable: { id: "professions.id", title: "professions.title", sectorId: "professions.sector_id" },
  sectorsTable: { id: "sectors.id", name: "sectors.name" },
  userProfileSettingsTable: { userId: "user_profile_settings.user_id", city: "user_profile_settings.city" },
}));

import {
  createWebCompanyProspectProvider,
  createCompanyProspectService,
  type CompanyProspectProvider,
  type CompanyProspectRepository,
} from "./company-prospects";
import { searchWeb } from "@workspace/ai-server";

const repository: CompanyProspectRepository = {
  async getProfession(id: number) {
    return id === 55 ? { id, title: "Product Designer", sectorId: 2, sectorName: "Design & UX" } : null;
  },
  async getUserCity(userId: number) {
    return userId === 42 ? "Milano" : null;
  },
};

describe("company prospect service", () => {
  beforeEach(() => {
    vi.mocked(searchWeb).mockReset();
    process.env[`TAVILY${"_API"}${"_KEY"}`] = "test-tavily-key";
  });

  it("uses profile city and returns source-linked company prospects", async () => {
    const provider: CompanyProspectProvider = {
      configured: true,
      search: vi.fn().mockResolvedValue([
        {
          name: "Studio Forma",
          location: "Milano",
          reason: "Ha pagine pubbliche su prodotti digitali e design.",
          evidence: "Studio Forma cerca profili design per prodotti digitali a Milano.",
          sourceUrl: "https://example.com/studio-forma-careers",
          sourceLabel: "example.com",
          confidence: "medium",
          suggestedSearchUrl:
            "https://www.google.com/search?q=Studio%20Forma%20Product%20Designer%20Milano%20lavora%20con%20noi",
        },
      ]),
    };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(provider.search).toHaveBeenCalledWith({
      roleTitle: "Product Designer",
      sectorName: "Design & UX",
      city: "Milano",
    });
    expect(result).toMatchObject({
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      basedOnCity: "Milano",
      status: "ok",
      companies: [{ name: "Studio Forma", sourceUrl: "https://example.com/studio-forma-careers" }],
    });
    expect(result.coverageNote).toContain("non e' un registro esaustivo");
  });

  it("returns city_required when neither query city nor profile city exists", async () => {
    const provider: CompanyProspectProvider = { configured: true, search: vi.fn() };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 7, professionId: 55 });

    expect(provider.search).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "city_required",
      basedOnCity: null,
      companies: [],
    });
  });

  it("returns not_configured when the provider is unavailable", async () => {
    const provider: CompanyProspectProvider = { configured: false, search: vi.fn() };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(provider.search).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "not_configured",
      basedOnCity: "Milano",
      companies: [],
    });
  });

  it("deduplicates companies by normalized name", async () => {
    const provider: CompanyProspectProvider = {
      configured: true,
      search: vi.fn().mockResolvedValue([
        {
          name: "Studio Forma",
          location: "Milano",
          reason: "Prima fonte.",
          evidence: "Prima evidenza.",
          sourceUrl: "https://example.com/a",
          sourceLabel: "example.com",
          confidence: "medium",
          suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma",
        },
        {
          name: "studio forma",
          location: "Milano",
          reason: "Seconda fonte.",
          evidence: "Seconda evidenza.",
          sourceUrl: "https://example.com/b",
          sourceLabel: "example.com",
          confidence: "low",
          suggestedSearchUrl: "https://www.google.com/search?q=studio%20forma",
        },
      ]),
    };
    const service = createCompanyProspectService({ repository, provider });

    const result = await service.search({ userId: 42, professionId: 55 });

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]?.name).toBe("Studio Forma");
  });

  it("drops web results with non-http source URLs", async () => {
    vi.mocked(searchWeb).mockResolvedValue([
      {
        id: -1,
        content: "Studio Forma careers cerca Product Designer a Milano.",
        source: "javascript:alert(1)",
        sourceType: "web",
        score: 0.9,
        metadata: { title: "Studio Forma Careers", url: "javascript:alert(1)" },
      },
      {
        id: -1,
        content: "Studio Forma careers cerca Product Designer a Milano.",
        source: "https://example.com/studio-forma-careers",
        sourceType: "web",
        score: 0.9,
        metadata: { title: "Studio Forma Careers", url: "https://example.com/studio-forma-careers" },
      },
    ]);

    const result = await createWebCompanyProspectProvider().search({
      roleTitle: "Product Designer",
      sectorName: "Design & UX",
      city: "Milano",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.sourceUrl).toBe("https://example.com/studio-forma-careers");
  });

  it("drops generic host and role-only results without clear company evidence", async () => {
    vi.mocked(searchWeb).mockResolvedValue([
      {
        id: -1,
        content: "Product Designer Milano offerte lavoro e annunci generici.",
        source: "https://linkedin.com/jobs/search?keywords=Product%20Designer",
        sourceType: "web",
        score: 0.8,
        metadata: { title: "Product Designer Milano", url: "https://linkedin.com/jobs/search?keywords=Product%20Designer" },
      },
      {
        id: -1,
        content: "Studio Forma lavora con noi Product Designer Milano team prodotto.",
        source: "https://studioforma.example/careers/product-designer",
        sourceType: "web",
        score: 0.9,
        metadata: { title: "Studio Forma - Careers", url: "https://studioforma.example/careers/product-designer" },
      },
    ]);

    const result = await createWebCompanyProspectProvider().search({
      roleTitle: "Product Designer",
      sectorName: "Design & UX",
      city: "Milano",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Studio Forma");
    expect(result[0]?.sourceLabel).toBe("studioforma.example");
  });

  it("keeps valid prospects when one web query rejects", async () => {
    vi.mocked(searchWeb)
      .mockRejectedValueOnce(new Error("search failed"))
      .mockResolvedValue([
        {
          id: -1,
          content: "Studio Forma careers cerca Product Designer a Milano.",
          source: "https://example.com/studio-forma-careers",
          sourceType: "web",
          score: 0.9,
          metadata: { title: "Studio Forma Careers", url: "https://example.com/studio-forma-careers" },
        },
      ]);

    const result = await createWebCompanyProspectProvider().search({
      roleTitle: "Product Designer",
      sectorName: "Design & UX",
      city: "Milano",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Studio Forma");
  });
});
