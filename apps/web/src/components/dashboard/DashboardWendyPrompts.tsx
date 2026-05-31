import { useOptionalWendy } from "@/contexts/WendyProvider";
import { BrainCircuit, MessageCircle } from "lucide-react";

interface WendyPrompt {
  emoji: string;
  label: string;
  message: string;
}

const PROMPTS_INDECISO: WendyPrompt[] = [
  {
    emoji: "✦",
    label: "Guidami nella Notte della Fondazione",
    message:
      "Guidami nella Notte della Fondazione: aiutami a capire la mia Rotta del Mese e a completare la Scintilla 24h.",
  },
  {
    emoji: "🧠",
    label: "Cosa dice il mio profilo?",
    message:
      "Analizza il mio profilo RIASEC e dimmi a quali tipi di professione sono più adatto, con esempi concreti.",
  },
  {
    emoji: "⚖️",
    label: "Confronta due carriere",
    message:
      "Aiutami a confrontare due percorsi professionali diversi in base al mio profilo. Quali pro e contro ha ciascuno?",
  },
  {
    emoji: "😰",
    label: "Ho paura di sbagliare",
    message:
      "Ho paura di prendere la decisione sbagliata sulla mia carriera e di perdere tempo. Come affronti questa situazione? Cosa mi consigli?",
  },
  {
    emoji: "☀️",
    label: "Una giornata tipo",
    message:
      "Descrivimi una giornata tipo di lavoro nel settore più adatto al mio profilo. Voglio capire com'è davvero quel lavoro.",
  },
];

export function DashboardWendyPrompts() {
  const wendy = useOptionalWendy();

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
        {PROMPTS_INDECISO.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() => handlePrompt(prompt)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
          >
            <span role="img" aria-hidden="true">{prompt.emoji}</span>
            {prompt.label}
          </button>
        ))}

        {/* Open chat empty */}
        <button
          type="button"
          onClick={() => wendy?.open()}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-all hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Fai una domanda libera…
        </button>
      </div>
    </div>
  );
}
