import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompletionData {
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
  hasWorkPreference: boolean;
  hasCv: boolean;
  hasObjectives: boolean;
}

const STEPS: Array<{
  id: keyof CompletionData;
  label: string;
  description: string;
  href: string;
  points: number;
}> = [
  {
    id: "hasTestSession",
    label: "Completa il test",
    description: "Scopri il tuo profilo RIASEC",
    href: "/test",
    points: 20,
  },
  {
    id: "hasConfirmedSector",
    label: "Conferma un settore",
    description: "Attiva roadmap e coach personalizzati",
    href: "/settori",
    points: 25,
  },
  {
    id: "hasWorkPreference",
    label: "Imposta lo stile lavorativo",
    description: "Autonomo, dipendente o ibrido?",
    href: "/profilo",
    points: 15,
  },
  {
    id: "hasCv",
    label: "Carica il CV",
    description: "Migliora le analisi AI sul tuo profilo",
    href: "/profilo",
    points: 25,
  },
  {
    id: "hasObjectives",
    label: "Crea il primo obiettivo",
    description: "Traccia il tuo percorso di crescita",
    href: "/profilo",
    points: 15,
  },
];

interface Props {
  data: CompletionData;
  className?: string;
}

export function ProfileCompletionCard({ data, className }: Props) {
  const totalPoints = STEPS.reduce((s, step) => s + step.points, 0);
  const earned = STEPS.filter((s) => data[s.id]).reduce(
    (acc, step) => acc + step.points,
    0,
  );
  const pct = Math.round((earned / totalPoints) * 100);
  const nextStep = STEPS.find((s) => !data[s.id]);

  if (pct === 100) return null;

  return (
    <Card className={cn("rounded-2xl border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          Completa il tuo profilo
          <span className="ml-auto text-sm font-bold text-primary">{pct}%</span>
        </CardTitle>
        <div className="h-2 bg-background rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STEPS.map((step) => {
          const done = data[step.id];
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-3 text-sm",
                done && "opacity-50",
              )}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={cn("font-medium", done && "line-through")}>
                  {step.label}
                </span>
                {!done && (
                  <p className="text-xs text-muted-foreground leading-tight">
                    {step.description}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                +{step.points}%
              </span>
            </div>
          );
        })}

        {nextStep && (
          <div className="pt-3 border-t">
            <Link href={nextStep.href}>
              <Button size="sm" className="w-full rounded-xl gap-2">
                Prossimo: {nextStep.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
