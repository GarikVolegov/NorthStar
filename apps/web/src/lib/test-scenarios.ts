import type { AvatarState } from "@/components/lyra-avatar";

export interface QuestionScenario {
  scenario: string;      // frase di contesto in prima persona
  avatarState: AvatarState;
  avatarIntro: string;   // cosa "dice" Lyra prima della domanda
}

export const SCENARIOS: Record<string, QuestionScenario> = {

  // ── ATTITUDINI (RIASEC) ─────────────────────────────────────────────────
  q1: {
    scenario: "Sei alla tua prima settimana in un nuovo team. Ti viene chiesto di organizzare un processo da zero.",
    avatarState: "curious",
    avatarIntro: "Partiamo da come ti relazioni con il lavoro pratico.",
  },
  q2: {
    scenario: "Hai davanti a te un problema tecnico complesso. Nessuno sa ancora come risolverlo.",
    avatarState: "curious",
    avatarIntro: "Vediamo come reagisci di fronte alle sfide analitiche.",
  },
  q3: {
    scenario: "Ti trovi in una riunione dove l\u2019atmosfera è tesa. Qualcuno ha bisogno di supporto.",
    avatarState: "reflective",
    avatarIntro: "Esploriamo la tua dimensione relazionale.",
  },
  q4: {
    scenario: "Hai carta bianca per creare qualcosa di nuovo: un prodotto, un progetto, un contenuto.",
    avatarState: "curious",
    avatarIntro: "Quanto ti attira l\u2019aspetto creativo del lavoro?",
  },
  q5: {
    scenario: "Sei in una presentazione di fronte a un gruppo di persone che non conosci.",
    avatarState: "focused",
    avatarIntro: "Come vivi le situazioni in cui sei al centro dell\u2019attenzione?",
  },
  q6: {
    scenario: "Devi prendere una decisione importante in poco tempo con dati incompleti.",
    avatarState: "focused",
    avatarIntro: "Parliamo di come gestisci le decisioni sotto pressione.",
  },
  q7: {
    scenario: "Lavori su un progetto da solo per settimane. I progressi sono lenti ma costanti.",
    avatarState: "reflective",
    avatarIntro: "Esploriamo il tuo rapporto con il lavoro autonomo e la pazienza.",
  },
  q8: {
    scenario: "Ti viene proposto di fare da mentore a un collega meno esperto.",
    avatarState: "reflective",
    avatarIntro: "Come ti senti quando guidi o insegni qualcosa agli altri?",
  },
  q9: {
    scenario: "Hai la possibilità di negoziare un accordo importante per il tuo team.",
    avatarState: "focused",
    avatarIntro: "Vediamo come ti poni nelle situazioni competitive.",
  },
  q10: {
    scenario: "Stai lavorando su un sistema che deve funzionare in modo preciso e affidabile.",
    avatarState: "focused",
    avatarIntro: "Quanto ti attira la precisione e la struttura nel lavoro?",
  },
  q11: {
    scenario: "Vieni invitato a esplorare un territorio completamente nuovo per te, professionalmente.",
    avatarState: "curious",
    avatarIntro: "Come reagisci all\u2019incertezza e all\u2019esplorazione?",
  },
  q12: {
    scenario: "Il tuo team festeggia un risultato raggiunto insieme dopo mesi di lavoro.",
    avatarState: "celebrating",
    avatarIntro: "Un\u2019ultima domanda sulle Attitudini prima di andare avanti.",
  },

  // ── PROFILO INTERIORE ──────────────────────────────────────────────────
  // Consapevolezza (Shen)
  shen_1: {
    scenario: "Ripensi a una giornata lavorativa intensa. Qualcosa ti ha fatto sentire pienamente presente.",
    avatarState: "reflective",
    avatarIntro: "Ora esploriamo qualcosa di più profondo: come ti percepisci.",
  },
  shen_2: {
    scenario: "Stai per iniziare una conversazione difficile. Ti fermi un momento a raccogliere i pensieri.",
    avatarState: "reflective",
    avatarIntro: "La consapevolezza di sé è una delle basi più solide di una carriera.",
  },
  shen_3: {
    scenario: "Guardi indietro all\u2019ultimo anno professionale. Noti uno schema ricorrente nel tuo modo di agire.",
    avatarState: "reflective",
    avatarIntro: "Ultima domanda sulla tua consapevolezza. Rispondi con calma.",
  },
  // Visione (Hun)
  hun_1: {
    scenario: "Immagina te stessa tra cinque anni. Hai costruito qualcosa di cui vai fiera.",
    avatarState: "curious",
    avatarIntro: "Passiamo alla tua capacità di visione e proiezione futura.",
  },
  hun_2: {
    scenario: "Stai pianificando un progetto importante. Pensi prima alla destinazione o al percorso?",
    avatarState: "curious",
    avatarIntro: "La visione determina come prendi decisioni strategiche.",
  },
  hun_3: {
    scenario: "Un\u2019opportunità inaspettata appare. Non è nel tuo piano, ma potrebbe cambiarti la traiettoria.",
    avatarState: "curious",
    avatarIntro: "Ultima domanda sulla Visione. Fidati del tuo istinto.",
  },
  // Energia (Po)
  po_1: {
    scenario: "Sono le 17.00, hai avuto una giornata intensa. Arriva una richiesta urgente.",
    avatarState: "focused",
    avatarIntro: "Ora esploriamo come gestisci la tua energia nei momenti critici.",
  },
  po_2: {
    scenario: "Sei sotto scadenza. Il lavoro richiede concentrazione totale per le prossime due ore.",
    avatarState: "focused",
    avatarIntro: "L\u2019energia è una risorsa: capire come la usi è fondamentale.",
  },
  po_3: {
    scenario: "Hai appena finito un progetto impegnativo. Senti il bisogno di ricaricarti.",
    avatarState: "reflective",
    avatarIntro: "Ultima domanda sull\u2019Energia. Come ti recuperi?",
  },
  // Focus (Yi)
  yi_1: {
    scenario: "Hai tre priorità urgenti contemporaneamente. Devi scegliere da dove iniziare.",
    avatarState: "focused",
    avatarIntro: "Vediamo come gestisci il focus quando ci sono troppe cose da fare.",
  },
  yi_2: {
    scenario: "Un progetto cambia direzione a metà strada. Devi riorientarti velocemente.",
    avatarState: "focused",
    avatarIntro: "Il focus non è solo concentrazione — è anche adattamento.",
  },
  yi_3: {
    scenario: "Lavori in un ambiente con molte distrazioni. Come mantieni la rotta?",
    avatarState: "focused",
    avatarIntro: "Ultima domanda sul Focus. Quasi ci siamo.",
  },
  // Determinazione (Zhi)
  zhi_1: {
    scenario: "Stai lavorando a un obiettivo a lungo termine. I risultati tardano ad arrivare.",
    avatarState: "focused",
    avatarIntro: "Esploriamo come mantieni la rotta quando le cose si fanno difficili.",
  },
  zhi_2: {
    scenario: "Hai ricevuto un feedback negativo su qualcosa a cui tenevi molto.",
    avatarState: "reflective",
    avatarIntro: "La determinazione si vede soprattutto nei momenti di difficoltà.",
  },
  zhi_3: {
    scenario: "Sei vicina al traguardo di un percorso impegnativo. L\u2019energia comincia a calare.",
    avatarState: "celebrating",
    avatarIntro: "Ultima domanda del Profilo Interiore. Ce la fai, ci sei quasi.",
  },

  // ── OBIETTIVI (CTX) ────────────────────────────────────────────────────
  ctx_1: {
    scenario: "Pensi alla direzione professionale che vuoi prendere nei prossimi anni.",
    avatarState: "focused",
    avatarIntro: "Ultime due domande. Queste aiutano a calibrare tutto ciò che hai condiviso.",
  },
  ctx_2: {
    scenario: "Hai carta bianca per disegnare il tuo percorso ideale, senza vincoli.",
    avatarState: "celebrating",
    avatarIntro: "L\u2019ultima domanda. Rispondi con quello che senti davvero.",
  },
};
