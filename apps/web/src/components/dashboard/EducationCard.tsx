import type { EducationResult } from "@/hooks/useAgentAnalysis";
import { CheckCircle2, Clock, DollarSign } from "lucide-react";

export function EducationCard({ e }: { e: EducationResult }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-foreground leading-snug">{e.path}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{e.type}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {e.duration && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {e.duration}
            </span>
          )}
          {e.cost && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <DollarSign className="w-3 h-3" /> {e.cost}
            </span>
          )}
        </div>
      </div>
      {e.steps && e.steps.length > 0 && (
        <ol className="space-y-1 mb-3">
          {e.steps.slice(0, 3).map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              {step}
            </li>
          ))}
        </ol>
      )}
      {e.careerOutcomes && e.careerOutcomes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {e.careerOutcomes.slice(0, 3).map((o) => (
            <span key={o} className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
