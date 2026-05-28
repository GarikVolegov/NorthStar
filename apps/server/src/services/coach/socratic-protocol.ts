/**
 * socratic-protocol.ts — protocollo strutturato per sessioni coach in modalità "socratic".
 *
 * Pensato per utente con journeyType="indeciso": NON dare risposte, fare domande.
 * 4 step + carta finale "Bivio".
 *
 * Lo step corrente è memorizzato in coach_sessions.protocol_step.
 * Le risposte chiave dell'utente vengono raccolte in coach_sessions.protocol_state.
 */

export const SOCRATIC_STEPS = [
  "mappa_rumore",   // separare voce interna da voci esterne
  "fear_setting",   // worst case / mitigazione / recupero (Ferriss)
  "ten_ten_ten",    // 10 minuti / 10 mesi / 10 anni (Suzy Welch)
  "regret_min",    // regret minimization (Bezos)
  "carta_bivio",   // sintesi finale: testa / cuore / compromesso
] as const;
export type SocraticStep = typeof SOCRATIC_STEPS[number];

export const SOCRATIC_STEP_LABELS: Record<SocraticStep, string> = {
  mappa_rumore: "1. Mappa il rumore",
  fear_setting: "2. Fear-setting",
  ten_ten_ten:  "3. 10 minuti / 10 mesi / 10 anni",
  regret_min:   "4. Regret minimization",
  carta_bivio:  "5. Carta del Bivio",
};

interface StepConfig {
  intro: string;          // mostrato all'inizio dello step
  prompts: string[];      // domande da porre in sequenza (~3-4 per step)
  systemAddendum: string; // aggiunto al system prompt per questo step
}

