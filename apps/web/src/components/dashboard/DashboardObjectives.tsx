import type { DashboardObjective } from "@/hooks/useDashboardData";
import {
  getObjectiveMacroArea,
  getStrategicProgressPercent,
  isStrategicObjective,
  sortObjectivesByImportance,
} from "@/lib/objectives-presentation";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Circle, Gauge, Target } from "lucide-react";
import { Link } from "wouter";

export function ObjectiveProgressGauge({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md" | "lg";
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const angle = -90 + (clamped / 100) * 180;
  const dimensions = size === "lg" ? "h-32 w-44" : size === "sm" ? "h-20 w-28" : "h-24 w-32";

  return (
    <div className={cn("relative flex items-end justify-center", dimensions)} aria-label={`Progresso obiettivi ${clamped}%`}>
      <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path
          d="M 24 82 A 56 56 0 0 1 136 82"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          className="text-muted"
        />
        <path
          d="M 24 82 A 56 56 0 0 1 136 82"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${clamped} 100`}
          className="text-primary transition-all duration-500"
        />
        <line
          x1="80"
          y1="82"
          x2="80"
          y2="36"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className="origin-[80px_82px] text-foreground transition-transform duration-500"
          style={{ transform: `rotate(${angle}deg)` }}
        />
        <circle cx="80" cy="82" r="7" className="fill-foreground" />
      </svg>
      <span className="relative z-10 mb-1 text-xl font-bold tabular-nums text-foreground">{clamped}%</span>
    </div>
  );
}

function getPathSteps(objectives: DashboardObjective[]) {
  const strategic = sortObjectivesByImportance(objectives.filter(isStrategicObjective));
  if (strategic.length === 0) {
    return [
      { label: "Direzione", done: false },
      { label: "Primo passo", done: false },
      { label: "Progresso", done: false },
    ];
  }

  return strategic.slice(0, 4).map((objective) => ({
    label: objective.text,
    done: objective.completed || objective.progress >= 100,
  }));
}

export function DashboardObjectivesPathCard({ objectives }: { objectives: DashboardObjective[] }) {
  const strategicObjectives = objectives.filter(isStrategicObjective);
  const sortedObjectives = sortObjectivesByImportance(strategicObjectives);
  const progress = getStrategicProgressPercent(strategicObjectives);
  const leadingObjective = sortedObjectives[0] ?? null;
  const leadingMacroArea = leadingObjective ? getObjectiveMacroArea(leadingObjective.category) : null;
  const steps = getPathSteps(strategicObjectives);

  return (
    <Link
      href="/obiettivi"
      aria-label="Apri pagina obiettivi"
      className="group block rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-4">
        <div className="min-h-11 min-w-11 rounded-lg border border-primary/20 bg-primary/10 text-primary flex items-center justify-center">
          <Target className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Direzione</p>
              <h3 className="text-base font-semibold text-foreground">Obiettivi</h3>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {leadingMacroArea ? leadingMacroArea.label : "Definisci il prossimo traguardo principale"}
              </p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>

          <div className="mt-4 flex items-center gap-4">
            <ObjectiveProgressGauge value={progress} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="relative flex items-center justify-between gap-2">
                <div className="absolute left-4 right-4 top-4 h-px bg-border" aria-hidden="true" />
                {steps.map((step, index) => (
                  <div key={`${step.label}-${index}`} className="relative z-10 flex w-1/4 min-w-0 flex-col items-center gap-1">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground",
                        step.done && "border-primary/30 bg-primary text-primary-foreground",
                        index === 0 && !step.done && "border-primary/40 text-primary",
                      )}
                    >
                      {step.done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                    </span>
                    <span className="line-clamp-2 max-w-24 text-center text-[10px] font-medium leading-tight text-muted-foreground">
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" />
                {strategicObjectives.length} obiettivi attivi
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
