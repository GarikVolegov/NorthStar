import { useOptionalWendy } from "@/contexts/WendyProvider";
import {
  BrainCircuit,
  Compass,
  HelpCircle,
  MapPin,
  MessageCircle,
  Scale,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { AdaptiveDashboardPhase } from "./dashboard-adaptive-flow";

interface WendyPrompt {
  Icon: LucideIcon;
  label: string;
  message: string;
}

const PROMPTS_INDECISO: WendyPrompt[] = [
  {
    Icon: Sparkles,
    label: "Guidami nella Notte della Fondazione",
    message:
      "Guidami nella Notte della Fondazione: aiutami a capire la mia Rotta del Mese e a completare la Scintilla 24h.",
  },
  {
    Icon: BrainCircuit,
    label: "Cosa dice il mio profilo?",
    message:
      "Analizza il mio profilo RIASEC e dimmi a quali tipi di professione sono piu adatto, con esempi concreti.",
  },
  {
    Icon: Scale,
    label: "Confronta due carriere",
    message:
      "Aiutami a confrontare due percorsi professionali diversi in base al mio profilo. Quali pro e contro ha ciascuno?",
  },
  {
    Icon: HelpCircle,
    label: "Ho paura di sbagliare",
    message:
      "Ho paura di prendere la decisione sbagliata sulla mia carriera e di perdere tempo. Come affronti questa situazione? Cosa mi consigli?",
  },
  {
    Icon: Compass,
    label: "Una giornata tipo",
    message:
      "Descrivimi una giornata tipo di lavoro nel settore piu adatto al mio profilo. Voglio capire com'e davvero quel lavoro.",
  },
];

const PHASE_PROMPTS: Partial<Record<AdaptiveDashboardPhase, WendyPrompt>> = {
  start_test: {
    Icon: Target,
    label: "Prepara il test",
    message:
      "Prepararmi al test di orientamento: dimmi come rispondere con sincerita e cosa osservare mentre completo la mappa della chiarezza.",
  },
  explore_sectors: {
    Icon: Compass,
    label: "Scegli 3 settori",
    message:
      "Aiutami a scegliere tre settori da esplorare partendo dal mio profilo e dai risultati della mappa della chiarezza.",
  },
  compare_options: {
    Icon: Scale,
    label: "Confronta le opzioni",
    message:
      "Aiutami a confrontare i settori che ho salvato: voglio capire differenze, rischi, energia richiesta e prossima prova concreta.",
  },
  choose_path: {
    Icon: MapPin,
    label: "Prepara la scelta",
    message:
      "Preparami alla scelta del percorso: aiutami a decidere quale direzione attivare e quali segnali devo controllare prima di confermare.",
  },
};

function getPrompts(adaptivePhase?: AdaptiveDashboardPhase): WendyPrompt[] {
  const phasePrompt = adaptivePhase ? PHASE_PROMPTS[adaptivePhase] : undefined;
  if (!phasePrompt) return PROMPTS_INDECISO;
  return [phasePrompt, ...PROMPTS_INDECISO.filter((prompt) => prompt.label !== phasePrompt.label)];
}

export function DashboardWendyPrompts({
  adaptivePhase,
}: {
  adaptivePhase?: AdaptiveDashboardPhase | undefined;
}) {
  const wendy = useOptionalWendy();
  const prompts = getPrompts(adaptivePhase);

  function handlePrompt(prompt: WendyPrompt) {
    if (!wendy) return;
    wendy.ask(prompt.message);
    wendy.open();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <BrainCircuit className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chiedi a Wendy
          </p>
          <p className="text-xs text-muted-foreground/70">La tua coach AI per l&apos;orientamento</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {prompts.map(({ Icon, ...prompt }) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => handlePrompt({ Icon, ...prompt })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {prompt.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => wendy?.open()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Fai una domanda libera...
        </button>
      </div>
    </div>
  );
}
