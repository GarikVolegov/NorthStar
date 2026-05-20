import type { Objective } from "@/hooks/useObjectives";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";

export function ObjectiveRow({ obj }: { obj: Objective }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className={cn(
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
        obj.completed ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground",
      )}>
        {obj.completed
          ? <CheckCircle2 className="w-4 h-4" />
          : <Circle className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-snug truncate", obj.completed && "line-through text-muted-foreground")}>
          {obj.text}
        </p>
        {!obj.completed && obj.progress > 0 && (
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden w-24">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${obj.progress}%` }} />
          </div>
        )}
      </div>
      {!obj.completed && (
        <span className="shrink-0 text-xs font-semibold text-primary">{obj.progress}%</span>
      )}
    </div>
  );
}
