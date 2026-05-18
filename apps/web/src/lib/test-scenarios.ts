import type { AvatarState } from "@/components/wendy-avatar";

export interface QuestionScenario {
  scenario: string;      // contesto introduttivo in seconda persona
  avatarState: AvatarState;
  avatarIntro: string;   // cosa dice Wendy prima della domanda
}

export const SCENARIOS: Record<string, QuestionScenario> = {

  // ── ATTITUDINI E COMPETENZE ─────────────────────────────────────────────
  q1: {
    scenario: "Pensa ai momenti in cui hai lavorato con qualcosa di concreto, fatto con le mani.",
    avatarState: "curious",
    avatarIntro: "Iniziamo dal tuo rapporto con il lavoro pratico e tangibile.",
  },
  q2: {
    scenario: "Immagina di avere davanti un problema complesso che nessuno sa ancora come risolvere.",
    avatarState: "curious",
    avatarIntro: "Vediamo come ti relazioni con l'analisi e la ricerca.",
  },
  q3: {
    scenario: "Pensa a come ti esprimi quando vuoi comunicare qualcosa che ti sta a cuore.",
    avatarState: "reflective",
    avatarIntro: "Esploriamo la tua dimensione creativa ed espressiva.",
  },
  q4: {
    scenario: "Ricorda un momento in cui qualcuno aveva bisogno di supporto o di essere guidato.",
    avatarState: "curious",
    avatarIntro: "Quanto è importante per te il contatto e l'impatto sulle persone?",
  },
  q5: {
    scenario: "Pensa a come ti senti quando c'è qualcosa da costruire dal nulla o da portare avanti.",
    avatarState: "focused",
    avatarIntro: "Parliamo del tuo rapporto con l'iniziativa e la leadership.",
  },
  q6: {
    scenario: "Immagina di dover gestire un processo articolato con molte variabili e scadenze.",
    avatarState: "focused",
    avatarIntro: "Come vivi la struttura, il metodo e la pianificazione?",
  },
  q7: {
    scenario: "Pensa all'ambiente fisico in cui ti piace lavorare ogni giorno.",
    avatarState: "reflective",
    avatarIntro: "Dove ti senti più a tuo agio: in campo o in ufficio?",
  },
  q8: {
    scenario: "Ricorda una domanda o un problema su cui hai continuato a ragionare anche fuori dal lavoro.",
    avatarState: "reflective",
    avatarIntro: "Esploriamo la tua curiosità intellettuale.",
  },
  q9: {
    scenario: "Pensa a come ti senti in un contesto dove le regole sono rigide e il metodo non cambia.",
    avatarState: "curious",
    avatarIntro: "Quanto è importante per te la libertà creativa nel lavoro?",
  },
  q10: {
    scenario: "Immagina il lavoro che fai tra cinque anni: cosa ti farebbe sentire che ne è valsa la pena?",
    avatarState: "focused",
    avatarIntro: "Parliamo di impatto e significato nel tuo percorso professionale.",
  },
  q11: {
    scenario: "Pensa a una situazione in cui hai dovuto convincere qualcuno o guidare una decisione condivisa.",
    avatarState: "focused",
    avatarIntro: "Come ti poni nelle situazioni che richiedono persuasione o negoziazione?",
  },
  q12: {
    scenario: "Ricorda un'attività in cui la precisione faceva la differenza tra un buon risultato e uno eccellente.",
    avatarState: "celebrating",
    avatarIntro: "Ultima domanda sulle attitudini. Quasi alla seconda parte.",
  },

  // ── Varianti per percorso (Attitudini) ──────────────────────────────────
  q5_dipendente: {
    scenario: "Pensa a un progetto in cui hai lavorato bene in squadra, contribuendo senza dover guidare.",
    avatarState: "focused",
    avatarIntro: "Come vivi il contributo all'interno di un team organizzato?",
  },
  q11_dipendente: {
    scenario: "Ricorda un momento in cui hai risolto un problema lavorando insieme a qualcuno.",
    avatarState: "focused",
    avatarIntro: "Quanto è naturale per te la collaborazione e il lavoro condiviso?",
  },
  q5_autonomo: {
    scenario: "Pensa a come ti senti quando gestisci un progetto interamente in autonomia, senza una struttura che ti coordina.",
    avatarState: "focused",
    avatarIntro: "Esploriamo il tuo rapporto con l'indipendenza professionale.",
  },
  q6_autonomo: {
    scenario: "Immagina una settimana lavorativa completamente libera: nessun orario imposto, nessuna riunione obbligatoria.",
    avatarState: "focused",
    avatarIntro: "Come organizzeresti il tuo tempo senza vincoli esterni?",
  },
  q5_azienda: {
    scenario: "Pensa a un momento in cui hai guidato un gruppo verso un obiettivo ambizioso, definendo tu la direzione.",
    avatarState: "focused",
    avatarIntro: "Parliamo del tuo approccio alla leadership strategica.",
  },
  q11_azienda: {
    scenario: "Immagina di avere un team da sviluppare: ogni persona con il proprio potenziale da sbloccare.",
    avatarState: "focused",
    avatarIntro: "Come vivi la responsabilità di far crescere le persone?",
  },
  q2_investitore: {
    scenario: "Pensa a come affronti la valutazione di un'opportunità: cosa cerchi nei numeri e nei trend?",
    avatarState: "curious",
    avatarIntro: "Parliamo del tuo approccio all'analisi di rischi e opportunità.",
  },
  q8_investitore: {
    scenario: "Ricorda un momento in cui hai capito qualcosa di importante su come funziona un mercato o un settore.",
    avatarState: "reflective",
    avatarIntro: "Esploriamo la tua passione per i meccanismi economici e finanziari.",
  },

  // ── DIMENSIONI MOTIVAZIONALI ─────────────────────────────────────────────
  // Intelligenza Emotiva (Shen)
  shen_1: {
    scenario: "Pensa a una giornata lavorativa intensa: come hai gestito le emozioni che portavi con te?",
    avatarState: "reflective",
    avatarIntro: "Esploriamo la tua consapevolezza emotiva nel contesto professionale.",
  },
  shen_2: {
    scenario: "Ricorda un momento in cui ti sei sentito fuori equilibrio: come hai fatto a ritrovare la lucidità?",
    avatarState: "reflective",
    avatarIntro: "La capacità di riequilibrarsi è una competenza professionale fondamentale.",
  },
  shen_3: {
    scenario: "Pensa a una situazione in cui hai percepito il disagio o la preoccupazione di un collega prima che lo dicesse.",
    avatarState: "reflective",
    avatarIntro: "Ultima domanda sull'intelligenza emotiva. Rispondi con calma.",
  },
  // Orientamento Strategico (Hun)
  hun_1: {
    scenario: "Immagina dove vuoi essere professionalmente tra cinque anni: quanto è vivida e concreta quell'immagine?",
    avatarState: "curious",
    avatarIntro: "Parliamo della tua capacità di visione e proiezione nel futuro.",
  },
  hun_2: {
    scenario: "Pensa a come ti senti quando ti viene un'idea nuova che potrebbe cambiare il tuo approccio al lavoro.",
    avatarState: "curious",
    avatarIntro: "L'orientamento strategico dipende anche da come accogli le nuove direzioni.",
  },
  hun_3: {
    scenario: "Ricorda un momento in cui hai preso una decisione importante senza avere ancora tutte le informazioni.",
    avatarState: "curious",
    avatarIntro: "Ultima domanda sull'orientamento strategico. Fidati del tuo giudizio.",
  },
  // Motivazione e Impulso (Po)
  po_1: {
    scenario: "Pensa a un'attività che ti ha fatto perdere il senso del tempo perché eri completamente coinvolto.",
    avatarState: "focused",
    avatarIntro: "Esploriamo cosa alimenta la tua motivazione intrinseca.",
  },
  po_2: {
    scenario: "Ricorda una situazione in cui hai capito istintivamente che qualcosa non andava, anche senza dati chiari.",
    avatarState: "focused",
    avatarIntro: "Il rapporto tra istinto e razionalità è rivelatore nel lavoro.",
  },
  po_3: {
    scenario: "Pensa a come ti senti quando entri per la prima volta in un nuovo ambiente lavorativo.",
    avatarState: "reflective",
    avatarIntro: "Ultima domanda sulla motivazione. Come percepisci un nuovo contesto?",
  },
  // Pensiero Analitico (Yi)
  yi_1: {
    scenario: "Pensa a un momento in cui hai dovuto concentrarti a lungo su un problema tecnico o concettuale complesso.",
    avatarState: "focused",
    avatarIntro: "Vediamo come gestisci il focus su attività che richiedono profondità.",
  },
  yi_2: {
    scenario: "Immagina di dover affrontare un problema con molte componenti interdipendenti: da dove inizi?",
    avatarState: "focused",
    avatarIntro: "Il pensiero analitico si vede nel modo in cui scomponi i problemi.",
  },
  yi_3: {
    scenario: "Ricorda una riunione o un briefing ricco di informazioni: quanto riesci a trattenere e usare dopo?",
    avatarState: "focused",
    avatarIntro: "Ultima domanda sul pensiero analitico. Quasi alla fine della seconda parte.",
  },
  // Resilienza (Zhi)
  zhi_1: {
    scenario: "Pensa a un obiettivo che hai perseguito a lungo, anche quando i risultati tardavano ad arrivare.",
    avatarState: "focused",
    avatarIntro: "Esploriamo come mantieni la rotta nei momenti di difficoltà.",
  },
  zhi_2: {
    scenario: "Ricorda una critica o un feedback negativo su qualcosa a cui tenevi: come hai reagito?",
    avatarState: "reflective",
    avatarIntro: "La resilienza si manifesta soprattutto nel modo in cui rispondi agli ostacoli.",
  },
  zhi_3: {
    scenario: "Pensa a un momento in cui eri quasi alla fine di un percorso impegnativo ma l'energia stava calando.",
    avatarState: "celebrating",
    avatarIntro: "Ultima domanda del profilo motivazionale. Ci sei quasi.",
  },

  // ── CONTESTO E OBIETTIVI ──────────────────────────────────────────────
  ctx_1: {
    scenario: "Pensa alla direzione professionale che vuoi costruire nei prossimi anni.",
    avatarState: "focused",
    avatarIntro: "Queste ultime domande aiutano a calibrare tutto ciò che hai condiviso.",
  },
  ctx_2: {
    scenario: "Immagina di avere carta bianca per disegnare il tuo percorso ideale, senza vincoli.",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Rispondi con quello che senti davvero.",
  },
  ctx_dipendente_1: {
    scenario: "Pensa a cosa cerchi concretamente nel prossimo lavoro da dipendente.",
    avatarState: "focused",
    avatarIntro: "Queste domande personalizzano i settori più adatti al tuo obiettivo.",
  },
  ctx_dipendente_2: {
    scenario: "Immagina te stesso tra tre anni in un'azienda in cui ti senti pienamente al posto giusto.",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Sii onesto su cosa ti aspetti davvero.",
  },
  ctx_autonomo_1: {
    scenario: "Pensa a cosa significa per te lavorare in modo veramente indipendente.",
    avatarState: "focused",
    avatarIntro: "Queste domande affinano i settori più adatti alla libera professione.",
  },
  ctx_autonomo_2: {
    scenario: "Immagina una giornata di lavoro ideale come libero professionista: come sarebbe?",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Rispondi con la massima sincerità.",
  },
  ctx_azienda_1: {
    scenario: "Pensa a cosa ti spinge davvero verso la costruzione o la guida di un'impresa.",
    avatarState: "focused",
    avatarIntro: "Queste domande calibrano i settori più adatti all'imprenditoria.",
  },
  ctx_azienda_2: {
    scenario: "Immagina il tuo progetto imprenditoriale tra cinque anni: cosa hai costruito?",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Sii preciso su cosa ti aspetti da questo percorso.",
  },
  ctx_investitore_1: {
    scenario: "Pensa a quale tipo di valore vuoi creare con il tuo portfolio nel lungo periodo.",
    avatarState: "focused",
    avatarIntro: "Queste domande personalizzano i settori più adatti alla tua visione da investitore.",
  },
  ctx_investitore_2: {
    scenario: "Immagina il tuo profilo professionale ideale: analista, allocatore di capitale, imprenditore ibrido?",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Rispondi in base a dove vuoi arrivare.",
  },
  ctx_indeciso_1: {
    scenario: "Pensa a cosa ti trattiene dal scegliere una direzione professionale in questo momento.",
    avatarState: "focused",
    avatarIntro: "Queste domande ci aiutano a capire da dove partire con te.",
  },
  ctx_indeciso_2: {
    scenario: "Immagina di scoprire un settore che non avevi mai considerato: come ti senti all'idea di esplorarlo?",
    avatarState: "celebrating",
    avatarIntro: "L'ultima domanda. Non ci sono risposte giuste: è il punto di partenza.",
  },
};
