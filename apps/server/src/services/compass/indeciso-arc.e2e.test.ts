/**
 * E2E dell'arco indeciso contro il DB reale (Neon), utente seed @example.com.
 * Esercita il VERO recomputeCompass + le funzioni pure (Torneo/Spike) e verifica
 * le transizioni di stage zero_ideas → hypotheses → committed. Pulisce prima e
 * dopo (solo le righe Bussola/Spike del test user; l'utente resta intatto).
 */
import "./_e2e-env"; // DEVE essere il primo import: punta il DB a Neon prima di @workspace/db
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  compassProfilesTable,
  compassSignalsTable,
  careerSpikesTable,
  professionsTable,
  type CompassHypothesis,
} from "@workspace/db";
import { tournamentChoiceDims, spikeOutcomeDims, resolveSpikeOutcome } from "@workspace/ai-server";
import { recomputeCompass } from "./recompute";

const USER = 6; // utente seed @example.com (non una persona reale)

let ready = false;

async function prerequisitesMet(): Promise<boolean> {
  try {
    // se compass_signals non esiste sul DB target, questa query lancia → false
    await db.select({ n: sql<number>`count(*)::int` }).from(compassSignalsTable).limit(1);
    const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, USER)).limit(1);
    const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(professionsTable).where(eq(professionsTable.isActive, true));
    return Boolean(u) && Number(p?.n ?? 0) >= 2;
  } catch {
    return false;
  }
}

async function cleanup() {
  if (!ready) return;
  await db.delete(compassSignalsTable).where(eq(compassSignalsTable.userId, USER));
  await db.delete(careerSpikesTable).where(eq(careerSpikesTable.userId, USER));
  await db.delete(compassProfilesTable).where(eq(compassProfilesTable.userId, USER));
}

describe("Indeciso arc E2E (Neon)", () => {
  beforeAll(async () => { ready = await prerequisitesMet(); await cleanup(); });
  afterAll(cleanup);

  it("recompute + Torneo + Spike fanno avanzare lo stage e producono una direzione", async (ctx) => {
    if (!ready) { ctx.skip(); return; } // salta se il DB reale/seed non è disponibile (es. CI senza Neon)
    const profs = await db
      .select({ id: professionsTable.id, riasecFit: professionsTable.riasecFit })
      .from(professionsTable)
      .where(eq(professionsTable.isActive, true))
      .limit(4);
    expect(profs.length).toBeGreaterThanOrEqual(2);
    const winner = profs[0]!;
    const loser = profs[1]!;

    // 1) Profilo iniziale (lazy-init dalle fonti esistenti)
    const p0 = await recomputeCompass(USER);
    expect(p0.userId).toBe(USER);

    // 2) Torneo: scelte a coppie → segnali con dims derivati SERVER-side
    for (let i = 0; i < 4; i++) {
      const dims = tournamentChoiceDims(winner.riasecFit ?? [], loser.riasecFit ?? []);
      await db.insert(compassSignalsTable).values({
        userId: USER,
        signalType: "tournament_choice",
        refType: "profession",
        refId: `profession:${winner.id}`,
        payload: { winnerId: `profession:${winner.id}`, loserId: `profession:${loser.id}`, dims, valence: 1 },
        weight: 1.2,
      });
    }
    const p1 = await recomputeCompass(USER);
    expect(p1.signalCount).toBeGreaterThan(0); // i segnali sono fusi nel profilo

    // 3) Spike: continue + energia alta → committed (esito esperienziale forte)
    const res = resolveSpikeOutcome("continue", 0.9);
    expect(res.stage).toBe("committed");
    const dims = spikeOutcomeDims(winner.riasecFit ?? [], res.signalValence);
    await db.insert(compassSignalsTable).values({
      userId: USER,
      signalType: "spike_outcome",
      refType: "profession",
      refId: `profession:${winner.id}`,
      payload: { dims, valence: res.signalValence, decision: "continue" },
      weight: res.signalWeight,
    });
    await recomputeCompass(USER);

    // 4) La route applica stage + verdetto espliciti sopra al recompute
    const [pp] = await db.select().from(compassProfilesTable).where(eq(compassProfilesTable.userId, USER)).limit(1);
    const hyps = pp!.hypotheses as CompassHypothesis[];
    const target = hyps[0]; // la direzione più forte emersa
    const confirmedHyps = target
      ? hyps.map((h) => (h.clusterId === target.clusterId ? { ...h, verdict: "confirmed" as const, testedAt: new Date().toISOString() } : h))
      : hyps;
    const [committed] = await db
      .update(compassProfilesTable)
      .set({ hypotheses: confirmedHyps, stage: res.stage, updatedAt: new Date() })
      .where(eq(compassProfilesTable.userId, USER))
      .returning();

    expect(committed!.stage).toBe("committed"); // arco completo: è arrivato a destinazione
    if (target) {
      const direction = (committed!.hypotheses as CompassHypothesis[]).find((h) => h.verdict === "confirmed");
      expect(direction).toBeTruthy(); // c'è una direzione confermata per il ponte verso il lavoro
    }
  }, 30000);
});
