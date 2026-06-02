import { describe, expect, it } from "vitest";
import {
  buildDiscoveryMetadata,
  type DiscoverableContent,
  type DiscoveryItemType,
  type DiscoveryReason,
} from "./content-discovery";

describe("content discovery metadata", () => {
  it("builds public generic metadata with match score, reasons, and default cap", () => {
    const content: DiscoverableContent = {
      title: "Focus profondo",
      description: "Guida pratica alla concentrazione",
      type: "article",
      source: "index",
      scoreLexical: 0.7,
      scoreSemantic: 0.84,
      metadata: {
        category: "produttivita",
        tags: ["focus", "energia"],
      },
    };

    const meta = buildDiscoveryMetadata(content);

    expect(meta).toMatchObject({
      matchScore: 0.84,
      personalization: "generic",
      source: "index",
      sourceLabel: "Indice NorthStar",
      actionLabel: "Leggi",
    });
    expect(meta.reasons).toHaveLength(3);
    expect(meta.reasons).toEqual<DiscoveryReason[]>([
      { code: "lexical", label: "Match nel titolo o contenuto", source: "content" },
      { code: "semantic", label: "Match semantico", source: "content" },
      { code: "category:produttivita", label: "Categoria: produttivita", source: "content" },
    ]);
  });

  it("marks personality matches as profile personalization and trims values", () => {
    const meta = buildDiscoveryMetadata({
      title: "Metodo investigativo",
      type: "idea",
      source: "library",
      scoreLexical: 0,
      scoreSemantic: null,
      metadata: {
        tags: [" focus "],
        personalityMatches: [" Investigativo "],
      },
    });

    expect(meta.personalization).toBe("profile");
    expect(meta.reasons).toEqual(
      expect.arrayContaining([
        { code: "personality:Investigativo", label: "Profilo: Investigativo", source: "profile" },
        { code: "tag:focus", label: "Tema: focus", source: "content" },
      ]),
    );
    expect(meta.matchedKeywords).toEqual(expect.arrayContaining(["Investigativo", "focus"]));
  });

  it("marks sector and role profile-derived matches as profile personalization", () => {
    const meta = buildDiscoveryMetadata({
      title: "Architettura cloud",
      type: "role",
      source: "live",
      scoreLexical: 0,
      scoreSemantic: null,
      metadata: {
        sectorMatches: ["Cloud"],
        roleLinks: ["Backend Engineer"],
      },
    });

    expect(meta.personalization).toBe("profile");
    expect(meta.reasons).toEqual(
      expect.arrayContaining([
        { code: "sector:Cloud", label: "Settore: Cloud", source: "profile" },
        { code: "role:Backend Engineer", label: "Ruolo: Backend Engineer", source: "profile" },
      ]),
    );
  });

  it("does not expose raw private metadata values in labels or signals", () => {
    const meta = buildDiscoveryMetadata(
      {
        title: "Obiettivo personale",
        type: "objective",
        source: "live",
        visibility: "private",
        scoreLexical: 0.65,
        scoreSemantic: null,
        metadata: {
          category: "carriera-segreta",
          tags: ["riservato"],
          personalityMatches: ["Investigativo"],
          sectorLinks: ["Finanza"],
        },
      },
      { isPrivateProfileData: true },
    );

    expect(meta).toMatchObject({
      personalization: "private",
      sourceLabel: "Contenuti personali",
    });
    expect(meta.reasons).toEqual(
      expect.arrayContaining([
        { code: "private-profile", label: "Dati del tuo profilo", source: "profile" },
      ]),
    );
    const joinedLabels = meta.reasonLabels.join(" ");
    const joinedSignals = meta.matchSignals.join(" ");
    expect(joinedLabels).not.toContain("carriera-segreta");
    expect(joinedLabels).not.toContain("riservato");
    expect(joinedLabels).not.toContain("Investigativo");
    expect(joinedLabels).not.toContain("Finanza");
    expect(joinedSignals).not.toContain("carriera-segreta");
    expect(joinedSignals).not.toContain("riservato");
    expect(joinedSignals).not.toContain("Investigativo");
    expect(joinedSignals).not.toContain("Finanza");
  });

  it("honors maxReasons overrides", () => {
    const meta = buildDiscoveryMetadata(
      {
        title: "Focus profondo",
        type: "article",
        source: "index",
        scoreLexical: 1,
        scoreSemantic: 0.9,
        metadata: {
          category: "produttivita",
          tags: ["focus"],
          personalityMatches: ["Investigativo"],
        },
      },
      { maxReasons: 5 },
    );

    expect(meta.reasons).toHaveLength(5);
    expect(meta.reasonLabels).toHaveLength(5);
    expect(meta.reasons.map((reason) => reason.label)).toEqual(
      expect.arrayContaining([
        "Match nel titolo o contenuto",
        "Match semantico",
        "Categoria: produttivita",
        "Profilo: Investigativo",
        "Tema: focus",
      ]),
    );
  });

  it("clamps explicit and derived match scores to the 0..1 range", () => {
    expect(
      buildDiscoveryMetadata({
        title: "High score",
        type: "article",
        source: "index",
        matchScore: 1.7,
        scoreLexical: 0,
        scoreSemantic: null,
      }).matchScore,
    ).toBe(1);

    expect(
      buildDiscoveryMetadata({
        title: "Low score",
        type: "article",
        source: "index",
        score: -0.2,
        scoreLexical: 0,
        scoreSemantic: null,
      }).matchScore,
    ).toBe(0);

    expect(
      buildDiscoveryMetadata({
        title: "Derived high score",
        type: "article",
        source: "index",
        scoreLexical: -0.4,
        scoreSemantic: 2.4,
      }).matchScore,
    ).toBe(1);
  });

  it("supports global-search total score aliases", () => {
    expect(
      buildDiscoveryMetadata({
        title: "Total score",
        type: "news",
        source: "live",
        scoreTotal: 1.4,
        scoreLexical: 0,
        scoreSemantic: null,
      }).matchScore,
    ).toBe(1);

    expect(
      buildDiscoveryMetadata({
        title: "Snake total score",
        type: "news",
        source: "live",
        score_total: 0.42,
        scoreLexical: 0,
        scoreSemantic: null,
      }).matchScore,
    ).toBe(0.42);
  });

  it("includes source and type reasons for public content when maxReasons allows", () => {
    const meta = buildDiscoveryMetadata(
      {
        title: "Focus profondo",
        type: "article",
        source: "index",
        scoreLexical: 1,
        scoreSemantic: 0.9,
        metadata: {
          category: "produttivita",
          tags: ["focus"],
        },
      },
      { maxReasons: 6 },
    );

    expect(meta.reasons).toEqual(
      expect.arrayContaining([
        { code: "source:index", label: "Fonte: Indice NorthStar", source: "content" },
        { code: "type:article", label: "Tipo: Biblioteca crescita", source: "content" },
      ]),
    );
  });

  it("keeps Task 2 compatibility labels usable", () => {
    const meta = buildDiscoveryMetadata({
      title: "Notizia NorthStar",
      type: "news",
      source: "live",
      scoreLexical: 0,
      scoreSemantic: null,
      metadata: {},
    });

    expect(meta.sourceLabel.length).toBeGreaterThan(0);
    expect(meta.reasonLabels.length).toBeGreaterThan(0);
    expect(meta.matchSignals.length).toBeGreaterThan(0);
    expect(meta.actionLabel).toBe("Leggi");
  });

  it("returns stable labels for every supported type", () => {
    const types: DiscoveryItemType[] = [
      "sector",
      "role",
      "article",
      "news",
      "idea",
      "objective",
      "calendar",
      "certification",
      "memory",
      "workspace",
      "profile",
    ];

    for (const type of types) {
      const meta = buildDiscoveryMetadata({
        title: type,
        type,
        source: "live",
        scoreLexical: 0,
        scoreSemantic: null,
        metadata: {},
      });

      expect(meta.sourceLabel.length).toBeGreaterThan(0);
      expect(meta.reasonLabels.length).toBeGreaterThan(0);
      expect(meta.actionLabel.length).toBeGreaterThan(0);
    }
  });
});
