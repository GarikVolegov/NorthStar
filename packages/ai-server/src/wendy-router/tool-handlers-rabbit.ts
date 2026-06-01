import { logger } from "../logger";
import { err, type ToolResult } from "./tool-handlers";
import { retrieve } from "../growth-agent/retriever";
import { CARE_GUIDE_DATA } from "./tool-handlers-rabbit-care";

// ── Care guides ───────────────────────────────────────────────────────────────

// ── Food safety ───────────────────────────────────────────────────────────────

type FoodSafety = "safe" | "caution" | "toxic" | "toxic_emergency";

type FoodEntry = {
  foodName: string;
  safety: FoodSafety;
  safeQuantity?: string;
  reason: string;
  alternativeSuggestion?: string;
  requiresVetImmediately?: boolean;
};

const FOOD_SAFETY_DATA: Record<string, FoodEntry> = {
  fieno: { foodName: "fieno", safety: "safe", safeQuantity: "illimitato", reason: "Alimento base indispensabile. Timothy, orchard grass, prato misto. Mantiene denti e intestino sani." },
  "fieno timothy": { foodName: "fieno timothy", safety: "safe", safeQuantity: "illimitato", reason: "Fieno ideale per adulti. Alto contenuto di fibra, basso in calcio." },
  cicoria: { foodName: "cicoria", safety: "safe", safeQuantity: "30g/kg peso corporeo al giorno totale con le altre verdure", reason: "Ottima verdura fogliosa. Ricca di fibre e vitamine." },
  radicchio: { foodName: "radicchio", safety: "safe", safeQuantity: "una foglia al giorno", reason: "Sicuro e gradito. Proprietà antiossidanti." },
  rucola: { foodName: "rucola", safety: "safe", safeQuantity: "parte della porzione giornaliera di verdure", reason: "Buona fonte di calcio e vitamine. Varietà nella dieta verde." },
  prezzemolo: { foodName: "prezzemolo", safety: "caution", safeQuantity: "piccola quantità 2-3 volte/settimana", reason: "Alto contenuto di calcio e ossalati — non quotidianamente. Sicuro in piccole dosi.", alternativeSuggestion: "Cicoria o rucola come alternativa quotidiana." },
  basilico: { foodName: "basilico", safety: "safe", safeQuantity: "qualche foglia come variazione", reason: "Sicuro e appetibile. Non la base della dieta verde." },
  menta: { foodName: "menta", safety: "safe", safeQuantity: "poche foglie occasionalmente", reason: "Sicura in piccole quantità. Gradita come snack." },
  carota: { foodName: "carota", safety: "caution", safeQuantity: "1-2 cm di carota 2-3 volte/settimana max", reason: "Alto contenuto di zuccheri — non quotidianamente nonostante il mito. Le foglie di carota sono più sane della radice.", alternativeSuggestion: "Le foglie verdi della carota sono preferibili e più nutrienti." },
  mela: { foodName: "mela", safety: "caution", safeQuantity: "1-2 cm² 1-2 volte/settimana, senza semi", reason: "Frutto ad alto contenuto di zuccheri. I semi contengono acido cianidrico — rimuoverli sempre.", alternativeSuggestion: "Preferire verdure fogliose come snack quotidiano." },
  pera: { foodName: "pera", safety: "caution", safeQuantity: "piccola quantità 1-2 volte/settimana, senza semi", reason: "Come la mela: zuccheri elevati, semi tossici da rimuovere." },
  banana: { foodName: "banana", safety: "caution", safeQuantity: "1 cm 1 volta/settimana max", reason: "Molto alta in zuccheri e amido. Gradita ma da limitare fortemente." },
  fragola: { foodName: "fragola", safety: "caution", safeQuantity: "1 fragola piccola 1-2 volte/settimana", reason: "Accettabile in piccole dosi. Contenuto zuccherino da monitorare." },
  lattuga: { foodName: "lattuga", safety: "caution", safeQuantity: "evitare lattuga iceberg; romana e gentile in piccole quantità ok", reason: "Lattuga iceberg: quasi nessun valore nutrizionale, può causare diarrea per alto contenuto acquoso. Romana è migliore.", alternativeSuggestion: "Cicoria, rucola o radicchio come alternative più nutrienti." },
  spinaci: { foodName: "spinaci", safety: "caution", safeQuantity: "max 1-2 volte/settimana, piccola quantità", reason: "Alto contenuto di ossalati che interferiscono con l'assorbimento del calcio. Non quotidianamente.", alternativeSuggestion: "Cicoria o tarassaco come alternativa giornaliera." },
  tarassaco: { foodName: "tarassaco", safety: "safe", safeQuantity: "parte della porzione verde giornaliera", reason: "Eccellente — fiori, foglie e radici tutti sicuri. Alta densità nutrizionale." },
  erba: { foodName: "erba", safety: "safe", safeQuantity: "liberamente se non trattata con pesticidi", reason: "Alimento naturale. Attenzione che non sia trattata con erbicidi o fertilizzanti." },
  avena: { foodName: "avena", safety: "caution", safeQuantity: "solo come trattamento occasionale, max 1 cucchiaino/settimana", reason: "Cereale ad alto contenuto energetico. Può causare obesità e problemi intestinali se somministrata regolarmente." },
  mais: { foodName: "mais", safety: "caution", safeQuantity: "evitare regolarmente", reason: "Amido elevato, difficile da digerire per i conigli. I chicchi secchi sono un rischio di soffocamento.", alternativeSuggestion: "Fieno e verdure fogliose come base della dieta." },
  ciclamino: { foodName: "ciclamino", safety: "toxic_emergency", reason: "TOSSICO — contiene terpenoidi (saponine) che causano ipersalivazione, vomito (nei mammiferi che ci riescono), convulsioni, aritmie cardiache e possibile morte.", requiresVetImmediately: true },
  azalea: { foodName: "azalea", safety: "toxic_emergency", reason: "TOSSICO — grayanotossine che causano paralisi, problemi cardiaci e respiratori. Potenzialmente fatale.", requiresVetImmediately: true },
  oleandro: { foodName: "oleandro", safety: "toxic_emergency", reason: "MOLTO TOSSICO — glicosidi cardiaci. Anche piccole quantità possono essere letali. Emergenza veterinaria immediata.", requiresVetImmediately: true },
  mughetto: { foodName: "mughetto", safety: "toxic_emergency", reason: "TOSSICO — glicosidi cardiaci. Emergenza veterinaria.", requiresVetImmediately: true },
  digitale: { foodName: "digitale", safety: "toxic_emergency", reason: "TOSSICO — glicosidi digitalici con effetti cardiaci gravi.", requiresVetImmediately: true },
  tasso: { foodName: "tasso", safety: "toxic_emergency", reason: "ALTAMENTE TOSSICO — tassina. Quasi nessun antidoto efficace. Letale in breve tempo.", requiresVetImmediately: true },
  agrifoglio: { foodName: "agrifoglio", safety: "toxic_emergency", reason: "TOSSICO — saponine e theobromine. Emergenza veterinaria.", requiresVetImmediately: true },
  avocado: { foodName: "avocado", safety: "toxic", reason: "TOSSICO — persina, causa danni respiratori e cardiaci." },
  cioccolato: { foodName: "cioccolato", safety: "toxic", reason: "TOSSICO — teobromina, letale anche in piccole quantità per i conigli." },
  cipolla: { foodName: "cipolla", safety: "toxic", reason: "TOSSICO — disulfuri che causano anemia emolitica." },
  aglio: { foodName: "aglio", safety: "toxic", reason: "TOSSICO — stessa famiglia della cipolla, stessi rischi di anemia emolitica." },
  patata: { foodName: "patata", safety: "toxic", reason: "TOSSICA — solanacee, in particolare le parti verdi e i germogli. Amido molto elevato anche nella parte bianca." },
  pomodoro: { foodName: "pomodoro", safety: "caution", safeQuantity: "solo il frutto maturo, raramente — no foglie né gambi", reason: "Il frutto maturo rosso in piccola quantità è accettabile. Foglie, gambi e frutto verde contengono solanina TOSSICA." },
  rabarbaro: { foodName: "rabarbaro", safety: "toxic", reason: "TOSSICO — ossalati in concentrazione elevata, causa insufficienza renale." },
  noccioline: { foodName: "noccioline", safety: "toxic", reason: "TOSSICHE — alto contenuto di grassi e aflatossine. I conigli non digeriscono bene i grassi." },
  mandorle: { foodName: "mandorle", safety: "toxic", reason: "TOSSICHE — le mandorle amare contengono amigdalina (acido cianidrico). Anche le dolci sono troppo grasse." },
};

