import { useOptionalWendy } from "@/contexts/WendyProvider";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
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
import { useTranslation } from "react-i18next";
import type { AdaptiveDashboardPhase } from "./dashboard-adaptive-flow";
import type { AdaptiveSectionPresentation } from "./dashboard-adaptive-flow";

interface WendyPrompt {
  Icon: LucideIcon;
  label: string;
  message: string;
  id: string;
}

const PROMPTS_INDECISO: WendyPrompt[] = [
  {
    Icon: Sparkles,
    id: "foundation_night",
    label: "Guidami nella Notte della Fondazione",
    message:
      "Guidami nella Notte della Fondazione: aiutami a capire la mia Rotta del Mese e a completare la Scintilla 24h.",
  },
  {
    Icon: BrainCircuit,
    id: "profile_meaning",
    label: "Cosa dice il mio profilo?",
    message:
      "Analizza il mio profilo RIASEC e dimmi a quali tipi di professione sono piu adatto, con esempi concreti.",
  },
  {
    Icon: Scale,
    id: "compare_careers",
    label: "Confronta due carriere",
    message:
      "Aiutami a confrontare due percorsi professionali diversi in base al mio profilo. Quali pro e contro ha ciascuno?",
  },
  {
    Icon: HelpCircle,
    id: "fear_wrong_choice",
    label: "Ho paura di sbagliare",
    message:
      "Ho paura di prendere la decisione sbagliata sulla mia carriera e di perdere tempo. Come affronti questa situazione? Cosa mi consigli?",
  },
  {
    Icon: Compass,
    id: "typical_day",
    label: "Una giornata tipo",
    message:
      "Descrivimi una giornata tipo di lavoro nel settore piu adatto al mio profilo. Voglio capire com'e davvero quel lavoro.",
  },
];

const PHASE_PROMPTS: Partial<Record<AdaptiveDashboardPhase, WendyPrompt>> = {
  start_test: {
    Icon: Target,
    id: "start_test",
    label: "Prepara il test",
    message:
      "Prepararmi al test di orientamento: dimmi come rispondere con sincerita e cosa osservare mentre completo la mappa della chiarezza.",
  },
  explore_sectors: {
    Icon: Compass,
    id: "explore_sectors",
    label: "Scegli settore e ruolo",
    message:
      "Aiutami a scegliere settore e ruolo target da esplorare partendo dal mio profilo, dai risultati della mappa della chiarezza e dai segnali di mercato.",
  },
  compare_options: {
    Icon: Scale,
    id: "compare_options",
    label: "Confronta le opzioni",
    message:
      "Aiutami a confrontare i settori che ho salvato: voglio capire differenze, rischi, energia richiesta e prossima prova concreta.",
  },
  choose_path: {
    Icon: MapPin,
    id: "choose_path",
    label: "Prepara la scelta",
    message:
      "Preparami alla scelta del percorso: aiutami a decidere quale direzione attivare e quali segnali devo controllare prima di confermare.",
  },
  active_journey: {
    Icon: Target,
    id: "active_journey",
    label: "Pianifica il prossimo passo",
    message:
      "Aiutami a scegliere la prossima azione pratica del mio percorso attivo: cosa faccio oggi, cosa tengo d'occhio e quale risultato mi dice che sto avanzando.",
  },
};

function getPrompts(adaptivePhase?: AdaptiveDashboardPhase): WendyPrompt[] {
  const phasePrompt = adaptivePhase ? PHASE_PROMPTS[adaptivePhase] : undefined;
  if (!phasePrompt) return PROMPTS_INDECISO;
  return [phasePrompt, ...PROMPTS_INDECISO.filter((prompt) => prompt.id !== phasePrompt.id)];
}

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
}

function WendyPromptButton({
  prompt,
  locale,
  onAsk,
}: {
  prompt: WendyPrompt;
  locale: string;
  onAsk: (message: string) => void;
}) {
  const { Icon } = prompt;
  const label = useDynamicTranslation({
    locale,
    key: `dashboard.wendyPrompts.prompts.${prompt.id}.label`,
    source: prompt.label,
    context: "Dashboard Wendy prompt button label",
  });
  const message = useDynamicTranslation({
    locale,
    key: `dashboard.wendyPrompts.prompts.${prompt.id}.message`,
    source: prompt.message,
    context: "Prompt sent to Wendy from the dashboard quick prompt button. Keep it written as the user asking Wendy directly.",
  });

  return (
    <button
      type="button"
      onClick={() => onAsk(message)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

export function DashboardWendyPrompts({
  adaptivePhase,
  presentation,
}: {
  adaptivePhase?: AdaptiveDashboardPhase | undefined;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  const locale = useDashboardLocale();
  const wendy = useOptionalWendy();
  const prompts = getPrompts(adaptivePhase);
  const visiblePrompts = presentation?.priority === "compact" ? prompts.slice(0, 3) : prompts;
  const kicker = useDynamicTranslation({
    locale,
    key: "dashboard.wendyPrompts.kicker",
    source: "Chiedi a Wendy",
    context: "Dashboard Wendy quick prompts widget kicker",
  });
  const subtitle = useDynamicTranslation({
    locale,
    key: "dashboard.wendyPrompts.subtitle",
    source: "La tua coach AI per l'orientamento",
    context: "Dashboard Wendy quick prompts widget subtitle",
  });
  const freeQuestionLabel = useDynamicTranslation({
    locale,
    key: "dashboard.wendyPrompts.freeQuestion",
    source: "Fai una domanda libera...",
    context: "Dashboard Wendy quick prompts free question button",
  });

  function handlePrompt(message: string) {
    if (!wendy) return;
    wendy.ask(message);
    wendy.open();
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm",
        presentation?.priority === "primary" ? "border-primary/35 p-5 shadow-primary/10" : "border-border p-5",
        presentation?.priority === "compact" && "p-4",
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <BrainCircuit className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {kicker}
          </p>
          <p className="text-xs text-muted-foreground/70">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {visiblePrompts.map((prompt) => (
          <WendyPromptButton
            key={prompt.id}
            prompt={prompt}
            locale={locale}
            onAsk={handlePrompt}
          />
        ))}

        <button
          type="button"
          onClick={() => wendy?.open()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {freeQuestionLabel}
        </button>
      </div>
    </div>
  );
}
