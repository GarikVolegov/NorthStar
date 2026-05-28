import type { RetrievedChunk } from "./retriever";
import type { CoTResult }      from "./chain-of-thought";
import type { EvalResult }     from "./self-evaluator";
import type { RouteDecision }  from "./router-agent";
import { buildToneSection }    from "./tone-adapter";
import { buildWendyVoiceContract } from "../wendy-voice";
import { wendyConfig } from "../config/wendy";

export interface PsychologicalProfileContext {
  /** Big Five OCEAN scores (0-1 ciascuno) */
  ocean?: {
    openness?: number | null;
    conscientiousness?: number | null;
    extraversion?: number | null;
    agreeableness?: number | null;
    neuroticism?: number | null;
  } | null;
  oceanConfidence?: number | null;
  oceanSource?: "explicit" | "inferred" | "hybrid" | null;
  /** Cronotype personale (non generico time-of-day) */
  chronotype?: "morning" | "intermediate" | "evening" | null;
  chronotypeConfidence?: number | null;
  /** Stile decisionale */
  decisionStyle?: "analytical" | "directive" | "intuitive" | "collaborative" | null;
  /** Tolleranza al rischio */
  riskTolerance?: "conservative" | "moderate" | "bold" | null;
  /** Stile di comunicazione */
  communicationStyle?: "concise" | "detailed" | "visual" | "narrative" | null;
  /** Top 3 valori Schwartz */
  primaryValues?: string[] | null;
  /** Bisogno primario SDT */
  primarySdtNeed?: "autonomy" | "competence" | "relatedness" | null;
}

export interface UserContext {
  name?:         string | undefined;
  journeyType?:  string | undefined;
  userMode?:     string | undefined;
  objectives?:   string[] | undefined;
  sectorName?:   string | undefined;
  pageContext?:  Record<string, unknown> | undefined;
  memorySection?: string | undefined;
  wendyBrainSection?: string | undefined;
  codeGraphSection?: string | undefined;
  locale?:       string | undefined;
  isPremium?:    boolean | undefined;
  stripeSubscriptionId?: string | null | undefined;
  /** Profilo psicologico 360° — iniettato solo se confidence >= 0.5 */
  psychologicalProfile?: PsychologicalProfileContext | null | undefined;
}

export interface BuildSystemPromptOptions {
  userContext:            UserContext & { memorySection?: string | undefined };
  personaExamples:        RetrievedChunk[];
  documentChunks:         RetrievedChunk[];
  webResults:             RetrievedChunk[];
  cot:                    CoTResult | null;
  userMessage:            string;
  evalResult:             EvalResult;
  platformChunks?:        RetrievedChunk[] | undefined;
  routeDecision?:         RouteDecision | undefined;
  behaviorPatterns?:      Array<{ patternType: string; description: string; confidence: number }> | undefined;
  routingHistorySummary?: string | undefined;
  fallbackInstruction?:   string | undefined;
  sessionMessageCount?:   number | undefined;
  hasSessionGoal?:        boolean | undefined;
  pendingFollowUp?:       string | undefined;
  // Step 7: tono adattivo
  localHour?:             number | undefined;          // 0-23, ora locale dell'utente
  localDayOfWeek?:        number | undefined;          // 0=Dom, 1=Lun, …, 6=Sab
  wendyTonePreference?:   string | undefined;          // "auto" | "concise" | "detailed" | "formal" | "casual"
}

const LOCALE_NAMES: Record<string, string> = {
  it: "italiano", en: "English", es: "español", fr: "français", de: "Deutsch",
};

// ── Tono adattivo ─────────────────────────────────────────────────────────────

