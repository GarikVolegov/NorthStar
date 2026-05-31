import { Button } from "@/components/ui/button";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { MessageCircle } from "lucide-react";

type WendyContextKind = "entry" | "idea" | "analysis" | "recap";

function buildPrompt({
  kind,
  content,
  journeyType,
}: {
  kind: WendyContextKind;
  content: string;
  journeyType?: string | null | undefined;
}) {
  const journey = journeyType ? `percorso ${journeyType}` : "percorso dell'utente";
  if (kind === "recap") {
    return `Analizza questo recap del diario personale nel contesto del ${journey}. Evidenzia pattern, rischi, progressi e 3 prossime azioni concrete:\n\n${content}`;
  }
  if (kind === "idea") {
    return `L'utente ha scritto questa idea nel diario. Valutala nel contesto del ${journey}, proponi come renderla concreta e indica se puo diventare un obiettivo:\n\n${content}`;
  }
  if (kind === "analysis") {
    return `L'utente ha scritto questa analisi settore/investimento. Dai feedback nel contesto del ${journey}, separando opportunita, rischi e domande aperte:\n\n${content}`;
  }
  return `L'utente ha scritto questa riflessione nel diario. Analizzala e dai feedback contestuale al ${journey}, con tono pratico e rispettoso:\n\n${content}`;
}

export function WendyAskButton({
  kind,
  content,
  journeyType,
  label = "Chiedi a Wendy",
  size = "sm",
}: {
  kind: WendyContextKind;
  content: string;
  journeyType?: string | null | undefined;
  label?: string;
  size?: "sm" | "default";
}) {
  const wendy = useOptionalWendy();

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={() => wendy?.ask(buildPrompt({ kind, content, journeyType }))}
      disabled={!wendy || content.trim().length === 0}
      className="min-h-9 rounded-md"
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
