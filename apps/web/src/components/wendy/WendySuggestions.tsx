import { Button } from "@/components/ui/button";
import { useWendy } from "@/contexts/WendyProvider";
import { Lightbulb, Sparkles } from "lucide-react";

interface Suggestion {
  label: string;
  message: string;
}

interface WendySuggestionsProps {
  suggestions?: Suggestion[];
  pageContext?: string;
  title?: string;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "Cosa posso fare oggi?", message: "Cosa posso fare oggi per migliorare la mia situazione?" },
  { label: "Dammi un consiglio", message: "Dammi un consiglio personalizzato per il mio percorso" },
  { label: "Analizza il mio profilo", message: "Analizza il mio profilo e dimmi cosa posso migliorare" },
];

export function WendySuggestions({ suggestions, pageContext, title }: WendySuggestionsProps) {
  const { ask, open } = useWendy();
  const items = suggestions ?? DEFAULT_SUGGESTIONS;

  if (items.length === 0) return null;

  const handleClick = (message: string) => {
    open();
    const fullMessage = pageContext ? `[Contesto: ${pageContext}] ${message}` : message;
    ask(fullMessage);
  };

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{title}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((suggestion, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => handleClick(suggestion.message)}
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
