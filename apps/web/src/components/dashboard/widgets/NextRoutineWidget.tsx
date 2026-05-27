import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoutines } from "@/hooks/useRoutines";
import { cn } from "@/lib/utils";
import { ArrowRight, Calendar, Zap } from "lucide-react";
import { Link } from "wouter";

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[120px]",
  md: "min-h-[200px]",
  lg: "min-h-[280px]",
};

const TYPE_EMOJI: Record<string, string> = {
  job_monitor:      "🔍",
  market_report:    "📊",
  mindset_exercise: "🧠",
  growth_briefing:  "🚀",
  interview_prep:   "🎯",
};

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

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-16 w-full rounded" />
      </Card>
    );
  }

  const activeRoutines = routines.filter((r) => r.active);
  const nextRoutine = activeRoutines
    .filter((r) => r.nextRunAt !== null)
    .sort((a, b) => {
      const aTime = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity;
      const bTime = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity;
      return aTime - bTime;
    })[0] ?? activeRoutines[0] ?? null;

  const displayName = nextRoutine?.name ?? nextRoutine?.type.replace(/_/g, " ") ?? "";

  return (
    <Card className={cn(SIZE_HEIGHT[size])}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Zap className="h-4 w-4 text-primary" />
          Prossima routine
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {nextRoutine ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xl" aria-hidden="true">{TYPE_EMOJI[nextRoutine.type] ?? "⚡"}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground line-clamp-2">{displayName}</p>
                <p className="text-xs text-muted-foreground capitalize">{nextRoutine.type.replace(/_/g, " ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatNextRun(nextRoutine.nextRunAt)}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configura la tua prima routine con Wendy
          </p>
        )}
        <Link
          href="/routines"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Gestisci routine <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