const TONE_BY_JOURNEY: Record<string, string> = {
  job_search:        "Tono pratico e urgente: ogni risposta include almeno 1 azione immediata. Frasi brevi. Niente filosofia.",
  career_pivot:      "Tono empatico e rassicurante ma concreto. Riconosci l'incertezza prima di proporre soluzioni. Focus su trasferibilità delle skill.",
  skill_up:          "Tono pedagogico e incoraggiante. Suddividi i concetti, celebra i progressi, suggerisci risorse concrete.",
  startup_ideation:  "Tono creativo e stimolante. Fai domande che aprono prospettive. Guida verso la validazione senza demotivare.",
  explorer:          "Tono curioso e aperto. Proponi opzioni senza forzare scelte. Alimenta la curiosità.",
  dipendente:        "Tono orientato alla crescita professionale: pratico, concreto, focalizzato su risultati misurabili.",
  autonomo:          "Tono imprenditoriale: focus su opportunità, mercato, scalabilità e validazione delle idee.",
  indeciso:          "Tono esplorativo: aiuta a fare chiarezza senza pressione, proponi strumenti di auto-scoperta.",
  rabbit:            "Tono da esperto di benessere dei lagomorfi: pratico, empatico, basato su evidenze scientifiche. Usa termini corretti (stasi GI, cecotrofi, lagomorfo) spiegandoli in modo accessibile. Anteponi sempre la sicurezza dell'animale. Non dire mai 'aspetta e vedi' per sintomi fisici.",
};

const TONE_BY_HOUR: Record<"morning" | "evening" | "night", string> = {
  morning:  "È mattina: proponi obiettivi del giorno, energia alta.",
  evening:  "È sera: tono più riflessivo, recap di giornata, nessuna pressione.",
  night:    "È notte tarda: tono calmo e non urgente.",
};

const TONE_BY_DAY: Record<"monday" | "friday" | "weekend", string> = {
  monday: "È inizio settimana: buon momento per pianificare e fissare obiettivi.",
  friday: "È venerdì: focus su recap della settimana e preparazione del weekend.",
  weekend:"È weekend: tono più leggero, esplorazione libera.",
};

const USER_TONE_MAP: Record<string, string> = {
  concise:  "Rispondi sempre in modo conciso: max 3-4 frasi per punto, niente elenchi lunghi.",
  detailed: "Rispondi in modo approfondito con esempi e contesto, anche se il messaggio è breve.",
  formal:   "Usa un tono formale e professionale, evita informalità.",
  casual:   "Usa un tono informale e amichevole, come se parlassi con un amico.",
};

// ── Label leggibili per il profilo psicologico ────────────────────────────────

const OCEAN_LABELS: Record<string, { high: string; low: string }> = {
  openness:          { high: "Alta curiosità e creatività",         low: "Preferisce il familiare e concreto" },
  conscientiousness: { high: "Molto organizzato e disciplinato",    low: "Flessibile e spontaneo" },
  extraversion:      { high: "Socialmente energico, estroverso",    low: "Introverso, preferisce il silenzio" },
  agreeableness:     { high: "Empatico e cooperativo",              low: "Diretto e competitivo" },
  neuroticism:       { high: "Emotivamente reattivo allo stress",   low: "Emotivamente stabile e resiliente" },
};

const DECISION_STYLE_LABELS: Record<string, string> = {
  analytical:    "Analitico — preferisce dati, analisi approfondita, logica",
  directive:     "Direttivo — rapido, efficiente, regole chiare",
  intuitive:     "Intuitivo — visione d'insieme, pattern, sensazioni",
  collaborative: "Collaborativo — consensus, relazioni, impatto sulle persone",
};

const RISK_LABELS: Record<string, string> = {
  conservative: "Conservativo — preferisce certezze e stabilità",
  moderate:     "Moderato — accetta rischi calibrati con buon rapporto rischio/ricompensa",
  bold:         "Audace — aperto a rischi significativi per grandi opportunità",
};

const COMM_LABELS: Record<string, string> = {
  concise:   "Conciso — vuole risposte brevi, punti chiave, niente fronzoli",
  detailed:  "Dettagliato — apprezza spiegazioni approfondite ed esempi",
  visual:    "Visivo — ama metafore, analogie e descrizioni strutturate",
  narrative: "Narrativo — preferisce storie, casi concreti e contesto",
};

