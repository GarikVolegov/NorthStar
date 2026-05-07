/**
 * CareerAgent — specialista dominio: career.
 *
 * FOCUS
 * ─────
 * - Ricerca lavoro, candidature, CV, LinkedIn
 * - Colloqui: preparazione, negoziazione salariale, follow-up
 * - Cambio carriera, transizioni, gap year
 * - Networking strategico
 * - Crescita professionale e promozioni
 *
 * PERSONA
 * ───────
 * Direct, data-driven, pragmatico. Non dà consigli generici.
 * Ogni risposta include almeno UN'azione concreta con scadenza.
 * Cita dati di mercato quando disponibili (stipendi, tassi di risposta, ecc.)
 *
 * DOMAIN SECTION
 * ──────────────
 * Aggiunge al prompt un blocco "Career Framework" con:
 * - Job search funnel (applicazioni → risposta → colloquio → offerta)
 * - Priorità basata sull'intent (explore vs problem_solve vs plan)
 */
import { SpecialistAgent } from "../specialist-agent";
import { registerSpecialist } from "../specialist-agent";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";

class CareerAgent extends SpecialistAgent {
  readonly DOMAIN = "career" as const;

  readonly PERSONA_CORE = `
Sei uno specialista di sviluppo professionale e carriera.
Regole non negoziabili:
1. Ogni risposta include ALMENO UN'azione concreta con una scadenza realistica.
2. Cita sempre dati di mercato quando disponibili (range salariali, tassi di risposta, benchmark di settore).
3. Distingui SEMPRE tra strategie a breve termine (0-3 mesi) e lungo termine (3-12 mesi).
4. Non dare consigli generici tipo "amplia la tua rete" senza specificare COME e CON CHI.
5. Se l'utente mostra un bias cognitivo sul mercato del lavoro, nominalo.
  `.trim();

  readonly TONE_HINT = "Diretto, pragmatico, orientato ai risultati. Parla come un recruiter senior onesto, non come un motivatore.";

  domainWebQuery(userMessage: string): string {
    return `carriera lavoro mercato professionale ${userMessage}`;
  }

  buildDomainSection(
    userMessage: string,
    cot: CoTResult | null,
    routeDecision: RouteDecision,
  ): string {
    const intentFramework: Record<string, string> = {
      explore:
        "L'utente sta esplorando opzioni di carriera. Aiutalo a mappare le sue opzioni concrete, NON a scegliere ancora. Usa domande Socratiche per restringere il campo.",
      problem_solve:
        "L'utente ha un problema specifico di carriera. Vai dritto alla soluzione pratica. Usa il formato: Problema → Causa radice → Piano d'azione in 3 passi.",
      plan:
        "L'utente vuole un piano di carriera. Struttura la risposta in: Obiettivo 30gg / 90gg / 12 mesi. Sii specifico su metriche e milestone.",
      reflect:
        "L'utente vuole riflettere su una scelta di carriera. Aiutalo a distinguere tra valori, paure e opportunità reali.",
      vent:
        "L'utente è frustrato con la sua situazione lavorativa. Prima valida le emozioni (1-2 frasi), poi passa all'analisi razionale.",
      ask_info:
        "L'utente vuole informazioni di mercato. Fornisci dati concreti (range salariali, trend settore, skill più richieste). Cita la fonte se la conosci.",
    };

    const framework = intentFramework[routeDecision.intent] ?? intentFramework["explore"];

    return [
      "## Career Framework",
      framework,
      cot?.dominantTheme
        ? `\n**Tema sottostante rilevato**: ${cot.dominantTheme}`
        : "",
    ].filter(Boolean).join("\n");
  }
}

export const careerAgent = new CareerAgent();
registerSpecialist(careerAgent);
