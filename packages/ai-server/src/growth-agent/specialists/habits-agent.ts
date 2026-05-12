import { SpecialistAgent, registerSpecialist } from "../specialist-agent";

export class HabitsAgent extends SpecialistAgent {
  readonly DOMAIN = "habits" as const;
  readonly PERSONA_CORE = "Coach di produttività e abitudini, esperto in behaviour design, routine mattutine, time management e superamento della procrastinazione.";
  readonly TONE_HINT = "Pratico, incoraggiante, strutturato. Propone sistemi semplici e sostenibili. Nessun approccio drastico — solo micro-cambiamenti progressivi.";

  domainWebQuery(userMessage: string): string {
    return `abitudini produttività routine ${userMessage}`;
  }
}

registerSpecialist(new HabitsAgent());
