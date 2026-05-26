import type { RetrievedChunk } from "./retriever";
import type { CoTResult }      from "./chain-of-thought";
import type { EvalResult }     from "./self-evaluator";
import type { RouteDecision }  from "./router-agent";
import { buildToneSection }    from "./tone-adapter";
import { buildWendyVoiceContract } from "../wendy-voice";
import { wendyConfig } from "../config/wendy";

export interface UserContext {
  name?:         string | undefined;
  journeyType?:  string | undefined;
  userMode?:     string | undefined;
  objectives?:   string[] | undefined;
  sectorName?:   string | undefined;
  pageContext?:  Record<string, unknown> | undefined;
  memorySection?: string | undefined;
  locale?:       string | undefined;
  isPremium?:    boolean | undefined;
  stripeSubscriptionId?: string | null | undefined;
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

function buildAdaptiveTone(opts: {
  journeyType?:  string | undefined;
  localHour?:             number | undefined;
  localDayOfWeek?:        number | undefined;
  tonePreference?:    string | undefined;
}): string | null {
  const { journeyType, localHour, localDayOfWeek, tonePreference } = opts;
  const parts: string[] = [];

  if (journeyType && TONE_BY_JOURNEY[journeyType]) {
    parts.push(TONE_BY_JOURNEY[journeyType] ?? "");
  }

  if (typeof localHour === "number") {
    const pc = wendyConfig.prompt;
    if (localHour >= pc.morningHourStart && localHour < pc.morningHourEnd) parts.push(TONE_BY_HOUR.morning ?? "");
    else if (localHour >= pc.eveningHourStart && localHour < pc.eveningHourEnd) parts.push(TONE_BY_HOUR.evening ?? "");
    else if (localHour >= pc.nightHourStart || localHour < pc.nightHourEnd) parts.push(TONE_BY_HOUR.night ?? "");
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

  // ── Tono adattivo (Step 7) ──────────────────────────────────────────────
  const adaptiveTone = buildAdaptiveTone({
    journeyType:    userContext.journeyType ?? undefined,
    localHour,
    localDayOfWeek,
    tonePreference: wendyTonePreference,
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
      .map((c, i) => `[WEB ${i + 1}] (${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Risultati web\n${web}`);
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