// ── Breed info ────────────────────────────────────────────────────────────────

type BreedSize = "mini" | "small" | "medium" | "large" | "giant";
type NeedsLevel = "low" | "medium" | "high";

type BreedEntry = {
  breedName: string;
  size: BreedSize;
  weightKgMin: number;
  weightKgMax: number;
  lifespan: string;
  temperament: string[];
  needsCompanion: boolean;
  exerciseNeeds: NeedsLevel;
  groomingNeeds: NeedsLevel;
  healthPredispositions: string[];
  notes?: string;
};

const BREED_ALIASES: Record<string, string> = {
  "nano olandese": "dutch",
  olandese: "dutch",
  "holland lop": "lop",
  "mini lop": "lop",
  "french lop": "lop_francese",
  "lop francese": "lop_francese",
  "ariete nano": "lop",
  ariete: "lop",
  "rex nano": "rex",
  "mini rex": "rex",
  "angora inglese": "angora",
  "angora francese": "angora_francese",
  lionhead: "lionhead",
  "testa di leone": "lionhead",
  "californiano": "californian",
  "california": "californian",
  "gigante fiammingo": "flemish_giant",
  "fiammingo": "flemish_giant",
  "nana": "dutch",
};

const BREED_DATA: Record<string, BreedEntry> = {
  dutch: {
    breedName: "Nano Olandese (Dutch)",
    size: "small",
    weightKgMin: 0.9,
    weightKgMax: 2.0,
    lifespan: "8-12 anni",
    temperament: ["curioso", "vivace", "affettuoso", "intelligente"],
    needsCompanion: true,
    exerciseNeeds: "medium",
    groomingNeeds: "low",
    healthPredispositions: ["problemi dentali (maloclusione)", "encephalitozoon cuniculi"],
    notes: "Razza popolare e adattabile. Le dimensioni ridotte non significano meno spazio — ha bisogno di correre quanto le razze più grandi.",
  },
  lop: {
    breedName: "Lop / Ariete (Holland/Mini Lop)",
    size: "small",
    weightKgMin: 1.5,
    weightKgMax: 3.5,
    lifespan: "8-12 anni",
    temperament: ["docile", "affettuoso", "tranquillo", "adatto alle famiglie"],
    needsCompanion: true,
    exerciseNeeds: "medium",
    groomingNeeds: "low",
    healthPredispositions: ["otite (canale auricolare curvo)", "problemi dentali per conformazione cranica", "obesità"],
    notes: "Le orecchie cadenti aumentano il rischio di infezioni auricolari — controllare periodicamente. La conformazione cranica può causare problemi dentali.",
  },
  lop_francese: {
    breedName: "Lop Francese (French Lop)",
    size: "large",
    weightKgMin: 4.5,
    weightKgMax: 6.5,
    lifespan: "5-7 anni",
    temperament: ["calmo", "affettuoso", "tollerante", "lento"],
    needsCompanion: true,
    exerciseNeeds: "low",
    groomingNeeds: "low",
    healthPredispositions: ["obesità", "problemi articolari", "spondilosi", "problemi cardiaci"],
    notes: "La taglia grande riduce la longevità media. Bisogno di superfici soffici per le articolazioni.",
  },
  rex: {
    breedName: "Rex / Mini Rex",
    size: "medium",
    weightKgMin: 1.4,
    weightKgMax: 4.0,
    lifespan: "7-10 anni",
    temperament: ["intelligente", "attivo", "curioso", "indipendente"],
    needsCompanion: true,
    exerciseNeeds: "high",
    groomingNeeds: "low",
    healthPredispositions: ["pododermatite (pelo sottile sulle zampe)", "encephalitozoon cuniculi"],
    notes: "Pelo vellutato corto e pelo ridotto sulle piante dei piedi — particolare attenzione alle superfici. Molto intelligente, beneficia di enrichment mentale.",
  },
  angora: {
    breedName: "Angora Inglese",
    size: "medium",
    weightKgMin: 2.0,
    weightKgMax: 3.5,
    lifespan: "7-12 anni",
    temperament: ["dolce", "tranquillo", "sensibile"],
    needsCompanion: true,
    exerciseNeeds: "medium",
    groomingNeeds: "high",
    healthPredispositions: ["boli di pelo (GI stasis da ingestione pelo)", "caldo eccessivo", "pelle sensibile"],
    notes: "Richiede spazzolatura quotidiana e taglio del pelo ogni 3-4 mesi. Il pelo cresce 3cm/mese — senza grooming regolare si formano grovigli dolorosi.",
  },
  angora_francese: {
    breedName: "Angora Francese",
    size: "medium",
    weightKgMin: 3.5,
    weightKgMax: 4.5,
    lifespan: "7-10 anni",
    temperament: ["calmo", "paziente", "affettuoso"],
    needsCompanion: true,
    exerciseNeeds: "medium",
    groomingNeeds: "high",
    healthPredispositions: ["boli di pelo", "problemi respiratori se pelo in faccia"],
    notes: "Come l'Angora Inglese ma più grande. Il pelo del muso è meno esteso — più facile la gestione del viso.",
  },
  lionhead: {
    breedName: "Lionhead (Testa di Leone)",
    size: "small",
    weightKgMin: 1.3,
    weightKgMax: 1.7,
    lifespan: "7-10 anni",
    temperament: ["vivace", "socievole", "curioso", "energico"],
    needsCompanion: true,
    exerciseNeeds: "high",
    groomingNeeds: "medium",
    healthPredispositions: ["problemi dentali (conformazione cranica brachicefala in alcuni ceppi)", "encephalitozoon cuniculi"],
    notes: "La criniera attorno alla testa richiede grooming regolare. Alcuni esemplari hanno doppia criniera che può causare problemi oculari.",
  },
  californian: {
    breedName: "Californiano",
    size: "large",
    weightKgMin: 3.5,
    weightKgMax: 4.75,
    lifespan: "5-8 anni",
    temperament: ["tranquillo", "docile", "curioso"],
    needsCompanion: true,
    exerciseNeeds: "medium",
    groomingNeeds: "low",
    healthPredispositions: ["obesità", "problemi renali in età avanzata"],
    notes: "Razza nata per la produzione di carne/pelliccia, ora tenuta come pet. Robusta e sana se ben nutrita.",
  },
  flemish_giant: {
    breedName: "Gigante Fiammingo",
    size: "giant",
    weightKgMin: 6.0,
    weightKgMax: 10.0,
    lifespan: "5-8 anni",
    temperament: ["calmo", "paziente", "affettuoso", "lento"],
    needsCompanion: true,
    exerciseNeeds: "low",
    groomingNeeds: "low",
    healthPredispositions: ["spondilosi", "problemi articolari e cardiaci", "GI stasis per dimensioni", "vita più breve"],
    notes: "Richiede spazio molto più grande della media. Le dimensioni possono rendere difficili le visite veterinarie. Vita più breve delle razze piccole.",
  },
};

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleGetRabbitCareGuide(
  args: { topic: string; rabbitAge?: string; breed?: string },
): Promise<ToolResult> {
  const topicKey = args.topic?.toLowerCase().trim();
  const guide = CARE_GUIDE_DATA[topicKey];
  if (!guide) {
    return err(
      "NOT_FOUND",
      `Argomento '${args.topic}' non riconosciuto. Temi disponibili: housing, feeding, socialization, health, enrichment, grooming`,
    );
  }
  return { ok: true, data: { ...guide, requestedAge: args.rabbitAge, requestedBreed: args.breed } };
}

