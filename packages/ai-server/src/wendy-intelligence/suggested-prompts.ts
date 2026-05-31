import type { WendyDecision, WendySuggestedPrompt } from "./types";

function isEnglish(locale: string | undefined): boolean {
  return locale?.toLowerCase().startsWith("en") ?? false;
}

function limit(prompts: WendySuggestedPrompt[]): WendySuggestedPrompt[] {
  const seen = new Set<string>();
  return prompts
    .filter((item) => item.label.trim() && item.prompt.trim())
    .filter((item) => {
      const key = item.prompt.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function buildWendySuggestedPrompts(input: {
  decision?: WendyDecision | null | undefined;
  locale?: string | undefined;
}): WendySuggestedPrompt[] {
  const en = isEnglish(input.locale);
  const strategy = input.decision?.dataStrategy ?? "none";
  const mode = input.decision?.mode ?? "reply_now";

  if (en) {
    if (strategy === "profile_market") {
      return limit([
        { label: "Choose sector", prompt: "Choose the best sector for me now and prepare the first exploration step." },
        { label: "Build proof", prompt: "Create a 7-day proof plan for the sector you selected." },
        { label: "Set monitor", prompt: "Set up a weekly monitor for this sector and include AI impact signals." },
      ]);
    }
    if (strategy === "profile") {
      return limit([
        { label: "Next plan", prompt: "Choose my best next action for today and turn it into a 25-minute execution plan." },
        { label: "Update progress", prompt: "Analyze my progress and prepare the objective update I should confirm." },
        { label: "Create objective", prompt: "Create a small measurable objective from this next step and ask me to confirm it." },
      ]);
    }
    if (strategy === "market") {
      return limit([
        { label: "Pick opportunity", prompt: "Choose the most actionable opportunity from this market signal and prepare my first step." },
        { label: "Create shortlist", prompt: "Create a shortlist of sectors from this trend and rank them for action." },
        { label: "Apply to profile", prompt: "Apply this market signal to my profile and propose the objective to create." },
      ]);
    }
    if (mode === "routine") {
      return limit([
        { label: "Set monitor", prompt: "Set up a weekly monitor for this topic." },
        { label: "Report format", prompt: "Show me what the weekly report would include." },
        { label: "First check", prompt: "Run the first check now before scheduling it." },
      ]);
    }
    return limit([
      { label: "Start path", prompt: "Choose the best starting step for me in NorthStar and guide me through it." },
      { label: "Today", prompt: "Choose what I should do today and make it executable in 25 minutes." },
      { label: "Analyze profile", prompt: "Analyze my profile and prepare the next objective to confirm." },
    ]);
  }

  if (strategy === "profile_market") {
    return limit([
      { label: "Scegli settore", prompt: "Scegli ora il settore migliore per me dalla lista settori e prepara il primo passo di esplorazione." },
      { label: "Costruisci prova", prompt: "Costruisci un piano prova di 7 giorni per il settore che hai scelto." },
      { label: "Imposta monitor", prompt: "Imposta un monitoraggio settimanale su questo settore includendo segnali di impatto AI." },
    ]);
  }
  if (strategy === "profile") {
    return limit([
      { label: "Parti oggi", prompt: "Scegli la migliore azione di oggi e trasformala in un piano eseguibile da 25 minuti." },
      { label: "Aggiorna progressi", prompt: "Analizza i miei progressi e prepara l'aggiornamento obiettivo da confermare." },
      { label: "Crea obiettivo", prompt: "Crea un obiettivo piccolo e misurabile da questo prossimo passo e chiedimi conferma." },
    ]);
  }
  if (strategy === "market") {
    return limit([
      { label: "Scegli opportunita", prompt: "Scegli l'opportunita piu azionabile da questo segnale e prepara il mio primo passo." },
      { label: "Crea shortlist", prompt: "Crea una shortlist di settori da questo trend e ordinali per azione." },
      { label: "Applica al profilo", prompt: "Applica questo segnale al mio profilo e proponi l'obiettivo da creare." },
    ]);
  }
  if (mode === "routine") {
    return limit([
      { label: "Monitora", prompt: "Imposta un monitoraggio settimanale per questo tema." },
      { label: "Formato report", prompt: "Mostrami cosa includerebbe il report settimanale." },
      { label: "Prima verifica", prompt: "Esegui ora la prima verifica prima di programmarla." },
    ]);
  }
  return limit([
    { label: "Inizia percorso", prompt: "Scegli il miglior primo passo per me in NorthStar e guidami nell'esecuzione." },
    { label: "Oggi operativo", prompt: "Scegli cosa devo fare oggi e rendilo eseguibile in 25 minuti." },
    { label: "Prepara obiettivo", prompt: "Analizza il mio profilo e prepara il prossimo obiettivo da confermare." },
  ]);
}
