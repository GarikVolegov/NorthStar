import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { ArrowRight, Target } from "lucide-react";
import { Link } from "wouter";

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[120px]",
  md: "min-h-[200px]",
  lg: "min-h-[280px]",
};

interface Props {
  size: "sm" | "md" | "lg";
}

export function ProgressObjectivesWidget({ size }: Props) {
  const { data, isLoading } = useDashboardData();

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
        </div>
      </Card>
    );
  }

  const objectives = (data?.objectives ?? [])
    .filter((o) => !o.completed)
    .slice(0, 3);

  return (
    <Card className={cn(SIZE_HEIGHT[size])}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" />
          Obiettivi in corso
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {objectives.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun obiettivo attivo. Aggiungine uno!</p>
        ) : (
          <div className="space-y-3">
            {objectives.map((objective) => (
              <div key={objective.id}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-foreground line-clamp-1 max-w-[80%]">
                    {objective.text}
                  </p>
                  <span className="text-xs text-muted-foreground">{objective.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${objective.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/obiettivi"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Vai agli obiettivi <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
