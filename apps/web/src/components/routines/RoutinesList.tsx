import { Skeleton } from "@/components/ui/skeleton";
import type { UserRoutine } from "@/hooks/useRoutines";
import { AlertCircle, Bot } from "lucide-react";
import { RoutineCard } from "./RoutineCard";

interface RoutinesListMeta {
  total:       number;
  activeCount: number;
  plan:        string;
  limit:       number;
  canCreate:   boolean;
}

interface RoutinesListProps {
  routines:       UserRoutine[];
  meta:           RoutinesListMeta;
  isLoading:      boolean;
  onToggleActive: (id: number, active: boolean) => void;
  onDelete:       (id: number) => void;
}

export function RoutinesList({ routines, meta, isLoading, onToggleActive, onDelete }: RoutinesListProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Le tue routine</h2>
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{meta.activeCount}</span>/{meta.limit} attive
        </span>
      </div>

      {/* Plan limit notice */}
      {!meta.canCreate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Hai raggiunto il limite del piano {meta.plan === "free" ? "Free" : meta.plan} ({meta.limit}{" "}
            {meta.limit === 1 ? "routine" : "routine"}). Passa a Pro per aggiungerne altre.
          </p>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && routines.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 px-4 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nessuna routine configurata. Parla con Wendy per impostarne una!
          </p>
        </div>
      )}

      {/* List */}
      {!isLoading && routines.length > 0 && (
        <div className="flex flex-col gap-3">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
