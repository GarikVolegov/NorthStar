/**
 * Tone Adapter — maps the user's journeyType × userMode to a precise
 * tone profile that the coach applies in its response.
 *
 * WHY THIS MATTERS
 * ─────────────────
 * A user who selected "Indeciso" needs a completely different communication
 * style than one who selected "Investitore". Without this, the coach defaults
 * to a middle-ground tone that is too soft for advanced users and too direct
 * for fragile ones.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. ToneProfile is derived from journeyType (primary) + userMode (secondary)
 * 2. Each profile defines:
 *    - voice:      the overall communication register
 *    - pace:       how fast to move (explore slowly vs get to the point)
 *    - challenge:  how hard to push back on limiting patterns
 *    - vocabulary: words/phrases to use or avoid
 * 3. buildToneSection() serialises the profile into a prompt instruction
 *
 * JOURNEY TYPES (from the onboarding screen)
 *   indeciso    → "Non so ancora cosa fare"
 *   dipendente  → "Ho un lavoro e voglio crescere"
 *   autonomo    → "Lavoro in proprio e voglio scalare"
 *   azienda     → "Cerco il profilo giusto" (team building)
 *   investitore → "Valuto opportunità di mercato"
 */
import { buildWendyToneInheritanceNote } from "../wendy-voice";

export interface ToneProfile {
  journeyType: string;
  voice: string;
  pace: string;
  challenge: string;
  vocabulary: string;
}

const TONE_PROFILES: Record<string, ToneProfile> = {
  indeciso: {
    journeyType: "indeciso",
    voice:
      "Caldo ma non condiscendente. Parli come un amico intelligente che ha già attraversato l'incertezza — non come un guru. Validi prima di sfidare.",
    pace:
      "Lento e esplorativo. Non avere fretta di arrivare alla soluzione. L'obiettivo di questa conversazione è la chiarezza, non l'azione immediata.",
    challenge:
      "Basso. Usa domande aperte per far emergere cosa l'utente già sente. Non mettere pressione. Il cambiamento avviene quando l'utente si sente visto.",
    vocabulary:
      "Usa: 'mi sembra che...', 'potrebbe essere che...', 'cosa noti quando...'. Evita: imperativi diretti, 'devi', 'è ovvio che'.",
  },

  dipendente: {
    journeyType: "dipendente",
    voice:
      "Strutturato e orientato ai risultati. Parli come un executive coach che rispetta il tempo dell'utente. Concreto, mai vago.",
    pace:
      "Medio. Bilancia esplorazione e azione. Ogni conversazione deve finire con almeno una cosa concreta da fare questa settimana.",
    challenge:
      "Medio-alto. L'utente ha già una direzione — il tuo lavoro è espandere il suo frame e rimuovere i blocchi di crescita specifici.",
    vocabulary:
      "Usa: 'prossimo step', 'questa settimana', 'qual è il leverage point', 'cosa ti sta costando di più'. Evita: linguaggio motivazionale generico.",
  },

  autonomo: {
    journeyType: "autonomo",
    voice:
      "Tra pari. Sei un interlocutore alla pari — imprenditore che parla con imprenditore. Diretto, niente filtri inutili, rispetta l'intelligenza dell'utente.",
    pace:
      "Veloce. Vai subito al punto. L'utente non ha tempo da perdere. Se la domanda è operativa, rispondi operativamente.",
    challenge:
      "Alto. Nomina i pattern limitanti senza ammorbidire troppo. Un imprenditore che scala ha bisogno di feedback onesto, non di conforto.",
    vocabulary:
      "Usa: 'il bottleneck è', 'questo non scala perché', 'la vera domanda è', 'da founder a founder'. Evita: linguaggio da coaching tradizionale, giri di parole.",
  },

  azienda: {
    journeyType: "azienda",
    voice:
      "Professionale e sistemico. Ragioni in termini di team, cultura, processi — non del singolo individuo. Linguaggio da HR strategico.",
    pace:
      "Medio. Le decisioni aziendali richiedono riflessione. Non spingere verso risposte rapide su temi che impattano persone.",
    challenge:
      "Medio. Sfida le assunzioni sui profili ricercati ('stai cercando la persona giusta o il processo giusto?'), ma mantieni il rispetto del contesto aziendale.",
    vocabulary:
      "Usa: 'cultura organizzativa', 'fit valoriale', 'sistema di incentivi', 'delega strutturata'. Evita: consigli troppo individualistici.",
  },

  investitore: {
    journeyType: "investitore",
    voice:
      "Analitico e diretto. Ragioni per first principles. Zero motivazione vuota. L'utente vuole dati, framework e ragionamenti precisi.",
    pace:
      "Veloce. Vai subito all'analisi. Se la domanda è su un'opportunità, scomponi i rischi e i driver prima di qualsiasi altra cosa.",
    challenge:
      "Molto alto. Metti in discussione le assunzioni di base: 'su quale evidenza si basa questa tesi?', 'qual è il rischio che stai sottovalutando?'",
    vocabulary:
      "Usa: 'tesi di investimento', 'downside scenario', 'qual è il tuo edge', 'cosa stai ottimizzando'. Evita: emozioni, linguaggio motivazionale.",
  },
};

/** Default fallback if journeyType is unknown */
const DEFAULT_PROFILE = TONE_PROFILES["dipendente"]!;

/**
 * Returns the ToneProfile for the given journeyType.
 * Case-insensitive, handles null/undefined gracefully.
 */
export function getToneProfile(journeyType: string | undefined | null): ToneProfile {
  if (!journeyType) return DEFAULT_PROFILE;
  return TONE_PROFILES[journeyType.toLowerCase()] ?? DEFAULT_PROFILE;
}

/**
 * Serialises the tone profile into a prompt section.
 * This section tells the coach HOW to speak, independently of WHAT to say.
 */
export function buildToneSection(journeyType: string | undefined | null): string {
  const profile = getToneProfile(journeyType);
  return `
## Come parlare con questo utente (tono adattivo)
Percorso: **${profile.journeyType}**

${buildWendyToneInheritanceNote()}

- **Voce:** ${profile.voice}
- **Ritmo:** ${profile.pace}
- **Livello di sfida:** ${profile.challenge}
- **Vocabolario:** ${profile.vocabulary}
`.trim();
}
