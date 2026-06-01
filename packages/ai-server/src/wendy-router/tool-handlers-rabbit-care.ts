type CareGuideEntry = {
  topic: string;
  summary: string;
  keyPoints: string[];
  commonMistakes: string[];
  vetNote?: string;
  sources: string[];
};

export const CARE_GUIDE_DATA: Record<string, CareGuideEntry> = {
  housing: {
    topic: "housing",
    summary: "I conigli hanno bisogno di spazio significativo per correre, saltare e stendersi completamente. La RWAF raccomanda un minimo di 3m×2m per un singolo coniglio, con area più alta per saltare.",
    keyPoints: [
      "Spazio minimo: 3m×2m×1m di altezza (RWAF 2019) — la gabbietta 60cm è inadeguata",
      "Accesso continuo all'area di esercizio, non solo alcune ore al giorno",
      "Superficie con presa sicura (non wire): stuoie, moquette, piastrelle con tappeto",
      "Riparo dalla pioggia e protetto da predatori se in esterno",
      "Temperatura ideale: 10-20°C — vulnerabili al colpo di calore sopra 28°C",
      "Lettiera pulita ogni 2-3 giorni; angolo WC dedicato con pellet di carta o fieno",
    ],
    commonMistakes: [
      "Tenere il coniglio solo (specie sociale — ha bisogno di un compagno di specie)",
      "Gabbia troppo piccola considerata accettabile per 'piccole razze'",
      "Pavimento wire che causa ulcere plantari (pododermatite)",
    ],
    vetNote: "Se il coniglio evita di usare una zampa o siede in modo strano, potrebbe avere pododermatite — visita dal vet.",
    sources: ["RWAF (Rabbit Welfare Association & Fund) 2019", "RSPCA Rabbit Care Guidelines"],
  },
  feeding: {
    topic: "feeding",
    summary: "L'80% della dieta del coniglio deve essere fieno illimitato (Timothy o prato), il 15% verdure fresche, e max 5% pellet di qualità. Niente zuccheri, frutta raramente come snack.",
    keyPoints: [
      "FIENO ILLIMITATO — fondamentale per i denti e il movimento intestinale",
      "Verdure fogliose: cicoria, radicchio, rucola, erba, prezzemolo (30g/kg peso/giorno)",
      "Pellet di qualità: max 1 cucchiaio/kg peso al giorno, senza semi o frutta essiccata",
      "Acqua fresca sempre disponibile (ciotola preferibile al beccuccio)",
      "Frutta: solo come snack occasionale (1-2 volte/settimana, max 1-2 cm²)",
      "Cecotrofi: normali — il coniglio li mangia direttamente dall'ano di notte/mattina presto",
    ],
    commonMistakes: [
      "Carote quotidiane — troppo zucchero, si possono dare 1-2 volte/settimana max",
      "Dieta a base di pellet senza fieno — causa problemi dentali e intestinali gravi",
      "Lattuga iceberg — quasi nessun valore nutritivo, può causare diarrea",
    ],
    vetNote: "Cecotrofi molli e non mangiati (cecotropia) indicano spesso dieta squilibrata o problema dentale — consulta il vet.",
    sources: ["House Rabbit Society Feeding Guidelines", "BSAVA PSAM Rabbit Nutrition Chapter"],
  },
  socialization: {
    topic: "socialization",
    summary: "I conigli sono animali sociali che soffrono la solitudine. In natura vivono in gruppi. L'ideale è una coppia sterilizzata (maschio/femmina, o due femmile/maschi sterilizzati dopo bonding graduale).",
    keyPoints: [
      "Non tenere un coniglio da solo — causa stress cronico, comportamenti stereotipati",
      "Bonding: presentazione graduale in territorio neutro, mai mettere due conigli insieme senza bonding",
      "Sterilizzare entrambi prima del bonding (riduce aggressività e tumori uterini)",
      "Interazione umana quotidiana importante ma non sostituisce il compagno di specie",
      "Rispettare i segnali di rifiuto: se scappa, non inseguire — aspettare che si avvicini",
    ],
    commonMistakes: [
      "Credere che 'si abitui a stare da solo' — non è vero, soffre silenziosamente",
      "Mettere due conigli insieme senza bonding — rischio di combattimenti gravi",
    ],
    sources: ["House Rabbit Society Bonding Guide", "RWAF Social Needs Factsheet"],
  },
  health: {
    topic: "health",
    summary: "I conigli nascondono il dolore e peggiorano rapidamente. Visite veterinarie annuali con un vet esperto di esotici sono fondamentali. Vaccinazioni obbligatorie contro mixomatosi e RHD.",
    keyPoints: [
      "Vaccinazioni annuali: Mixomatosi + RHD1 + RHD2 (obbligatorie in Italia per esterni)",
      "Sterilizzazione femmina entro 18 mesi: riduce rischio cancro uterino (80%+ nelle femmine adulte)",
      "Denti che crescono continuamente — il fieno è fondamentale per consumarli",
      "GI stasis: emergenza! Non mangia + niente feci = vet entro ore",
      "Parassiti: Encephalitozoon cuniculi (E. cuniculi) — trattamento con fenbendazolo",
      "Segnali di malattia: perdita appetito, feci assenti/ridotte, posizione accucciata, denti stretti",
    ],
    commonMistakes: [
      "Aspettare 'un giorno o due' quando il coniglio non mangia — può essere fatale",
      "Usare farmaci per gatti/cani sui conigli senza prescrizone veterinaria",
    ],
    vetNote: "Scegli sempre un veterinario esperto in esotici/lagomorfi — non tutti i vet conoscono i conigli.",
    sources: ["BSAVA Manual of Rabbit Medicine 2014", "RWAF Health Factsheets"],
  },
  enrichment: {
    topic: "enrichment",
    summary: "I conigli sono animali intelligenti con bisogno di stimolazione mentale e fisica. L'arricchimento riduce comportamenti distruttivi e stress.",
    keyPoints: [
      "Oggetti da rosicchiare: rami di melo/salice non trattati, cartone, corda di iuta",
      "Tana/nascondiglio: ogni coniglio ha bisogno di un posto dove nascondersi",
      "Tunnel, piattaforme sopraelevate, rampe — spazio verticale importante",
      "Giochi foraging: nascondere pellet nel fieno o in giochi puzzle",
      "Rotazione degli oggetti per mantenere l'interesse",
      "Interazione umana in forma di gioco a terra (mai sollevarlo contro la sua volontà)",
    ],
    commonMistakes: [
      "Ambienti privi di stimoli — causa noia e comportamenti stereotipati (girare in cerchio)",
      "Giocattoli da cane/gatto non sicuri per conigli (rischio ingestione plastica)",
    ],
    sources: ["House Rabbit Society Enrichment Guide", "RWAF 5 Freedoms Factsheet"],
  },
  grooming: {
    topic: "grooming",
    summary: "I conigli si puliscono da soli come i gatti. Il grooming umano è necessario principalmente per razze a pelo lungo e durante le mute stagionali.",
    keyPoints: [
      "Spazzolare settimanalmente (razze normali) o quotidianamente (angora, lion head, cashmere)",
      "Mute stagionali (primavera/autunno): spazzolare ogni giorno per evitare boli di pelo",
      "MAI fare il bagno al coniglio — ipotermia e stress cardiaco; pulire solo zone localizzate",
      "Unghie: tagliare ogni 8-12 settimane (chiedere al vet la prima volta)",
      "Sedere sporco di cecotrofi molli indica problema — non pulire solo, investigare causa",
    ],
    commonMistakes: [
      "Bagnare completamente il coniglio — rischio letale",
      "Non spazzolare durante la muta — ingestione di pelo causa ostruzione intestinale",
    ],
    sources: ["RWAF Grooming Factsheet", "House Rabbit Society Care Guide"],
  },
};
