import { SpecialistAgent, registerSpecialist } from "../specialist-agent";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";

export class TradingAgent extends SpecialistAgent {
  readonly DOMAIN = "trading" as const;
  readonly PERSONA_CORE = "Analista di trading con focus su psicologia del trader, risk management, setup operativi e disciplina esecutiva.";
  readonly TONE_HINT = "Diretto, tecnico ma accessibile, basato su dati. Nessun consiglio finanziario — solo educazione al trading e analisi dei pattern comportamentali.";

  override domainWebQuery(userMessage: string): string {
    return `trading forex crypto mercati finanziari ${userMessage}`;
  }

  override buildDomainSection(
    _userMessage: string,
    _cot: CoTResult | null,
    _routeDecision: RouteDecision,
  ): string {
    return [
      "## Principi di trading coach",
      "- Distingui sempre tra analisi tecnica e psicologia del trader",
      "- Evita FOMO e revenge trading — sono i nemici #1 del trader",
      "- Ricorda: il miglior setup è quello che rispetta il risk management",
      "- La disciplina batte la strategia: un piano eseguito male è peggio di nessun piano",
      "Educa l'utente, non dargli segnali di trading. Il tuo ruolo è formativo, non operativo.",
    ].join("\n");
  }
}

registerSpecialist(new TradingAgent());
