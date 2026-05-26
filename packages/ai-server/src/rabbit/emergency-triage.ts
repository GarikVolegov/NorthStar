export type TriageResult =
  | { isEmergency: false }
  | { isEmergency: true; matchedSignals: string[]; responseText: string };

const EMERGENCY_RESPONSE = `ATTENZIONE: I sintomi che descrivi possono indicare un'EMERGENZA per il tuo coniglio.

I conigli nascondono il dolore e peggiorano rapidamente. La stasi gastrointestinale (blocco intestinale) può essere fatale in 12-24 ore.

Cosa fare ORA:
1. Chiama subito un veterinario esperto in esotici/lagomorfi
2. Non aspettare di vedere "se passa"
3. Se il tuo vet non è disponibile, vai al pronto soccorso veterinario più vicino

Posso aiutarti a trovare informazioni sui sintomi specifici dopo che hai contattato un veterinario.`;

// Red signals: any single match triggers emergency
const RED_SIGNALS: Array<{ name: string; pattern: RegExp }> = [
  { name: "anorexia_duration",   pattern: /non (mangia|beve).{0,20}([4-9]|[1-9][0-9])\s*(ore|h\b)|da\s+([4-9]|[1-9][0-9])\s*(ore|h\b).{0,20}non (mangia|beve)|smesso di mangiare|rifiuta.{0,10}cibo|non tocca.{0,10}cibo/i },
  { name: "no_feces",            pattern: /non (defeca|va di corpo)|niente (feci|cacche|pallini)|no[n]?\s*(feci|cacche|pallini)/i },
  { name: "bloated_abdomen",     pattern: /addome (gonfio|rigido|duro|disteso)|pancia (gonfia|dura|rigida|distesa)|timpani(smo|ta)?/i },
  { name: "bruxism",             pattern: /bruxismo|stride.{0,5}denti|stridor.{0,5}denti|grind.{0,5}denti/i },
  { name: "head_tilt",           pattern: /testa (storta|inclinata|girata|pendente)|torcicollo|head tilt|inclina.{0,10}testa/i },
  { name: "respiratory",         pattern: /respira.{0,10}male|difficolt.{0,10}respir|boccheggia|rantoli|affanno/i },
  { name: "seizure",             pattern: /convulsion[ei]|attacco epilett/i },
  { name: "toxic_ingestion",     pattern: /ha mangiato.{0,30}(ciclamino|azalea|oleandro|mughetto|digitale|tasso|agrifoglio|glicine|stramonio)|avvelenamento|ingestione.{0,10}tossic/i },
  { name: "blood_urine",         pattern: /sangue.{0,10}urin|ematuria|sanguina/i },
  { name: "gi_stasis_direct",    pattern: /stasi.{0,10}intestinal|stasi.{0,5}gi|ileus/i },
  { name: "not_moving",          pattern: /non si alza|non si muove.{0,20}(ore|giorni?|giorno)|collassa/i },
];

// Amber signals: need 2+ to trigger emergency
const AMBER_SIGNALS: Array<{ name: string; pattern: RegExp }> = [
  { name: "lethargy",            pattern: /letargi|apatico|coniglio.{0,10}pigro|pigro.{0,10}coniglio/i },
  { name: "reduced_appetite",    pattern: /mangia poco|mangia meno|scarso appetito|quasi niente/i },
  { name: "hunched",             pattern: /rannicchiato|posizione storta|posizione raccolta/i },
  { name: "reduced_feces",       pattern: /poche feci|feci ridotte|pallini piccoli|meno feci/i },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function checkRabbitEmergency(message: string): TriageResult {
  const text = normalize(message);
  const matched: string[] = [];

  for (const signal of RED_SIGNALS) {
    if (signal.pattern.test(text)) {
      return {
        isEmergency: true,
        matchedSignals: [signal.name],
        responseText: EMERGENCY_RESPONSE,
      };
    }
  }

  for (const signal of AMBER_SIGNALS) {
    if (signal.pattern.test(text)) {
      matched.push(signal.name);
    }
  }

  if (matched.length >= 2) {
    return {
      isEmergency: true,
      matchedSignals: matched,
      responseText: EMERGENCY_RESPONSE,
    };
  }

  return { isEmergency: false };
}