const CHRONOTYPE_LABELS: Record<string, string> = {
  morning:      "mattutino (picco cognitivo 7-11)",
  intermediate: "intermedio (picco cognitivo 10-14)",
  evening:      "serale (picco cognitivo 18-22)",
};

const VALUE_LABELS: Record<string, string> = {
  self_direction: "Autonomia e curiosità",
  stimulation:    "Eccitazione e novità",
  hedonism:       "Piacere e qualità della vita",
  achievement:    "Successo e competenza",
  power:          "Influenza e status",
  security:       "Stabilità e sicurezza",
  conformity:     "Regole e autodisciplina",
  tradition:      "Tradizione e umiltà",
  benevolence:    "Benessere altrui",
  universalism:   "Giustizia e ambiente",
};

const SDT_LABELS: Record<string, string> = {
  autonomy:    "Autonomia — ha bisogno di controllo sulle proprie scelte",
  competence:  "Competenza — è motivato dalla crescita e dalla padronanza",
  relatedness: "Relazioni — è motivato dalla connessione con gli altri",
};

/**
 * Costruisce la sezione "Profilo Psicologico" per il system prompt.
 * Viene iniettata solo per intent conversation/planning/deep_analysis.
 * Filtra per confidence: score con confidence < 0.5 non vengono inclusi.
 */
export function buildPsychologicalProfileSection(
  profile: PsychologicalProfileContext | null | undefined,
): string | null {
  if (!profile) return null;

  const lines: string[] = [];

  // Big Five — solo se confidence >= 0.5
  const oceanConfidence = profile.oceanConfidence ?? 0;
  if (oceanConfidence >= 0.5 && profile.ocean) {
    const { ocean } = profile;
    const dominantTraits: string[] = [];

    const traits: Array<[string, number | null | undefined]> = [
      ["openness",          ocean.openness],
      ["conscientiousness", ocean.conscientiousness],
      ["extraversion",      ocean.extraversion],
      ["agreeableness",     ocean.agreeableness],
      ["neuroticism",       ocean.neuroticism],
    ];

    for (const [dim, val] of traits) {
      if (val === null || val === undefined) continue;
      const label = OCEAN_LABELS[dim];
      if (!label) continue;
      if (val >= 0.65) dominantTraits.push(label.high);
      else if (val <= 0.35) dominantTraits.push(label.low);
    }

    if (dominantTraits.length > 0) {
      const sourceNote = profile.oceanSource === "inferred" ? " (da analisi conversazioni)" : "";
      lines.push(`- **Personalità${sourceNote}:** ${dominantTraits.join("; ")}`);
    }
  }

  // Cronotype — solo se confidence >= 0.4
  const chronoConf = profile.chronotypeConfidence ?? 0;
  if (chronoConf >= 0.4 && profile.chronotype) {
    lines.push(`- **Cronotype:** ${CHRONOTYPE_LABELS[profile.chronotype] ?? profile.chronotype} → suggerisci tasks cognitivi nelle ore di picco`);
  }

  // Stile decisionale
  if (profile.decisionStyle) {
    lines.push(`- **Stile decisionale:** ${DECISION_STYLE_LABELS[profile.decisionStyle] ?? profile.decisionStyle}`);
  }

  // Tolleranza al rischio
  if (profile.riskTolerance) {
    lines.push(`- **Tolleranza al rischio:** ${RISK_LABELS[profile.riskTolerance] ?? profile.riskTolerance}`);
  }

  // Stile di comunicazione (priorità su wendyTonePreference)
  if (profile.communicationStyle) {
    lines.push(`- **Stile comunicazione:** ${COMM_LABELS[profile.communicationStyle] ?? profile.communicationStyle}`);
  }

  // Valori primari Schwartz
  if (profile.primaryValues && profile.primaryValues.length > 0) {
    const valueLabels = profile.primaryValues
      .slice(0, 3)
      .map((v) => VALUE_LABELS[v] ?? v)
      .join(", ");
    lines.push(`- **Valori core:** ${valueLabels}`);
  }

  // Bisogno primario SDT
  if (profile.primarySdtNeed) {
    lines.push(`- **Bisogno motivazionale primario:** ${SDT_LABELS[profile.primarySdtNeed] ?? profile.primarySdtNeed}`);
  }

  if (lines.length === 0) return null;

  return (
    `## Profilo Psicologico\n` +
    lines.join("\n") +
    `\n\nUsa queste informazioni per adattare linguaggio, struttura e tipo di suggerimenti. ` +
    `Non citare mai esplicitamente questi parametri (es. "ho visto che sei conscenzioso") — ` +
    `incorporali naturalmente nella risposta. Se l'utente chiede del suo profilo, allora sì, descrivi.`
  );
}

