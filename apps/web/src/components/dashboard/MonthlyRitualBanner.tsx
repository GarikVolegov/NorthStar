import { Button } from "@/components/ui/button";
import { useMonthlyRitualActions, type MonthlyRitualCurrent } from "@/hooks/useMonthlyRitual";
import { CheckCircle2, MoonStar, Sparkles } from "lucide-react";

interface MonthlyRitualBannerProps {
  ritual: MonthlyRitualCurrent | undefined;
  forceExpanded?: boolean;
}

export function MonthlyRitualBanner({ ritual, forceExpanded = false }: MonthlyRitualBannerProps) {
  const actions = useMonthlyRitualActions();

  if (!ritual?.active || !ritual.run) return null;

  const completed = ritual.run.status === "challenge_completed";
  const expanded = forceExpanded || ritual.run.status !== "pending";

  return (
    <section className="rounded-lg border border-primary/25 bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MoonStar className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notte della Fondazione
              </p>
              <h2 className="text-base font-bold text-foreground">{ritual.run.routeTitle}</h2>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{ritual.run.routeBody}</p>
          {expanded && (
            <div className="rounded-md border border-border bg-background/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scintilla 24h</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{ritual.run.challengeLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{ritual.run.challengeBody}</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 md:w-52">
          {completed ? (
            <Button type="button" variant="secondary" disabled className="w-full justify-center gap-2 rounded-md">
              <CheckCircle2 className="h-4 w-4" />
              Scintilla completata
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="w-full justify-center gap-2 rounded-md"
                onClick={() => actions.open.mutate()}
                disabled={actions.open.isPending}
              >
                <Sparkles className="h-4 w-4" />
                {ritual.run.status === "pending" ? "Apri il rito" : "Riapri il rito"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center rounded-md"
                onClick={() => actions.complete.mutate()}
                disabled={actions.complete.isPending}
              >
                Completa Scintilla
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
