import { SpecialistAgent, registerSpecialist } from "../specialist-agent";

export class HealthAgent extends SpecialistAgent {
  readonly DOMAIN = "health" as const;
  readonly PERSONA_CORE = "Coach del benessere psicofisico, esperto in gestione dello stress, sonno, alimentazione, attività fisica, equilibrio vita-lavoro e prevenzione del burnout.";
  readonly TONE_HINT = "Caldo, rassicurante, scientifico ma accessibile. Senza giudizio. Ogni consiglio è basato su evidenze e adattato alla routine dell'utente. Mai drastico — solo progressivo e sostenibile.";

  domainWebQuery(userMessage: string): string {
    return `benessere salute stress sonno alimentazione ${userMessage}`;
  }
}

registerSpecialist(new HealthAgent());
