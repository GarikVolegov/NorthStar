import { describe, expect, it } from "vitest";
import { buildWendyUserProfileSection } from "./ai-wendy-context";

describe("buildWendyUserProfileSection", () => {
  it("injects the real profile so Wendy knows who the user is", () => {
    const section = buildWendyUserProfileSection(
      {
        journeyType: "indeciso",
        topObjectives: [
          { text: "Finire il portfolio", progress: 40 },
          { text: "Imparare SQL", progress: 10 },
        ],
        preferredSectors: [{ name: "Cybersecurity" }, { name: "Data" }],
        memoryFacts: [{ key: "background", value: "ex insegnante" }],
      },
      "it",
    );

    expect(section).toContain("indeciso");
    expect(section).toContain("Finire il portfolio");
    expect(section).toContain("40%");
    expect(section).toContain("Cybersecurity");
    expect(section).toContain("ex insegnante");
    // Must instruct the model not to invent.
    expect(section).toMatch(/non inventare/i);
  });

  it("localizes the profile section to English when requested", () => {
    const section = buildWendyUserProfileSection(
      { journeyType: "explorer", topObjectives: [{ text: "Ship MVP", progress: 20 }] },
      "en",
    );
    expect(section).toContain("Journey type: explorer");
    expect(section).toContain("Ship MVP");
    expect(section).toMatch(/do not invent/i);
  });

  it("is honest (not invented) when there is no profile data yet", () => {
    const it_ = buildWendyUserProfileSection({}, "it");
    expect(it_).toMatch(/non risultano ancora/i);
    expect(it_).toMatch(/non inventare/i);

    const en = buildWendyUserProfileSection({}, "en");
    expect(en).toMatch(/no saved profile/i);
  });
});
