type QuickActionKind = "today" | "profile" | "sectors" | "progress" | "complete";

type SuggestedPrompt = {
  label: string;
  prompt: string;
};

function normalize(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wantsEnglish(locale: unknown): boolean {
  return typeof locale === "string" && locale.toLowerCase().startsWith("en");
}

function uniqueLimit(prompts: SuggestedPrompt[]): SuggestedPrompt[] {
  const seen = new Set<string>();
  return prompts
    .filter((prompt) => prompt.label.trim() && prompt.prompt.trim())
    .filter((prompt) => {
      const key = prompt.prompt.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

/**
 * Classifica un messaggio in una quick action nota. Usato SOLO per proporre
 * suggested prompts (chip di navigazione) — mai per generare una risposta
 * prescritta: la risposta vera la produce sempre l'LLM ragionando sui dati/tool.
 */
export function classifyWendyDataBackedQuickAction(message: string): QuickActionKind | null {
  const normalized = normalize(message);
  if (
    /\b(segna|marca|metti|imposta)\b.*\b(completat\w*|completa|fatto|finita|finito)\b/.test(normalized) ||
    /\b(attivita|azione|task|obiettivo)\b.*\b(completat\w*|fatto|finita|finito)\b/.test(normalized) ||
    /\b(mark|set)\b.*\b(done|complete|completed)\b/.test(normalized)
  ) return "complete";
  if (/\b(analizza|analyze)\b.*\b(progress|progressi)\b/.test(normalized)) return "progress";
  if (
    (normalized.includes("profilo") || normalized.includes("profile")) &&
    (normalized.includes("prossima mossa") || normalized.includes("next move") || normalized.includes("analizza") || normalized.includes("analyze"))
  ) {
    return "profile";
  }
  if (
    (normalized.includes("settori") || normalized.includes("settore") || normalized.includes("sectors") || normalized.includes("sector")) &&
    (/\badatt/.test(normalized) || normalized.includes("fit") || normalized.includes("scelgo") || normalized.includes("scegliere") || normalized.includes("choose"))
  ) return "sectors";
  if (
    /\b(cosa|che)\b.*\b(fare|faccio)\b.*\b(oggi|domani|settimana)\b/.test(normalized) ||
    /\b(what|which)\b.*\b(do|should)\b.*\b(today|tomorrow|week)\b/.test(normalized) ||
    /\bprossim[ao]\b.*\b(azion\w*|pass\w*|moss\w*)\b/.test(normalized) ||
    /\bnext\b.*\b(step|action|move)\b/.test(normalized)
  ) return "today";
  return null;
}

export function buildWendyDataBackedSuggestedPrompts(input: {
  kind: QuickActionKind;
  locale?: string | undefined;
}): SuggestedPrompt[] {
  const english = wantsEnglish(input.locale);

  if (english) {
    if (input.kind === "today") {
      return uniqueLimit([
        { label: "Update objective", prompt: "Update the objective I should move forward today and prepare the next 25-minute step." },
        { label: "Build plan", prompt: "Turn today's priority into a 25-minute execution plan with one measurable outcome." },
        { label: "Recheck progress", prompt: "Analyze my progress after this step and tell me what to postpone." },
      ]);
    }
    if (input.kind === "profile") {
      return uniqueLimit([
        { label: "Analyze profile", prompt: "Analyze my profile and choose the most useful next move for today." },
        { label: "Pick sector", prompt: "Use my profile to pick one sector to explore for 30 minutes." },
        { label: "Create objective", prompt: "Create a measurable objective from this profile insight and ask me to confirm it." },
      ]);
    }
    if (input.kind === "sectors") {
      return uniqueLimit([
        { label: "Compare sectors", prompt: "Compare the best-fit sectors for my profile and rank them by actionability." },
        { label: "Open best fit", prompt: "Open the sector with the best personal fit and prepare the first exploration step." },
        { label: "Build proof", prompt: "Create a 7-day proof plan for the sector that fits me best." },
      ]);
    }
    if (input.kind === "complete") {
      return uniqueLimit([
        { label: "Confirm progress", prompt: "Confirm the completed activity and update the linked objective progress." },
        { label: "Choose next", prompt: "Now that this activity is complete, choose the next useful step." },
        { label: "Review blockers", prompt: "Review what changed after completing this activity and remove one blocker." },
      ]);
    }
    return uniqueLimit([
      { label: "Update progress", prompt: "Analyze my current objectives and prepare the progress update I should confirm." },
      { label: "Find blocker", prompt: "Find the objective that is most blocked and suggest one micro-step to unblock it." },
      { label: "Plan next", prompt: "Choose the next objective step and turn it into a 25-minute plan." },
    ]);
  }

  if (input.kind === "today") {
    return uniqueLimit([
      { label: "Aggiorna obiettivo", prompt: "Aggiorna l'obiettivo che dovrei avanzare oggi e prepara il prossimo passo da 25 minuti." },
      { label: "Piano da 25 minuti", prompt: "Trasforma la priorita di oggi in un piano da 25 minuti con un risultato misurabile." },
      { label: "Ricalibra priorita", prompt: "Analizza i progressi dopo questo passo e dimmi cosa rimandare." },
    ]);
  }
  if (input.kind === "profile") {
    return uniqueLimit([
      { label: "Analizza profilo", prompt: "Analizza il mio profilo e scegli la prossima mossa piu utile per oggi." },
      { label: "Scegli settore", prompt: "Usa il mio profilo per scegliere un settore da esplorare per 30 minuti." },
      { label: "Crea obiettivo", prompt: "Crea un obiettivo misurabile da questo insight di profilo e chiedimi conferma." },
    ]);
  }
  if (input.kind === "sectors") {
    return uniqueLimit([
      { label: "Confronta settori", prompt: "Confronta i settori piu adatti al mio profilo e ordinali per azionabilita." },
      { label: "Apri fit migliore", prompt: "Apri il settore con il miglior fit personale e prepara il primo passo di esplorazione." },
      { label: "Costruisci prova", prompt: "Crea un piano prova di 7 giorni per il settore piu adatto a me." },
    ]);
  }
  if (input.kind === "complete") {
    return uniqueLimit([
      { label: "Conferma progresso", prompt: "Conferma l'attivita completata e aggiorna i progressi dell'obiettivo collegato." },
      { label: "Scegli prossimo", prompt: "Ora che questa attivita e completata, scegli il prossimo passo utile." },
      { label: "Rivedi blocchi", prompt: "Rivedi cosa e cambiato dopo questa attivita e togli un blocco." },
    ]);
  }
  return uniqueLimit([
    { label: "Aggiorna progressi", prompt: "Analizza i miei obiettivi attuali e prepara l'aggiornamento progresso da confermare." },
    { label: "Trova blocco", prompt: "Trova l'obiettivo piu bloccato e suggerisci un micro-step per sbloccarlo." },
    { label: "Pianifica prossimo", prompt: "Scegli il prossimo passo dell'obiettivo e trasformalo in un piano da 25 minuti." },
  ]);
}
