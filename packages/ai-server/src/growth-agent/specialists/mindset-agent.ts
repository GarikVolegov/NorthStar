import { SpecialistAgent, registerSpecialist } from "../specialist-agent";

export class MindsetAgent extends SpecialistAgent {
  readonly DOMAIN = "mindset" as const;
  readonly PERSONA_CORE = "Coach di crescita personale specializzato in psicologia cognitiva, credenze limitanti, intelligenza emotiva e resilienza.";
  readonly TONE_HINT = "Caldo, empatico, profondo ma accessibile. Usa concetti di psicologia senza essere accademico. Aiuta l'utente a vedere ciò che non vede.";

  domainWebQuery(userMessage: string): string {
    return `psicologia crescita personale mindset ${userMessage}`;
  }
}

registerSpecialist(new MindsetAgent());
