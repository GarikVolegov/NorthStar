import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight, CheckCircle2 } from "lucide-react";
import { ObjectiveRow } from "./ObjectiveRow";
import type { Objective } from "@/hooks/useObjectives";

export function ObjectivesSection({
  objectives,
  objectivesLoading,
}: {
  objectives: Objective[] | undefined;
  objectivesLoading: boolean;
}) {
  const completedCount = objectives?.filter((o) => o.completed).length ?? 0;
  const totalCount = objectives?.length ?? 0;
  const inProgress = objectives?.filter((o) => !o.completed).slice(0, 3) ?? [];

  return (
    <section className="py-10 bg-background border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
              <Target className="w-3.5 h-3.5" /> Il tuo progresso
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              {objectivesLoading ? "Obiettivi" : totalCount > 0 ? `${completedCount} / ${totalCount} obiettivi completati` : "I tuoi obiettivi"}
            </h2>
          </div>
          <Link href="/profilo">
            <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              Gestisci <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {objectivesLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : totalCount === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm mb-3">Non hai ancora obiettivi. Creane uno dal tuo profilo.</p>
            <Link href="/profilo">
              <Button variant="outline" size="sm" className="rounded-xl">Vai al profilo</Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden">
            {totalCount > 0 && (
              <div className="px-5 pt-4 pb-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground font-medium">Avanzamento complessivo</span>
                  <span className="text-xs font-bold text-primary">{Math.round((completedCount / totalCount) * 100)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="px-5 py-2">
              {inProgress.length > 0 ? (
                inProgress.map(obj => <ObjectiveRow key={obj.id} obj={obj} />)
              ) : (
                <p className="py-4 text-center text-sm text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 inline mr-1.5 mb-0.5" />
                  Tutti gli obiettivi completati!
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
