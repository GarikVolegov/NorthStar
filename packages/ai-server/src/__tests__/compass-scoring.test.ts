import { describe, expect, it } from "vitest";
import {
  recencyDecay,
  weightedRiasec,
  blendRiasec,
  clusterFit,
  deriveHypotheses,
  nextStage,
  directionConfidence,
  type ScoringSignal,
  type CandidateCluster,
} from "../compass/scoring";
import type { CompassHypothesis } from "@workspace/db";

const NOW = new Date("2026-06-01T12:00:00Z");
function sig(dims: Record<string, number>, ageDays = 0, weight = 1): ScoringSignal {
  return { weight, dims, createdAt: new Date(NOW.getTime() - ageDays * 86_400_000) };
}

describe("recencyDecay", () => {
  it("è 1 a età 0 e 0.5 a una emivita", () => {
    expect(recencyDecay(NOW, NOW)).toBeCloseTo(1, 5);
    expect(recencyDecay(new Date(NOW.getTime() - 30 * 86_400_000), NOW, 30)).toBeCloseTo(0.5, 5);
  });
});

describe("weightedRiasec", () => {
  it("fa emergere la dimensione dominante dai segnali", () => {
    const rv = weightedRiasec([sig({ I: 5 }), sig({ I: 5 }), sig({ R: 1 })], NOW);
    expect(rv.I).toBeGreaterThan(rv.R);
    expect(rv.I).toBeCloseTo(5, 5);
  });
  it("ignora segnali senza dims e ritorna 0 per dimensioni mai viste", () => {
    const rv = weightedRiasec([{ weight: 1, createdAt: NOW, dims: null }], NOW);
    expect(rv.A).toBe(0);
  });
  it("pesa meno i segnali vecchi", () => {
    const recent = weightedRiasec([sig({ E: 5 }, 0)], NOW).E;
    const old = weightedRiasec([sig({ E: 5 }, 365)], NOW).E;
    // la media per-dimensione resta 5 in entrambi (un solo segnale), ma il peso
    // conta quando si combinano dims diverse:
    const mix = weightedRiasec([sig({ E: 5 }, 365), sig({ S: 5 }, 0)], NOW);
    expect(mix.S).toBeGreaterThan(0);
    expect(recent).toBeCloseTo(old, 5);
  });
});

describe("blendRiasec", () => {
  const declared = { R: 0, I: 1, A: 0, S: 0, E: 0, C: 0 };
  const revealed = { R: 0, I: 5, A: 0, S: 0, E: 0, C: 0 };
  it("con 0 segnali = solo dichiarato", () => {
    expect(blendRiasec(declared, revealed, 0).I).toBeCloseTo(1, 5);
  });
  it("con ≥50 segnali = 70% comportamento", () => {
    expect(blendRiasec(declared, revealed, 50).I).toBeCloseTo(1 * 0.3 + 5 * 0.7, 5);
  });
});

describe("clusterFit", () => {
  it("alto quando il RIASEC del cluster combacia col vettore", () => {
    const blended = { R: 0, I: 5, A: 4, S: 0, E: 0, C: 0 };
    expect(clusterFit(blended, ["I", "A"])).toBeCloseTo(0.9, 5);
    expect(clusterFit(blended, ["S"])).toBeCloseTo(0, 5);
  });
});

describe("deriveHypotheses", () => {
  const blended = { R: 1, I: 5, A: 3, S: 0, E: 0, C: 0 };
  const candidates: CandidateCluster[] = [
    { clusterId: "profession:1", label: "Data Scientist", riasec: ["I"], source: "specchio" },
    { clusterId: "profession:2", label: "Social Worker", riasec: ["S"], source: "test" },
    { clusterId: "profession:3", label: "UX Designer", riasec: ["A", "I"], source: "try_a_day" },
  ];
  it("ranka per fit e calcola confidence 0..1", () => {
    const hyp = deriveHypotheses(blended, candidates);
    expect(hyp[0]!.clusterId).toBe("profession:1"); // I=5 → fit 1
    expect(hyp[0]!.confidence).toBeGreaterThan(hyp[2]!.confidence);
    expect(hyp.every((h) => h.confidence >= 0 && h.confidence <= 1)).toBe(true);
  });
  it("preserva verdict/source di ipotesi pre-esistenti e spinge le scartate in coda", () => {
    const prev: CompassHypothesis[] = [
      { clusterId: "profession:1", label: "Data Scientist", confidence: 1, source: ["torneo"], testedAt: "2026-05-01", verdict: "discarded" },
    ];
    const hyp = deriveHypotheses(blended, candidates, prev);
    const ds = hyp.find((h) => h.clusterId === "profession:1")!;
    expect(ds.verdict).toBe("discarded");
    expect(ds.source).toContain("torneo");       // merge sorgenti
    expect(ds.source).toContain("specchio");
    expect(hyp[hyp.length - 1]!.clusterId).toBe("profession:1"); // in coda
  });
});

describe("nextStage", () => {
  const strong: CompassHypothesis[] = [{ clusterId: "p:1", label: "X", confidence: 0.7, source: [], verdict: "open" }];
  const weak: CompassHypothesis[] = [{ clusterId: "p:1", label: "X", confidence: 0.3, source: [], verdict: "open" }];
  it("zero_ideas → hypotheses con ≥1 ipotesi forte", () => {
    expect(nextStage("zero_ideas", strong)).toBe("hypotheses");
    expect(nextStage("zero_ideas", weak)).toBe("zero_ideas");
  });
  it("non regredisce da experimenting/committed", () => {
    expect(nextStage("experimenting", weak)).toBe("experimenting");
    expect(nextStage("committed", [])).toBe("committed");
  });
  it("una ipotesi forte ma scartata non basta", () => {
    const discarded: CompassHypothesis[] = [{ clusterId: "p:1", label: "X", confidence: 0.9, source: [], verdict: "discarded" }];
    expect(nextStage("zero_ideas", discarded)).toBe("zero_ideas");
  });
});

describe("directionConfidence", () => {
  it("= migliore ipotesi non scartata", () => {
    const hyp: CompassHypothesis[] = [
      { clusterId: "p:1", label: "A", confidence: 0.9, source: [], verdict: "discarded" },
      { clusterId: "p:2", label: "B", confidence: 0.5, source: [], verdict: "open" },
    ];
    expect(directionConfidence(hyp)).toBe(0.5);
    expect(directionConfidence([])).toBe(0);
  });
});