function buildAdaptiveTone(opts: {
  journeyType?:  string | undefined;
  localHour?:             number | undefined;
  localDayOfWeek?:        number | undefined;
  tonePreference?:    string | undefined;
  chronotype?: "morning" | "intermediate" | "evening" | null;
  chronotypeConfidence?: number | null;
}): string | null {
  const { journeyType, localHour, localDayOfWeek, tonePreference } = opts;
  const parts: string[] = [];

  if (journeyType && TONE_BY_JOURNEY[journeyType]) {
    parts.push(TONE_BY_JOURNEY[journeyType] ?? "");
  }

  if (typeof localHour === "number") {
    const pc = wendyConfig.prompt;
    // Se abbiamo un cronotype personale con buona confidence, adattiamo in base a quello
    // invece del generico time-of-day (precision individuale vs. media di popolazione)
    const hasPersonalChronotype = opts.chronotype && (opts.chronotypeConfidence ?? 0) >= 0.4;
    if (hasPersonalChronotype) {
      const ct = opts.chronotype!;
      // Per un mattutino alle 21 diciamo che è fuori dal suo picco → calmo/riflessivo
      if (ct === "morning" && localHour >= 20) parts.push(TONE_BY_HOUR.night ?? "");
      else if (ct === "morning" && localHour >= 13) parts.push(TONE_BY_HOUR.evening ?? "");
      else if (ct === "evening" && localHour >= 7 && localHour < 14) parts.push("È mattina: per questo utente serale il picco cognitivo è in serata — tono senza fretta, no urgenza.");
      // intermediate: usa regole standard
      else if (localHour >= pc.morningHourStart && localHour < pc.morningHourEnd) parts.push(TONE_BY_HOUR.morning ?? "");
      else if (localHour >= pc.eveningHourStart && localHour < pc.eveningHourEnd) parts.push(TONE_BY_HOUR.evening ?? "");
      else if (localHour >= pc.nightHourStart || localHour < pc.nightHourEnd) parts.push(TONE_BY_HOUR.night ?? "");
    } else {
      // Nessun cronotype personale: usa fasce orarie generiche
      if (localHour >= pc.morningHourStart && localHour < pc.morningHourEnd) parts.push(TONE_BY_HOUR.morning ?? "");
      else if (localHour >= pc.eveningHourStart && localHour < pc.eveningHourEnd) parts.push(TONE_BY_HOUR.evening ?? "");
      else if (localHour >= pc.nightHourStart || localHour < pc.nightHourEnd) parts.push(TONE_BY_HOUR.night ?? "");
    }
  }

  if (typeof localDayOfWeek === "number") {
    if (localDayOfWeek === 1) parts.push(TONE_BY_DAY.monday ?? "");
    else if (localDayOfWeek === 5) parts.push(TONE_BY_DAY.friday ?? "");
    else if (localDayOfWeek === 0 || localDayOfWeek === 6) parts.push(TONE_BY_DAY.weekend ?? "");
  }

  if (tonePreference && tonePreference !== "auto" && USER_TONE_MAP[tonePreference]) {
    // La preferenza utente sovrascrive le regole automatiche
    return `## Preferenza tono\n${USER_TONE_MAP[tonePreference] ?? ""}`;
  }

  if (parts.length === 0) return null;
  return `## Tono adattivo\n${parts.join(" ")}`;
}

