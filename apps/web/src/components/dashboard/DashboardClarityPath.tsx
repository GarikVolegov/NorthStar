import { cn } from "@/lib/utils";
import { Check, Compass, Scale, Sparkles, Target } from "lucide-react";
import { Link } from "wouter";
import type { AdaptiveDashboardPhase } from "./dashboard-adaptive-flow";

interface ClarityStep {
  icon: React.ElementType;
  label: string;
  desc: string;
  cta: string;
  href: string;
  done: boolean;
  active: boolean;
}

interface ClarityPathNextAction {
  label: string;
  href: string;
}

export function DashboardClarityPath({
  hasSession,
  savedSectorsCount,
  hasDecided,
  currentPhaseLabel,
  nextAction,
  adaptivePhase,
  priority = "supporting",
  compact = false,
}: {
  hasSession: boolean;
  savedSectorsCount: number;
  hasDecided: boolean;
  currentPhaseLabel?: string | undefined;
  nextAction?: ClarityPathNextAction;
  adaptivePhase?: AdaptiveDashboardPhase | undefined;
  priority?: "primary" | "supporting" | "compact" | undefined;
  compact?: boolean;
}) {
  const rawSteps: ClarityStep[] = [
    {
      icon: Compass,
      label: "Scopri chi sei",
      desc: hasSession ? "Profilo RIASEC completato" : "Fai il test per capire il tuo tipo",
      cta: hasSession ? "Rivedi profilo" : "Inizia il test",
      href: hasSession ? "/risultati/latest" : "/test",
      done: hasSession,
      active: !hasSession,
    },
    {
      icon: Target,
      label: "Scegli settore e ruolo",
      desc: savedSectorsCount > 0
        ? `${savedSectorsCount} ${savedSectorsCount === 1 ? "settore salvato" : "settori salvati"}`
        : "Apri un settore, scegli il ruolo target e poi passa ai lavori reali",
      cta: "Scegli settore e ruolo",
      href: "/settori",
      done: savedSectorsCount >= 3,
      active: hasSession && savedSectorsCount < 3,
    },
    {
      icon: Scale,
      label: "Confronta scelte",
      desc: savedSectorsCount >= 3
        ? "Confronta aree e ruoli prima di impegnarti"
        : "Salva 3+ settori per confrontare aree e ruoli",
      cta: "Confronta",
      href: "/settori",
      done: hasDecided || adaptivePhase === "choose_path" || adaptivePhase === "active_journey",
      active: savedSectorsCount >= 3 && !hasDecided,
    },
    {
      icon: Sparkles,
      label: "Decidi",
      desc: hasDecided ? "Percorso scelto: ora costruisci!" : "Scegli il tuo percorso e parti",
      cta: "Scegli percorso",
      href: "/percorso",
      done: hasDecided,
      active: savedSectorsCount >= 3,
    },
  ];
  const phaseStepIndex: Partial<Record<AdaptiveDashboardPhase, number>> = {
    start_test: 0,
    explore_sectors: 1,
    compare_options: 2,
    choose_path: 3,
  };
  const currentPhaseStep = adaptivePhase ? phaseStepIndex[adaptivePhase] : undefined;
  const steps = rawSteps.map((step, index) => ({
    ...step,
    active: currentPhaseStep !== undefined ? index === currentPhaseStep : step.active,
  }));

  const currentStep = steps.findIndex((s) => s.active && !s.done);
  const completedCount = steps.filter((step) => step.done).length;
  const activeStep = currentStep >= 0 ? steps[currentStep] : steps[steps.length - 1];
  const activeAction = nextAction ?? (activeStep ? { label: activeStep.cta, href: activeStep.href } : undefined);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm",
        priority === "primary" ? "border-primary/35 shadow-primary/10" : "border-border",
        compact ? "p-4" : "p-5",
      )}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mappa della chiarezza
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {currentPhaseLabel ?? activeStep?.label ?? "Prossimo passo"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completedCount} / {steps.length} step completati
            </p>
          </div>
        </div>
        {activeAction && (
          <Link
            href={activeAction.href}
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {activeAction.label}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isCurrent = i === currentStep;
          return (
            <div
              key={step.label}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${step.label}${isCurrent ? " step attivo" : ""}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                step.done && "border-primary/20 bg-primary/5",
                isCurrent && !step.done && "border-primary/30 bg-primary/8",
                !step.done && !isCurrent && "border-border bg-muted/20 opacity-60",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                  step.done && "border-primary/30 bg-primary text-primary-foreground",
                  isCurrent && !step.done && "border-primary/40 bg-primary/10 text-primary",
                  !step.done && !isCurrent && "border-border bg-card text-muted-foreground",
                )}
              >
                {step.done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold leading-tight", step.done ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative hidden sm:block">
        <div className="absolute left-[calc(12.5%)] right-[calc(12.5%)] top-[22px] h-px bg-border" aria-hidden="true" />

        <div className="relative grid grid-cols-4 gap-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isCurrent = i === currentStep;
            return (
              <div
                key={step.label}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${step.label}${isCurrent ? " step attivo" : ""}`}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div
                  className={cn(
                    "relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-sm transition-all duration-300",
                    step.done && "border-primary bg-primary text-primary-foreground shadow-primary/20",
                    isCurrent && !step.done && "border-primary/60 bg-primary/10 text-primary ring-4 ring-primary/10",
                    !step.done && !isCurrent && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5" />}
                </div>

                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-tight",
                      step.done ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                    {step.desc}
                  </p>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold tabular-nums",
                    step.done ? "text-primary" : "text-muted-foreground/50",
                  )}
                >
                  0{i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
