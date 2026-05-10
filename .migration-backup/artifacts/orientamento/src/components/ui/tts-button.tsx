import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { useTTS } from "@/hooks/useTTS";
import { cn } from "@/lib/utils";

interface TTSButtonProps {
  text: string;
  lang?: string;
  className?: string;
  size?: "sm" | "md";
}

export function TTSButton({ text, lang = "it-IT", className, size = "sm" }: TTSButtonProps) {
  const { speaking, paused, toggle, stop, supported } = useTTS();

  if (!supported) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => toggle(text, lang)}
        title={speaking && !paused ? "Metti in pausa" : paused ? "Riprendi" : "Ascolta articolo"}
        className={cn(
          "flex items-center gap-1.5 rounded-full border transition-all font-medium",
          size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
          speaking
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-card border-border text-muted-foreground hover:text-primary hover:border-primary/30"
        )}
      >
        {speaking && !paused
          ? <><Pause className="h-3 w-3" /> Pausa</>
          : paused
          ? <><Play className="h-3 w-3" /> Riprendi</>
          : <><Volume2 className="h-3 w-3" /> Ascolta</>
        }
      </button>
      {speaking && (
        <button
          onClick={stop}
          title="Ferma"
          className="p-1 rounded-full text-muted-foreground hover:text-destructive transition-colors"
        >
          <VolumeX className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
