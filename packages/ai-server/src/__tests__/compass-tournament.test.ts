import { describe, expect, it } from "vitest";
import {
  tournamentTarget,
  selectTournamentPool,
  rankByChoices,
  nextTournamentPair,
  tournamentChoiceDims,
  type TournamentChoice,
} from "../compass/tournament";
import type { CandidateCluster } from "../compass/scoring";

const cand = (id: number, label: string, riasec: string[]): CandidateCluster => ({
  clusterId: `profession:${id}`,
  label,
  riasec,
});

const POOL: CandidateCluster[] = [
  cand(1, "UX Designer", ["A", "I"]),
  cand(2, "Data Analyst", ["I", "C"]),
  cand(3, "Idraulico", ["R", "C"]),
  cand(4, "Insegnante", ["S", "A"]),
];

describe("compass/tournament — pure logic", () => {
  it("selectTournamentPool puts hypothesis clusters first, then fills deterministically", () => {
    const pool = selectTournamentPool(POOL, ["profession:3"], 3);
    expect(pool[0]!.clusterId).toBe("profession:3"); // ipotesi prima
    expect(pool).toHaveLength(3);
    // riempimento deterministico (ordine per clusterId): 1, poi 2
    expect(pool.slice(1).map((c) => c.clusterId)).toEqual(["profession:1", "profession:2"]);
    // candidati senza RIASEC sono esclusi dal riempimento
    expect(selectTournamentPool([...POOL, cand(9, "Vuoto", [])], [], 9).map((c) => c.clusterId))
      .not.toContain("profession:9");
  });

  it("rankByChoices reconstructs standings from the event stream", () => {
    const choices: TournamentChoice[] = [
      { winnerId: "profession:1", loserId: "profession:3" },
      { winnerId: "profession:1", loserId: "profession:2" },
      { winnerId: "profession:4", loserId: "profession:3" },
    ];
    const standings = rankByChoices(POOL, choices);
    expect(standings[0]!.clusterId).toBe("profession:1"); // 2 vittorie in cima
    expect(standings[0]!.wins).toBe(2);
    const idraulico = standings.find((s) => s.clusterId === "profession:3")!;
    expect(idraulico.losses).toBe(2);
    expect(idraulico.score).toBe(-2);
  });

  it("nextTournamentPair returns an unseen pair and stops at target", () => {
    const seen: TournamentChoice[] = [];
    const first = nextTournamentPair(POOL, seen)!;
    expect(first).toHaveLength(2);
    expect(first[0]!.clusterId).not.toBe(first[1]!.clusterId);

    // un confronto già visto non viene riproposto come identica coppia
    const recorded: TournamentChoice[] = [{ winnerId: first[0]!.clusterId, loserId: first[1]!.clusterId }];
    const second = nextTournamentPair(POOL, recorded);
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    expect(key(second![0]!.clusterId, second![1]!.clusterId))
      .not.toBe(key(first[0]!.clusterId, first[1]!.clusterId));

    // raggiunto il target → null
    const target = tournamentTarget(POOL.length);
    const many: TournamentChoice[] = Array.from({ length: target }, () => ({
      winnerId: "profession:1", loserId: "profession:2",
    }));
    expect(nextTournamentPair(POOL, many, target)).toBeNull();
  });

  it("nextTournamentPair returns null for a pool that is too small", () => {
    expect(nextTournamentPair([POOL[0]!], [])).toBeNull();
  });

  it("tournamentChoiceDims pushes toward the winner and away from the loser", () => {
    const dims = tournamentChoiceDims(["A", "I"], ["R", "C"]);
    expect(dims.A).toBeGreaterThan(0);
    expect(dims.I).toBeGreaterThan(0);
    expect(dims.R).toBeLessThan(0); // rifiuto registrato come avversione
    expect(dims.C).toBeLessThan(0);
    // lettera condivisa: spinta del vincitore meno avversione del perdente
    const overlap = tournamentChoiceDims(["I"], ["I"], { winnerValue: 4, loserAversion: 0.5 });
    expect(overlap.I).toBeCloseTo(4 - 4 * 0.5);
  });
});