export async function handleCheckFoodSafety(
  args: { foodName: string; quantity?: string },
): Promise<ToolResult> {
  const raw = args.foodName ?? "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const entry = FOOD_SAFETY_DATA[normalized] ?? FOOD_SAFETY_DATA[normalized.replace(/i$/, "o")] ?? FOOD_SAFETY_DATA[normalized.replace(/e$/, "a")];

  if (!entry) {
    return {
      ok: true,
      data: {
        foodName: args.foodName,
        safety: "unknown",
        reason: "Alimento non presente nel database. Non somministrare prima di consultare un veterinario esperto in lagomorfi.",
      },
    };
  }

  return { ok: true, data: { ...entry, quantityAsked: args.quantity } };
}

export async function handleGetBreedInfo(
  args: { breedName: string },
): Promise<ToolResult> {
  const raw = args.breedName ?? "";
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const resolvedKey = BREED_ALIASES[normalized] ?? normalized.replace(/\s+/g, "_");
  const breed = BREED_DATA[resolvedKey] ?? BREED_DATA[normalized];

  if (!breed) {
    const available = Object.values(BREED_DATA).map((b) => b.breedName).join(", ");
    return err(
      "NOT_FOUND",
      `Razza '${args.breedName}' non trovata nel database. Razze disponibili: ${available}`,
    );
  }

  return { ok: true, data: breed };
}

export async function handleSearchRabbitKb(
  args: { query: string; topK?: number },
  userId: number,
): Promise<ToolResult> {
  const topK = Math.min(args.topK ?? 4, 8);
  try {
    const chunks = await retrieve(args.query, userId, {
      topK,
      minScore: 0.3,
      sourceTypes: ["rabbit_kb"],
    });

    return {
      ok: true,
      data: {
        chunks: chunks.map((c) => ({
          content: c.content,
          source: c.source,
          score: c.score,
        })),
        totalFound: chunks.length,
        query: args.query,
      },
    };
  } catch (e) {
    logger.warn({ e, args }, "[tool] search_rabbit_kb error");
    return { ok: true, data: { chunks: [], totalFound: 0, query: args.query } };
  }
}
