import type { DashboardObjective } from "@/hooks/useDashboardData";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import {
  getObjectiveMacroArea,
  getStrategicProgressPercent,
  isStrategicObjective,
  sortObjectivesByImportance,
} from "@/lib/objectives-presentation";
import { cn } from "@/lib/utils";
import { ArrowRight, BookOpen, Check, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const dimensions =
    size === "lg" ? "h-32 w-44" : size === "sm" ? "h-20 w-28" : "h-24 w-32";

  return (
    <div
      className={cn("relative flex items-end justify-center", dimensions)}
      aria-label={`Progresso obiettivi ${clamped}%`}
    >
      <svg
        viewBox="0 0 160 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
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
      <span className="relative z-10 mb-1 text-xl font-bold tabular-nums text-foreground">
        {clamped}%
      </span>
    </div>
  );
}

function getPathSteps(objectives: DashboardObjective[]) {
  const strategic = sortObjectivesByImportance(
    objectives.filter(isStrategicObjective),
  );
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

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage || i18n.language || "it";
}

export function DashboardDiaryBookCard({
  objectives,
}: {
  objectives: DashboardObjective[];
}) {
  const locale = useDashboardLocale();
  const strategicObjectives = objectives.filter(isStrategicObjective);
  const sortedObjectives = sortObjectivesByImportance(strategicObjectives);
  const progress = getStrategicProgressPercent(strategicObjectives);
  const leadingObjective = sortedObjectives[0] ?? null;
  const leadingMacroArea = leadingObjective
    ? getObjectiveMacroArea(leadingObjective.category)
    : null;
  const steps = getPathSteps(strategicObjectives);
  const completedCount = strategicObjectives.filter(
    (objective) => objective.completed || objective.progress >= 100,
  ).length;
  const activeCount = strategicObjectives.length - completedCount;
  const hasStrategicObjectives = strategicObjectives.length > 0;
  const ariaLabel = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.ariaLabel",
    source: "Apri diario e obiettivi",
    context: "Accessible label for the dashboard diary and objectives card link",
  });
  const eyebrow = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.eyebrow",
    source: "Diario personale",
    context: "Dashboard objectives card eyebrow",
  });
  const title = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.title",
    source: "Diario",
    context: "Dashboard objectives card title",
  });
  const fallbackDescription = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.description",
    source: "Riflessioni, idee e obiettivi in un unico spazio",
    context: "Dashboard objectives card fallback description",
  });
  const macroAreaLabel = useDynamicTranslation({
    locale,
    key: `dashboard.objectivesCard.macroAreas.${leadingMacroArea?.key ?? "personal"}.label`,
    source: leadingMacroArea?.label ?? fallbackDescription,
    context: "Dashboard objectives card macro-area label. Keep it user-facing and practical.",
  });
  const progressLabel = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.progressLabel",
    source: "Avanzamento medio",
    context: "Dashboard objectives card progress label",
  });
  const completedLabel = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.completedLabel",
    source: "completati",
    context: "Dashboard objectives card completed objectives count suffix",
  });
  const nextFocus = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.nextFocus",
    source: "Prossimo focus",
    context: "Dashboard objectives card next focus label",
  });
  const activeSingular = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.activeSingular",
    source: "attivo",
    context: "Dashboard objectives card active objectives singular suffix",
  });
  const activePlural = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.activePlural",
    source: "attivi",
    context: "Dashboard objectives card active objectives plural suffix",
  });
  const emptyTitle = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.empty.title",
    source: "Scegli il primo obiettivo strategico",
    context: "Dashboard objectives card empty state title",
  });
  const emptyCopy = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.empty.copy",
    source: "Trasforma una direzione in un traguardo concreto: cosa vuoi ottenere e quale prossimo passo puoi verificare?",
    context: "Dashboard objectives card empty state practical guidance",
  });
  const progressAria = useDynamicTranslation({
    locale,
    key: "dashboard.objectivesCard.progressAria",
    source: `Progresso obiettivi ${progress}%`,
    context: "Dashboard objectives card progress bar accessible label. Keep the percentage unchanged.",
  });

  return (
    <Link
      href="/diario?tab=objectives"
      aria-label={ariaLabel}
      className="group relative block overflow-hidden rounded-lg border border-border bg-card p-4 text-left shadow-sm transition duration-200 hover:border-primary/35 hover:bg-muted/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-4">
        <div
          className="relative h-16 w-14 shrink-0 [perspective:900px]"
          aria-hidden="true"
        >
          <div className="absolute inset-y-1 right-0 w-10 rounded-r-md border border-border bg-background shadow-sm" />
          <div className="absolute inset-y-2 right-1 w-10 rounded-r-md border border-border bg-muted/50" />
          <div
            data-testid="diary-book-cover"
            className="absolute inset-0 flex origin-left items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary shadow-sm shadow-primary/5 transition-transform duration-300 ease-out [backface-visibility:hidden] [transform-style:preserve-3d] group-hover:[transform:rotateY(-28deg)] group-focus-visible:[transform:rotateY(-28deg)] motion-reduce:transition-none motion-reduce:transform-none"
          >
            <BookOpen className="h-5 w-5" />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase leading-none text-muted-foreground">
                {eyebrow}
              </p>
              <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                {title}
              </h3>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {leadingMacroArea ? macroAreaLabel : fallbackDescription}
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>

          {hasStrategicObjectives ? (
            <>
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase leading-none text-muted-foreground">
                      {progressLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {completedCount} / {strategicObjectives.length} {completedLabel}
                    </p>
                  </div>
                  <p className="text-2xl font-bold leading-none tabular-nums text-foreground">
                    {progress}%
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-muted"
                  aria-label={progressAria}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={progress}
                  role="progressbar"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase leading-none text-muted-foreground">
                    {nextFocus}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">
                    {leadingObjective?.text ?? emptyTitle}
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground sm:text-right">
                  {activeCount} {activeCount === 1 ? activeSingular : activePlural}
                </p>
              </div>

              <div className="relative">
                <div
                  className="absolute left-4 right-4 top-3.5 h-px bg-border"
                  aria-hidden="true"
                />
                <div className="relative grid grid-cols-4 gap-2">
                  {steps.map((step, index) => (
                    <div key={`${step.label}-${index}`} className="min-w-0">
                      <span
                        aria-label={step.label}
                        className={cn(
                          "mx-auto flex h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground",
                          step.done &&
                            "border-primary/30 bg-primary text-primary-foreground",
                          index === 0 &&
                            !step.done &&
                            "border-primary/40 text-primary",
                        )}
                      >
                        {step.done ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-3">
              <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{emptyCopy}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export const DashboardObjectivesPathCard = DashboardDiaryBookCard;
