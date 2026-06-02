import { describe, expect, it } from "vitest";
import {
  buildDiscoveryMetadata,
  type DiscoveryItemType,
} from "./content-discovery";

describe("content discovery metadata", () => {
  it("labels indexed public growth articles with readable source and reasons", () => {
    const meta = buildDiscoveryMetadata({
      type: "article",
      source: "index",
      visibility: "public",
      scoreLexical: 1,
      scoreSemantic: 0.82,
      metadata: {
        tags: ["focus", "produttivita"],
        personalityMatches: ["Investigativo"],
      },
    });

    expect(meta).toMatchObject({
      source: "index",
      sourceLabel: "Indice NorthStar",
      personalization: "generic",
      actionLabel: "Leggi",
    });
    expect(meta.reasonLabels).toEqual(
      expect.arrayContaining([
        "Match nel titolo o contenuto",
        "Match semantico",
        "Tema: focus",
        "Profilo: Investigativo",
      ]),
    );
    expect(meta.matchSignals).toEqual(expect.arrayContaining(["lexical", "semantic", "tag:focus"]));
  });

  it("labels private live results as personal content", () => {
    const meta = buildDiscoveryMetadata({
      type: "objective",
      source: "live",
      visibility: "private",
      scoreLexical: 0.65,
      scoreSemantic: null,
      metadata: { category: "carriera" },
    });

    expect(meta).toMatchObject({
      sourceLabel: "Contenuti personali",
      personalization: "private",
      actionLabel: "Apri",
    });
    expect(meta.reasonLabels).toEqual(expect.arrayContaining(["Dati del tuo profilo"]));
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
        type,
        source: "live",
        visibility: "public",
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
