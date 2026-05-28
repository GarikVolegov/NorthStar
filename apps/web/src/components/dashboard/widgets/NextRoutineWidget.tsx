import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { ROUTINE_TYPE_LABEL, useRoutines } from "@/hooks/useRoutines";
import { cn } from "@/lib/utils";
import { ArrowRight, Bot, Calendar, Clock3, Settings2, Zap } from "lucide-react";
import { Link } from "wouter";

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[160px]",
  md: "min-h-[220px]",
  lg: "min-h-[260px]",
};

export const ROUTINE_WENDY_PROMPT =
  "Aiutami a configurare una routine personale in NorthStar. Fammi poche domande mirate, proponi la routine migliore per il mio percorso e poi guidami nella configurazione.";

function formatNextRun(nextRunAt: string | null): string {
  if (!nextRunAt) return "Non pianificata";
  const date = new Date(nextRunAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) return "In attesa";
  if (diffH < 1) return "Tra pochi minuti";
  if (diffH < 24) return `Tra ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Tra ${diffD} giorn${diffD === 1 ? "o" : "i"}`;
}

interface Props {
  size: "sm" | "md" | "lg";
}

export function NextRoutineWidget({ size }: Props) {
  const { routines, isLoading } = useRoutines();
  const wendy = useOptionalWendy();

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </Card>
    );
  }

  const activeRoutines = routines.filter((routine) => routine.active);
  const nextRoutine = activeRoutines
    .filter((routine) => routine.nextRunAt !== null)
    .sort((a, b) => {
      const aTime = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity;
      const bTime = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity;
      return aTime - bTime;
    })[0] ?? activeRoutines[0] ?? null;

  const displayName = nextRoutine?.name ?? (nextRoutine ? ROUTINE_TYPE_LABEL[nextRoutine.type] : "");
  const routineType = nextRoutine ? ROUTINE_TYPE_LABEL[nextRoutine.type] ?? nextRoutine.type.replace(/_/g, " ") : null;

  function handleConfigureWithWendy() {
    wendy?.ask(ROUTINE_WENDY_PROMPT);
  }

  return (
    <Card className={cn(SIZE_HEIGHT[size], "overflow-hidden")}>
      <CardHeader className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-primary" />
              Prossima routine
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Automazioni personali guidate da Wendy.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              nextRoutine
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {nextRoutine ? "Attiva" : "Da configurare"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {nextRoutine ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/25 p-3">
              <p className="line-clamp-2 text-sm font-semibold text-foreground">{displayName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{routineType}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border bg-background/60 p-2">
                <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Prossima
                </div>
                <p className="font-semibold text-foreground">{formatNextRun(nextRoutine.nextRunAt)}</p>
              </div>
              <div className="rounded-lg border bg-background/60 p-2">
                <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  Canale
                </div>
                <p className="font-semibold text-foreground">{nextRoutine.outputChannel.replace(/_/g, " ")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Configura la prima routine</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Wendy puo aiutarti a scegliere cosa automatizzare e quando ricevere il prossimo aggiornamento.
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="h-8 gap-1.5" onClick={handleConfigureWithWendy}>
            <Settings2 className="h-3.5 w-3.5" />
            Configura con Wendy
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" asChild>
            <Link href="/routines">
              Gestisci routine <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
