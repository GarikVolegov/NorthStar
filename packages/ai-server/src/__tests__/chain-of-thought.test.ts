import { describe, expect, it } from "vitest";
import { buildCoTSection } from "../growth-agent/chain-of-thought";

describe("buildCoTSection", () => {
  it("omits low confidence reasoning", () => {
    expect(buildCoTSection({
      limitingPattern: "vago",
      controllableActions: [],
      blindSpot: "nessuno",
      confidence: 0.2,
    })).toBe("");
  });

  it("serializes high confidence reasoning", () => {
    const section = buildCoTSection({
      limitingPattern: "evitamento",
      controllableActions: ["scrivi una prossima azione"],
      blindSpot: "sta confondendo urgenza e importanza",
      confidence: 0.9,
    });

    expect(section).toContain("evitamento");
    expect(section).toContain("scrivi una prossima azione");
  });
});