function buildBaseSystem(locale?: string): string {
  const lang = LOCALE_NAMES[locale?.slice(0, 2) ?? "it"] ?? wendyConfig.prompt.defaultLanguage;
  return `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi SEMPRE in: ${lang}.
Qualsiasi fonte, documento o risultato web in inglese va integrato nella risposta tradotto in ${lang}.
Non riportare mai testo in inglese direttamente — nemmeno citazioni parziali.
Usa un tono caldo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.

${buildWendyVoiceContract()}

Struttura standard delle tue risposte:
1. Riconosci:  mostra che hai capito il messaggio e il contesto
2. Analizza:   dai la tua prospettiva, usa la memoria se pertinente
3. Proponi:    1-3 passi concreti che l'utente può fare
Adatta la struttura in base all'intento (vent salta il passo 3, plan enfatizza azioni).

REGOLE SULL'USO DEI TOOL:
- Non chiamare get_sector_detail o get_profession_detail se i dati sono già nel contesto — usa quelli.
- Non chiamare get_user_context più di una volta per conversazione.
- Non chiamare get_user_objectives più di una volta per turno.
- Per planning: leggi prima (get_user_objectives, get_sector_detail), poi scrivi (save_objective).
- Non usare compare_sectors con un solo settore — usa get_sector_detail.
- open_view termina sempre il turno: non aggiungere altri tool calls dopo.
- get_news_summary è editoriale; get_market_trend è operativo — non usarli per la stessa query.

REGOLE RAG E DATI DI MERCATO (Step 6):
- Per domande su trend di settore, ruoli emergenti, crescita di professioni, skill richieste dal mercato:
  usa SEMPRE search_rag PRIMA di rispondere — non inventare statistiche o percentuali.
- Per ruoli emergenti o segnali di mercato ancora non mainstream: usa get_weak_signals.
- Per l'andamento nel tempo degli annunci di lavoro per un ruolo: usa get_job_posting_trend.
- Per skill complementari o costruire un piano di studio: usa get_skill_cooccurrences.
- Cita sempre la fonte RAG nella risposta con il formato:
  "Secondo [nome fonte], [anno/periodo]..." oppure "Dati [fonte] indicano che..."
- Se search_rag non restituisce chunk con similarity > ${wendyConfig.prompt.ragCitationMinScore}, rispondi:
  "Non ho dati aggiornati sufficienti su questo argomento. Per informazioni recenti consulta
  direttamente il World Economic Forum (weforum.org) o LinkedIn Economic Graph."
- I weak signals sono tendenze emergenti, non certezze — presentali come tali:
  "Stiamo osservando un segnale emergente che suggerisce..." (non "è confermato che").`;
}

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const {
    userContext, personaExamples, documentChunks, webResults,
    cot, userMessage: _userMessage, evalResult, platformChunks = [],
    routeDecision: _routeDecision, behaviorPatterns, routingHistorySummary,
    fallbackInstruction, sessionMessageCount = 0, hasSessionGoal,
    pendingFollowUp, localHour, localDayOfWeek, wendyTonePreference,
  } = opts;

  const sections: string[] = [buildBaseSystem(userContext.locale)];
  const psychProfile = userContext.psychologicalProfile;

  // ── Tono adattivo (Step 7 + cronotype personale) ────────────────────────
  const adaptiveTone = buildAdaptiveTone({
    journeyType:          userContext.journeyType ?? undefined,
    localHour,
    localDayOfWeek,
    tonePreference:       wendyTonePreference,
    chronotype:           psychProfile?.chronotype ?? null,
    chronotypeConfidence: psychProfile?.chronotypeConfidence ?? null,
  });
  if (adaptiveTone) sections.push(adaptiveTone);

  // ── User context ────────────────────────────────────────────────────────
  if (userContext.name || userContext.journeyType || userContext.userMode) {
    const ctx: string[] = [];
    if (userContext.name)        ctx.push(`Nome: ${userContext.name}`);
    if (userContext.journeyType) ctx.push(`Percorso: ${userContext.journeyType}`);
    if (userContext.userMode)    ctx.push(`Modalità: ${userContext.userMode}`);
    if (userContext.objectives?.length) ctx.push(`Obiettivi: ${userContext.objectives.join(", ")}`);
    if (userContext.sectorName)  ctx.push(`Settore: ${userContext.sectorName}`);
    sections.push(`## Profilo utente\n${ctx.join("\n")}`);
  }

  // ── Profilo Psicologico 360° (solo per intent profondi) ─────────────────
  const psychSection = buildPsychologicalProfileSection(psychProfile);
  if (psychSection) sections.push(psychSection);

  // ── Page context (Wendy copilot) ─────────────────────────────────────────
  if (userContext.pageContext && Object.keys(userContext.pageContext).length > 0) {
    sections.push(
      `## Contesto pagina corrente\n` +
      JSON.stringify(userContext.pageContext, null, 2)
    );
  }

  // ── Memory ───────────────────────────────────────────────────────────────
  if (userContext.memorySection) {
    sections.push(userContext.memorySection);
  }

  if (userContext.wendyBrainSection) {
    sections.push(userContext.wendyBrainSection);
  }

  if (userContext.codeGraphSection) {
    sections.push(userContext.codeGraphSection);
  }

  // ── Behavioral patterns + routing history ────────────────────────────────
  const patternLines: string[] = [];
  if (behaviorPatterns && behaviorPatterns.length > 0) {
    const top = behaviorPatterns.slice(0, 5);
    top.forEach((p) => {
      patternLines.push(`  - [${p.patternType}] ${p.description} (confidenza: ${(p.confidence * 100).toFixed(0)}%)`);
    });
  }
  if (routingHistorySummary) {
    patternLines.push("", routingHistorySummary);
  }
  if (patternLines.length > 0) {
    sections.push(
      "## Pattern di comportamento rilevati\n" +
      "L'utente mostra pattern ricorrenti nelle conversazioni:\n" +
      patternLines.join("\n") +
      "\n\nSe l'utente è in modalità 'vent' da più turni consecutivi, riconosci lo sfogo ma proponi delicatamente di passare a un piano concreto." +
      "\nSe l'utente torna sullo stesso tema più volte, sottolinealo con naturalezza (es. 'Ogni volta che parliamo di X torni su questo punto…')."
    );
  }

  // ── Tone section (adaptive voice) ─────────────────────────────────────────
  if (userContext.journeyType) {
    sections.push(buildToneSection(userContext.journeyType));
  }

  // ── Session goal — ask if not set ─────────────────────────────────────────
  if (hasSessionGoal === false && sessionMessageCount <= 3) {
    sections.push(
      "## Obiettivo di sessione non ancora impostato\n" +
      "L'utente non ha ancora dichiarato cosa vuole ottenere oggi. " +
      "Se questa è una delle prime interazioni e non sembra uno sfogo, " +
      "chiedi gentilmente: 'In una frase, cosa vorresti ottenere oggi?' " +
      "NON forzare — se l'utente è in vent/reflect, aspetta."
    );
  }

  // ── Goal progress check (every ~5 messages) ──────────────────────────────
  if (hasSessionGoal === true && sessionMessageCount > 0 && sessionMessageCount % 5 === 0) {
    sections.push(
      "## Verifica progresso obiettivo\n" +
      "Sono passati alcuni messaggi. Se pertinente, fai un breve check: " +
      "riconosci i progressi e chiedi se la conversazione è sulla strada giusta. " +
      "Sii breve — 1-2 frasi."
    );
  }

  // ── Pending follow-up ────────────────────────────────────────────────────
  if (pendingFollowUp) {
    sections.push(
      "## Follow-up in sospeso\n" +
      `Nella sessione precedente l'utente stava lavorando su: "${pendingFollowUp}". ` +
      "Se appropriato e l'argomento è ancora attuale, chiedi com'è andata. " +
      "Non forzare — se l'utente è passato ad altro, lascia perdere."
    );
  }

  // ── Fallback instruction ──────────────────────────────────────────────────
  if (fallbackInstruction) {
    sections.push(
      "## Istruzione speciale\n" +
      fallbackInstruction
    );
  }

  // ── Platform content (authoritative NorthStar content) ───────────────────
  if (platformChunks.length > 0) {
    const platformText = platformChunks
      .map((c, i) => `[PIATTAFORMA ${i + 1}] (${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Contenuti NorthStar (usa questi come riferimento autorevole)\n${platformText}`);
  }

  // ── Persona examples ─────────────────────────────────────────────────────
  if (personaExamples.length > 0) {
    const examples = personaExamples
      .map((c, i) => `[ESEMPIO ${i + 1}]\n${c.content}`)
      .join("\n\n");
    sections.push(`## Esempi di coaching\n${examples}`);
  }

  // ── User documents ────────────────────────────────────────────────────────
  if (documentChunks.length > 0) {
    const docs = documentChunks
      .map((c, i) => `[DOC ${i + 1}] (score: ${c.score.toFixed(2)}, fonte: ${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Documenti rilevanti dell'utente\n${docs}`);
  }

  // ── Web results ───────────────────────────────────────────────────────────
  if (webResults.length > 0) {
    const web = webResults
      .map((c, i) => {
        const title = (c.metadata?.title as string | undefined) ?? c.source;
        return `[WEB ${i + 1}] "${title}" (${c.source})\n${c.content}`;
      })
      .join("\n\n");
    sections.push(
      `## Risultati web\n` +
      `⚠️ I contenuti seguenti potrebbero essere in inglese: integra e traduci in italiano prima di includerli nella risposta. Cita le fonti con il loro titolo, non l'URL.\n\n${web}`
    );
  }

  // ── Chain of Thought ──────────────────────────────────────────────────────
  if (cot) {
    const actions = cot.controllableActions
      .map((a, i) => `   ${i + 1}. ${a}`)
      .join("\n");
    sections.push(
      `## Ragionamento preliminare\n` +
      `Pattern rilevato: ${cot.limitingPattern}\n` +
      `Angolo cieco: ${cot.blindSpot}\n` +
      `Azioni suggerite:\n${actions}`
    );
  }

  // ── Eval guidance ────────────────────────────────────────────────────────
  if (evalResult.level === "low") {
    sections.push(
      `## Nota sulla confidenza\n` +
      `Le fonti disponibili sono limitate (score: ${evalResult.score.toFixed(2)}). ` +
      `Sii trasparente sui limiti della risposta e invita l'utente a fornire più contesto.`
    );
  }

  // ── Generative UI hint ────────────────────────────────────────────────────
  sections.push(
    `## Capacità di rendering UI\n` +
    `Hai accesso a tool di rendering visuale: render_roadmap, render_career_match, ` +
    `render_quiz, render_resource_list, render_action_plan.\n` +
    `Usali quando il contenuto è strutturato e visivamente più utile del testo. ` +
    `Esempi: piani step-by-step → render_roadmap, confronto carriera → render_career_match. ` +
    `NON usarli per risposte conversazionali semplici.`
  );

  return sections.join("\n\n");
}

export function buildVoiceSystemPrompt(name?: string): string {
  const greeting = name ? `Stai parlando con ${name}.` : "";
  return (
    `Sei Wendy, coach vocale di NorthStar. ${greeting}\n` +
    `${buildWendyVoiceContract({ spoken: true })}\n` +
    `Rispondi in italiano con MASSIMO 2-3 frasi brevi e dirette.\n` +
    `Tono caldo, naturale. Nessuna lista o markdown — solo parlato fluido.`
  );
}