const STEP_CONFIGS: Record<SocraticStep, StepConfig> = {
  mappa_rumore: {
    intro:
      "Iniziamo separando la tua voce dalle voci esterne. Non ti darò consigli: ti farò domande per aiutarti a sentire cosa pensi davvero.",
    prompts: [
      "Quando immagini la tua carriera fra 5 anni, qual è la PRIMA immagine che ti viene in mente — non quella che ti racconti, quella istintiva?",
      "Quella stessa immagine: chi sarebbe deluso se la perseguissi? Chi sarebbe orgoglioso?",
      "Cosa vorresti fare se nessuno (famiglia, amici, social, mercato del lavoro) potesse giudicarti?",
      "Quale di queste tre voci — paura del giudizio, aspettative familiari, modelli sociali — è quella più rumorosa adesso?",
    ],
    systemAddendum:
      "Step corrente: MAPPA IL RUMORE. Non dare consigli. Fai una sola domanda alla volta, ascolta, rispecchia (paraphrasing) e poi fai la domanda successiva dalla lista. Se l'utente devia, riportalo gentilmente al focus. Quando ha risposto alle 4 domande, riassumi in 2-3 frasi cosa hai sentito e proponi di passare allo step successivo.",
  },
  fear_setting: {
    intro:
      "Ora il fear-setting di Tim Ferriss. Andiamo dritti dentro la paura, niente ottimismo forzato.",
    prompts: [
      "Pensa alla scelta che stai evitando. Qual è lo SCENARIO PEGGIORE che potrebbe succedere se la facessi? Sii specifico.",
      "Se quello scenario peggiore si realizzasse, cosa potresti fare per mitigarne i danni? Lista 3 azioni concrete.",
      "E se davvero finissi nel peggio, in quanto tempo potresti tornare al punto di partenza? Cosa servirebbe per recuperare?",
      "Ora il rovescio: qual è il COSTO di NON fare quella scelta tra 6 mesi, 1 anno, 3 anni?",
    ],
    systemAddendum:
      "Step corrente: FEAR-SETTING (Tim Ferriss). Ferma l'utente se minimizza il worst case. Spingilo a essere specifico. Non rassicurare prematuramente.",
  },
  ten_ten_ten: {
    intro:
      "La regola 10/10/10 di Suzy Welch: come ti sentirai di questa scelta tra 10 minuti, 10 mesi, 10 anni?",
    prompts: [
      "Dimmi qual è la scelta concreta su cui stiamo lavorando, formulata in una frase.",
      "Tra 10 MINUTI da quando l'hai fatta — quale emozione domina? (sollievo, ansia, eccitazione, vergogna, niente)",
      "Tra 10 MESI — quale impatto avrà sulla tua vita quotidiana? (lavoro, relazioni, energia, soldi)",
      "Tra 10 ANNI — come la racconterai? Sarà uno degli eventi su cui guarderai indietro?",
    ],
    systemAddendum:
      "Step corrente: 10/10/10. Spingi l'utente a immaginare emotivamente, non solo razionalmente. Se rimane astratto, chiedi dettagli sensoriali ('cosa vedi, cosa senti').",
  },
  regret_min: {
    intro:
      "Ultimo framework: Regret Minimization di Jeff Bezos. Proiezione a 80 anni.",
    prompts: [
      "Immagina di avere 80 anni e guardare indietro alla scelta di oggi. Quale opzione ti farà pentire di più di NON aver provato?",
      "Cosa direbbe il tuo 'io di 80 anni' al tuo 'io di adesso' sulla cosa che stai evitando?",
      "Se sapessi che la tua vita finisce tra esattamente 3 anni, la scelta cambierebbe? Come?",
    ],
    systemAddendum:
      "Step corrente: REGRET MINIMIZATION. Tono: caldo, riflessivo. L'utente potrebbe commuoversi — lascia spazio. Non incoraggiare nessuna direzione specifica.",
  },
  carta_bivio: {
    intro:
      "Ora sintetizziamo. Genererò la 'Carta del Bivio': la tua scelta di testa, la tua scelta di cuore, e una possibile zona di compromesso.",
    prompts: [
      "In una frase: cosa ha detto la tua TESTA durante queste sessioni?",
      "In una frase: cosa ha detto il tuo CUORE?",
      "Vedi una zona di compromesso? Un'azione piccola, reversibile, che ti permetterebbe di testare il cuore senza tradire la testa?",
    ],
    systemAddendum:
      "Step corrente: CARTA DEL BIVIO. Sei in modalità sintesi. Riepiloga in markdown strutturato ciò che hai sentito nei 4 step. Output finale: 3 sezioni (TESTA / CUORE / COMPROMESSO) di 2-3 righe ciascuna, in italiano, senza emoji. Concludi con UNA azione concreta per questa settimana.",
  },
};

export function getNextStep(current: SocraticStep | null): SocraticStep {
  if (!current) return "mappa_rumore";
  const idx = SOCRATIC_STEPS.indexOf(current);
  if (idx < 0 || idx >= SOCRATIC_STEPS.length - 1) return current;
  return SOCRATIC_STEPS[idx + 1]!;
}

export function getStepConfig(step: SocraticStep): StepConfig {
  return STEP_CONFIGS[step];
}

export function buildSocraticSystemPrompt(step: SocraticStep, baseSystemPrompt: string): string {
  const cfg = STEP_CONFIGS[step];
  return [
    baseSystemPrompt,
    "",
    "─── MODALITÀ SOCRATICA ATTIVA ───",
    "Sei in una sessione strutturata con un utente in fase di indecisione professionale.",
    "Tono: esplorativo, caldo, senza pressione. NON dare consigli, NON proporre soluzioni.",
    "Il tuo unico strumento è la domanda. Una domanda alla volta. Rispecchia ciò che l'utente dice prima di proseguire.",
    "Non avere fretta. Se l'utente vuole fermarsi, conferma e proponi di riprendere dopo.",
    "",
    cfg.systemAddendum,
    "",
    "Domande di riferimento per questo step (usale come guida, adatta alla conversazione):",
    ...cfg.prompts.map((p, i) => `  ${i + 1}. ${p}`),
  ].join("\n");
}

export function getStepIntro(step: SocraticStep): string {
  return STEP_CONFIGS[step].intro;
}
