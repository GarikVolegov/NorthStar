import { describe, expect, it } from "vitest";
import {
  buildTryADayScenes,
  computeTryADayDebrief,
  pickTryADaySuggestions,
} from "../try-a-day";

const profession = {
  id: 7,
  title: "Data Analyst",
  sector: "Tecnologia",
  description: "Trasforma dati grezzi in decisioni leggibili per team business.",
  skills: ["SQL", "Storytelling", "Dashboard"],
  riasecFit: ["I", "C"],
  workModes: ["ibrido", "team"],
  salaryRange: "32-45k",
  growthOutlook: "alta",
  autonomyScore: 6,
  stabilityScore: 7,
};

describe("try-a-day generator", () => {
  it("builds a stable three-scene day with sequential time blocks", () => {
    const scenes = buildTryADayScenes(profession);

    expect(scenes.map((scene) => scene.timeBlock)).toEqual(["morning", "afternoon", "evening"]);
    expect(scenes[0]).toMatchObject({
      title: expect.stringContaining("Data Analyst"),
      interaction: { type: "choice" },
    });
    expect(scenes[1]?.interaction.type).toBe("priority_order");
    expect(scenes[2]?.interaction.type).toBe("comfort_slider");
    expect(scenes.every((scene) => scene.signals.skills.length > 0)).toBe(true);
  });

  it("computes deterministic debrief scores from responses", () => {
    const scenes = buildTryADayScenes(profession);
    const debrief = computeTryADayDebrief(scenes, {
      morning: { choiceId: "investigate", emotion: 5 },
      afternoon: { orderedIds: ["customer", "quality", "speed"], emotion: 4 },
      evening: { comfort: 80, emotion: 3 },
    });

    expect(debrief.radar.energy).toBeGreaterThan(70);
    expect(debrief.radar.interest).toBeGreaterThan(60);
    expect(debrief.radar.perceivedCompetence).toBeGreaterThan(60);
    expect(debrief.radar.valuesAlignment).toBeGreaterThan(50);
    expect(debrief.summary).toContain("Data Analyst");
  });

  it("selects similar and opposite roles from skill and RIASEC overlap", () => {
    const suggestions = pickTryADaySuggestions(profession, [
      { ...profession, id: 8, title: "Business Analyst", skills: ["SQL", "Storytelling"], riasecFit: ["I", "E"], workModes: ["team"] },
      { ...profession, id: 9, title: "Artigiano digitale", skills: ["Manualita"], riasecFit: ["R"], workModes: ["solo"] },
      { ...profession, id: 10, title: "Controller", skills: ["Excel"], riasecFit: ["C"], workModes: ["ibrido"] },
    ]);

    expect(suggestions.similar?.title).toBe("Business Analyst");
    expect(suggestions.opposite?.title).toBe("Artigiano digitale");
  });
});
