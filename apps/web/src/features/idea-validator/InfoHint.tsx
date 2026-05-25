import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

export function InfoHint({
  title,
  meaning,
  example,
  write,
}: {
  title: string;
  meaning: string;
  example: string;
  write: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Spiega ${title}`}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] rounded-2xl">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meaning}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Esempio
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{example}</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{write}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
