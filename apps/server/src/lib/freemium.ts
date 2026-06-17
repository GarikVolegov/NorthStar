/**
 * freemium.ts — quota mensile freemium condivisa dai tool AI.
 *
 * Centralizza il pattern duplicato in interview / skills-gap / cover-letter:
 * Pro/Team illimitati; per i free incrementa un contatore mensile su Redis e
 * segnala `gated=true` una volta superato `limit`.
 *
 * FAIL-OPEN: se Redis è giù (cacheIncr ritorna null) NON blocca mai — coerente
 * col limite giornaliero di Wendy.
 */
import { getEffectivePlan, planMeets } from "../middleware/check-feature";
import { cacheIncr } from "./redis";

const MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60; // copre il mese (chiave per YYYY-MM)

export interface FreemiumCheck {
  /** true se l'utente free ha superato il limite mensile → mostra l'upgrade. */
  gated: boolean;
  plan: "free" | "pro" | "team";
  /** usi consumati prima di questa richiesta (0 se Redis non disponibile). */
  used: number;
  limit: number;
}

/**
 * Controlla (e consuma) la quota mensile gratuita per un tool AI.
 * `feature` è il prefisso della chiave Redis (es. "interview" → `interview:month:<uid>:<YYYY-MM>`).
 */
export async function checkMonthlyFreemium(
  userId: number,
  feature: string,
  limit: number,
): Promise<FreemiumCheck> {
  const plan = await getEffectivePlan(userId);
  if (planMeets(plan, "pro")) return { gated: false, plan, used: 0, limit };

  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const used = await cacheIncr(`${feature}:month:${userId}:${month}`, MONTHLY_TTL_SECONDS);
  const gated = used !== null && used > limit;
  return { gated, plan, used: used !== null ? used - 1 : 0, limit };
}
