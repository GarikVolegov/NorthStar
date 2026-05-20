import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const LOADING_MESSAGES = [
  "Analizzo il tuo profilo RIASEC…",
  "Confronto con 28 settori di mercato…",
  "Calcolo le professioni più adatte…",
  "Valuto i percorsi formativi…",
  "Preparo i tuoi insights personalizzati…",
];

export function AgentLoadingSkeleton() {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-primary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium transition-all">{LOADING_MESSAGES[msgIndex]}</span>
      </div>
      <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[grow_25s_ease-in-out_forwards]" />
      </div>
    </div>
  );
}
