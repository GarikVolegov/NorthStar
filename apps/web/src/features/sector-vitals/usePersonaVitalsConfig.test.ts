import { describe, expect, it } from "vitest";
import { getPersonaVitalsConfig } from "./usePersonaVitalsConfig";

describe("getPersonaVitalsConfig", () => {
  it("shows only Pulse and Oxygen for undecided users", () => {
    expect(getPersonaVitalsConfig("unknown", "indeciso")).toEqual({
      visible: ["pulse", "oxygen"],
      emphasized: ["pulse"],
      tone: "plain",
    });
  });

  it("emphasizes Pulse and Pressure for autonomous users", () => {
    expect(getPersonaVitalsConfig("autonomo", null).emphasized).toEqual(["pulse", "pressure"]);
  });
});
