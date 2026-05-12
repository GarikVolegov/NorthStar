import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

interface ScoreStep {
  id: string;
  label: string;
  description: string;
  points: number;
  earned: number;
  done: boolean;
}

interface JourneyScore {
  score: number;
  level: string;
  levelEmoji: string;
  steps: ScoreStep[];
  totalEarned: number;
  totalPossible: number;
}

function ScoreArc({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? "hsl(var(--chart-2))" : score >= 65 ? "hsl(var(--chart-2))" : score >= 45 ? "hsl(var(--chart-1))" : score >= 25 ? "hsl(var(--chart-5) / 0.7)" : "hsl(var(--muted-foreground))";

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="112" height="112">
        <circle cx="56" cy="56" r={r} stroke="hsl(var(--foreground) / 0.05)" strokeWidth="7" fill="none" />
        <circle
          cx="56" cy="56" r={r}
          stroke={color} strokeWidth="7" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-bold text-foreground">{score}</div>
        <div className="text-[10px] text-muted-foreground font-medium">/ 100</div>
      </div>
    </div>
  );
}

export function JourneyScoreWidget({ userId, compact = false }: { userId: number; compact?: boolean }) {
  const { data, isLoading } = useQuery<JourneyScore>({
    queryKey: ["journey-score", userId],
    queryFn: async () => {
      const r = await fetch(`${BASE}api/journey-score/${userId}`);
      return r.json();
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="h-24 bg-card border border-border rounded-2xl animate-pulse" />;
  }
  if (!data) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
        <div className="text-2xl">{data.levelEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salute Percorso</span>
            <span className="text-sm font-bold text-primary">{data.score}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${data.score}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">{data.level}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-foreground">Salute del Percorso</h3>
          <p className="text-xs text-muted-foreground">Quanto è completo il tuo cammino su NorthStar</p>
        </div>
        <Link href="/profilo" className="text-xs text-primary hover:underline flex items-center gap-1">
          Dettagli <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-center gap-6 mb-5">
        <ScoreArc score={data.score} />
        <div>
          <div className="text-2xl mb-0.5">{data.levelEmoji}</div>
          <div className="font-bold text-foreground">{data.level}</div>
          <div className="text-sm text-muted-foreground">{data.totalEarned} / {data.totalPossible} punti</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-3">
            {step.done
              ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <span className={cn("text-xs font-medium", step.done ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">+{step.earned}/{step.points}pt</span>
          </div>
        ))}
      </div>
    </div>
  );
}
