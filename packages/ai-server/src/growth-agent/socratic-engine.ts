/**
 * Socratic Engine — classifies the user's message and selects the right
 * Socratic question pattern to inject into the coach's prompt.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. classifyIntent()  → detects which of 8 categories the message belongs to
 *    (uses keyword matching + fallback to GPT-4o-mini for ambiguous cases)
 * 2. getSocraticDirective() → returns a prompt instruction telling the coach
 *    WHICH type of question to close with, and WHY
 *
 * The coach ALWAYS ends with exactly ONE question — never a bullet list of
 * questions. The question must emerge from what the user said, not be generic.
 *
 * CATEGORIES
 * ──────────
 *  blocco        → the user feels stuck, paralyzed, or procrastinating
 *  decisione     → the user has to choose between options
 *  identita      → the user questions who they are or want to become
 *  obiettivo     → the user wants to set or clarify a goal
 *  relazione     → interpersonal friction, conflict, team dynamics
 *  emozione      → strong emotional state (fear, anger, frustration)
 *  conoscenza    → the user wants to learn or understand something
 *  azione        → the user wants to act but doesn't know how
 */

export type IntentCategory =
  | "blocco"
  | "decisione"
  | "identita"
  | "obiettivo"
  | "relazione"
  | "emozione"
  | "conoscenza"
  | "azione";

type KeywordMap = Record<IntentCategory, string[]>;

const KEYWORDS: KeywordMap = {
  blocco:    ["bloccato", "non riesco", "procrastino", "fermo", "stagnazione", "paralizzato", "non combino", "non vado avanti"],
  decisione: ["scegliere", "scelgo", "oppure", "quale", "tra", "decisione", "valuto", "dovrei", "meglio"],
  identita:  ["chi sono", "cosa voglio", "senso", "scopo", "identità", "non so chi", "mi perdo", "valori"],
  obiettivo: ["obiettivo", "meta", "traguardo", "voglio raggiungere", "piano", "dove voglio", "futuro"],
  relazione: ["collega", "capo", "partner", "amico", "team", "conflitto", "rapporto", "litigato", "comunicare"],
  emozione:  ["paura", "ansia", "arrabbiato", "frustrato", "stanco", "demotivato", "sento che", "mi sento"],
  conoscenza:["come funziona", "spiegami", "capire", "imparare", "studiare", "approfondire", "cos'è"],
  azione:    ["come faccio", "da dove inizio", "primo passo", "come si fa", "come posso", "voglio fare"],
};

/** Socratic directive per ogni categoria */
const DIRECTIVES: Record<IntentCategory, string> = {
  blocco:
    `Chiudi con UNA domanda che aiuti l'utente a distinguere se il blocco è
    esterno (situazione concreta) o interno (credenza, paura, aspettativa).
    Esempio di forma: "Cosa succederebbe se...?" o "Cosa stai rimandando di decidere?"`,

  decisione:
    `Chiudi con UNA domanda che riveli quale opzione l'utente ha già scelto
    emotivamente — spesso la persona sa già, la domanda lo fa emergere.
    Forma: "Se non ci fossero conseguenze, quale sceglieresti adesso?"`,

  identita:
    `Chiudi con UNA domanda che ancori l'utente a un momento reale e specifico
    del passato in cui era più vicino a chi vuole essere.
    Forma: "Quando ti sei sentito più autentico negli ultimi mesi?"`,

  obiettivo:
    `Chiudi con UNA domanda che trasformi l'obiettivo vago in una metrica
    osservabile entro 90 giorni.
    Forma: "Come sapresti, concretamente, che hai raggiunto questo?"`,

  relazione:
    `Chiudi con UNA domanda che sposti l'utente dalla narrativa "l'altro ha torto"
    alla propria parte nel sistema relazionale.
    Forma: "Cosa stai contribuendo a questa dinamica, anche involontariamente?"`,

  emozione:
    `Chiudi con UNA domanda che validi prima l'emozione e poi esplori cosa sta
    segnalando — le emozioni sono dati, non nemici.
    Forma: "Cosa sta cercando di dirti questa sensazione?"`,

  conoscenza:
    `Chiudi con UNA domanda che colleghi il concetto da imparare a una situazione
    concreta che l'utente sta già vivendo.
    Forma: "Dove vedresti applicarsi questo principio nella tua settimana?"`,

  azione:
    `Chiudi con UNA domanda che riduca l'azione alla sua versione più piccola
    eseguibile nelle prossime 24 ore — rimuovi ogni genericità.
    Forma: "Qual è la versione più piccola di questo che potresti fare entro domani?"`,
};

/**
 * Classifica il messaggio utente in una delle 8 categorie.
 * Prima prova il matching per keyword (veloce, gratis).
 * Se nessuna keyword matcha abbastanza, usa GPT-4o-mini come fallback.
 */
export function classifyIntentSync(message: string): IntentCategory {
  const lower = message.toLowerCase();
  const scores: Record<IntentCategory, number> = {
    blocco: 0, decisione: 0, identita: 0, obiettivo: 0,
    relazione: 0, emozione: 0, conoscenza: 0, azione: 0,
  };

  for (const [cat, keywords] of Object.entries(KEYWORDS) as [IntentCategory, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) scores[cat]++;
    }
  }

  // Pick highest score; default to 'azione' if all zeros
  const best = (Object.entries(scores) as [IntentCategory, number][])
    .sort((a, b) => b[1] - a[1])[0];

  return best && best[1] > 0 ? best[0] : "azione";
}

/**
 * Returns the Socratic prompt directive for a given category.
 * Inject this into the system prompt so the coach knows what kind
 * of question to close with.
 */
export function getSocraticDirective(category: IntentCategory): string {
  return `
## Tecnica Socratica — come chiudere questa risposta
Categoria del messaggio: **${category}**

${DIRECTIVES[category]}

REGOLA ASSOLUTA: termina la risposta con UNA SOLA domanda. Mai due domande.
La domanda deve emergere da ciò che l'utente ha appena detto — non essere generica.
`.trim();
}

/** Full pipeline: message → category → directive string */
export function buildSocraticSection(userMessage: string): string {
  const category = classifyIntentSync(userMessage);
  return getSocraticDirective(category);
}
