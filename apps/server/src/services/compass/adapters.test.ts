import { describe, expect, it } from "vitest";
import {
  signalsFromCompass,
  signalsFromSimulatedDays,
  signalsFromDiaryIndizi,
  candidatesFromProfessions,
  buildEnergyProfile,
} from "./adapters";

const T = new Date("2026-06-01T00:00:00Z");

describe("signalsFromCompass", () => {
  it("estrae dims dal payload, null se assenti", () => {
    const out = signalsFromCompass([
      { payload: { dims: { I: 4 } }, weight: 1, createdAt: T },
      { payload: { valence: 0.5 }, weight: 1, createdAt: T },
      { payload: null, weight: 2, createdAt: T },
    ]);
    expect(out[0]!.dims).toEqual({ I: 4 });
    expect(out[1]!.dims).toBeNull();
    expect(out[2]!).toMatchObject({ weight: 2, dims: null });
  });
});

describe("signalsFromSimulatedDays", () => {
  it("debrief alto → segnale forte sui RIASEC della professione", () => {
    const out = signalsFromSimulatedDays([
      { debriefJson: { radar: { energy: 86, interest: 90 } }, completedAt: T, riasecFit: ["I", "C"] },
    ]);
    expect(out).toHaveLength(1);
    // (86+90)/2 = 88 → /20 = 4.4
    expect(out[0]!.dims).toEqual({ I: 4.4, C: 4.4 });
    expect(out[0]!.weight).toBe(1.5);
  });
  it("ignora simulazioni non completate o senza radar", () => {
    expect(signalsFromSimulatedDays([
      { debriefJson: { radar: { energy: 80, interest: 80 } }, completedAt: null, riasecFit: ["I"] },
      { debriefJson: {}, completedAt: T, riasecFit: ["I"] },
    ])).toHaveLength(0);
  });
});

describe("signalsFromDiaryIndizi", () => {
  it("usa i dims del prompt_payload e pesa per energia", () => {
    const out = signalsFromDiaryIndizi([
      { promptPayload: { dims: { I: 5, C: 4 }, energia: 5 }, createdAt: T },
      { promptPayload: { contesto: "x" }, createdAt: T }, // niente dims → scartato
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.dims).toEqual({ I: 5, C: 4 });
    expect(out[0]!.weight).toBe(2); // 1 + 5/5
  });
});

describe("candidatesFromProfessions", () => {
  it("mappa professioni a cluster con clusterId profession:<id>", () => {
    const out = candidatesFromProfessions([{ id: 1, title: "Data Analyst", riasecFit: ["I", "C"] }]);
    expect(out[0]).toEqual({ clusterId: "profession:1", label: "Data Analyst", riasec: ["I", "C"], source: "catalog" });
  });
});

describe("buildEnergyProfile", () => {
  it("colleziona i contesti con energia ≥4, deduplicati", () => {
    const out = buildEnergyProfile([
      { promptPayload: { contesto: "analisi dati", energia: 5 } },
      { promptPayload: { contesto: "analisi dati", energia: 4 } },
      { promptPayload: { contesto: "riunioni", energia: 2 } },
    ]);
    expect(out.energizers).toEqual(["analisi dati"]);
  });
});
