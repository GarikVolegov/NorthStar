/**
 * tool-handlers-compass.ts — tool Wendy "modalità indeciso" (read-only).
 *
 * get_compass:               legge la Bussola direzionale dell'utente.
 * propose_next_compass_step: suggerisce il prossimo passo in base allo stage,
 *                            SENZA dare verdetti.
 *
 * SECURITY: userId iniettato server-side; ogni query è WHERE user_id = userId.
 */
import { eq } from "drizzle-orm";
import { db, compassProfilesTable, type CompassHypothesis } from "@workspace/db";
import { err, type ToolResult } from "./tool-handlers";

export async function handleGetCompass(_args: unknown, userId: number): Promise<ToolResult> {
  try {
    const [p] = await db
      .select()
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);

    if (!p) {
      return { ok: true, data: { stage: "zero_ideas", blockType: "unknown", topHypotheses: [], note: "Bussola non ancora inizializzata: l'utente non ha generato segnali." } };
    }

    const open = (p.hypotheses as CompassHypothesis[]).filter((h) => h.verdict !== "discarded");
    const energizers = (p.energyProfile as { energizers?: string[] })?.energizers ?? [];

    return {
      ok: true,
      data: {
        stage: p.stage,
        blockType: p.blockType,
        directionConfidence: p.directionConfidence,
        signalCount: p.signalCount,
        topHypotheses: open.slice(0, 3).map((h) => ({ label: h.label, confidence: h.confidence })),
        energizers,
      },
    };
  } catch {
    return err("COMPASS_ERROR", "Non riesco a leggere la Bussola in questo momento");
  }
}

interface NextStep { action: string; route: string; why: string }

export async function handleProposeNextCompassStep(_args: unknown, userId: number): Promise<ToolResult> {
  try {
    const [p] = await db
      .select({
        stage: compassProfilesTable.stage,
        blockType: compassProfilesTable.blockType,
        hypotheses: compassProfilesTable.hypotheses,
      })
      .from(compassProfilesTable)
      .where(eq(compassProfilesTable.userId, userId))
      .limit(1);

    // Senza profilo o blocco da capire → parti dal diagnostico
    if (!p || p.blockType === "unknown") {
      return { ok: true, data: step({ action: "Capiamo cosa ti blocca", route: "/bussola/blocco", why: "Dare un nome all'indecisione è il primo passo per scioglierla." }) };
    }

    const open = (p.hypotheses as CompassHypothesis[]).filter((h) => h.verdict !== "discarded");

    let next: NextStep;
    switch (p.stage) {
      case "zero_ideas":
        next = p.blockType === "too_many_interests"
          ? { action: "Restringiamo con un confronto", route: "/bussola", why: "Hai tanti interessi: meglio procedere per sottrazione." }
          : { action: "Fai qualche swipe nello Specchio", route: "/bussola/specchio", why: "La direzione emerge da come reagisci, non da un quiz." };
        break;
      case "hypotheses":
        next = open[0]
          ? { action: `Prova una giornata da ${open[0].label}`, route: "/bussola", why: "Un'etichetta è vuota finché non senti com'è davvero la giornata." }
          : { action: "Continua con lo Specchio", route: "/bussola/specchio", why: "Servono ancora segnali perché una direzione emerga netta." };
        break;
      case "experimenting":
        next = { action: "Rivedi il tuo esperimento", route: "/bussola", why: "Lo spike è un test reversibile: cosa hai scoperto?" };
        break;
      default:
        next = { action: "Consolida la direzione", route: "/bussola", why: "Hai una direzione: trasformala in un piano concreto." };
    }
    return { ok: true, data: step(next) };
  } catch {
    return err("COMPASS_ERROR", "Non riesco a proporre un passo ora");
  }
}

function step(s: NextStep) {
  return { clientSide: false, nextStep: s, reminder: "Non dare un verdetto: rispecchia e invita al passo." };
}
