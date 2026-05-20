import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Share2,
  Star,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";

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
  userId: number;
  name: string;
  score: number;
  level: string;
  levelEmoji: string;
  steps: ScoreStep[];
  totalEarned: number;
  totalPossible: number;
  isPublic: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 85
      ? "hsl(var(--chart-2))"
      : score >= 65
        ? "hsl(var(--chart-2))"
        : score >= 45
          ? "hsl(var(--chart-1))"
          : "hsl(25 95% 55%)";

  return (
    <div className="relative w-48 h-48 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 -rotate-90" width="192" height="192">
        <circle
          cx="96"
          cy="96"
          r={r}
          stroke="hsl(var(--foreground) / 0.04)"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="96"
          cy="96"
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s ease" }}
        />
      </svg>
      <div className="text-center">
        <div className="text-5xl font-black text-foreground">{score}</div>
        <div className="text-sm text-muted-foreground font-medium">su 100</div>
      </div>
    </div>
  );
}

export default function ScoreCard() {
  const { userId } = useParams<{ userId: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<JourneyScore>({
    queryKey: ["journey-score", userId],
    queryFn: async () => {
      const r = await apiFetch(`${BASE}api/journey-score/${userId}`);
      if (!r.ok) throw new Error("Score non trovato");
      return r.json();
    },
    enabled: !!userId,
  });

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (navigator.share && data) {
      await navigator.share({
        title: `${data.name} — NorthStar Score`,
        text: `Ho raggiunto ${data.score}/100 su NorthStar! Livello: ${data.levelEmoji} ${data.level}`,
        url: window.location.href,
      });
    } else {
      copyLink();
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">🌑</div>
        <h1 className="text-2xl font-bold text-foreground">
          Score non disponibile
        </h1>
        <p className="text-muted-foreground">
          Questo profilo è privato o non esiste.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Torna alla home
          </Button>
        </Link>
      </div>
    );
  }

  if (!data.isPublic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold text-foreground">Profilo privato</h1>
        <p className="text-muted-foreground">
          Questo utente ha mantenuto privato il suo percorso.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-full gap-2">
            <ArrowLeft className="h-4 w-4" /> Scopri NorthStar
          </Button>
        </Link>
      </div>
    );
  }

  const levelColor =
    data.score >= 85
      ? "text-primary"
      : data.score >= 65
        ? "text-primary"
        : data.score >= 45
          ? "text-amber-400"
          : "text-orange-400";

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden bg-card border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 max-w-2xl py-16 text-center relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors"
          >
            <img src="/logo.svg" className="h-5 w-5" alt="NorthStar" />
            NorthStar
          </Link>

          <div className="mb-6">
            <ScoreRing score={data.score} />
          </div>

          <div className={cn("text-4xl font-black mb-1", levelColor)}>
            {data.levelEmoji} {data.level}
          </div>
          <h1 className="text-xl font-semibold text-foreground mt-2 mb-1">
            {data.name}
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            NorthStar Score — Piano di orientamento professionale
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button onClick={share} className="rounded-full gap-2">
              <Share2 className="h-4 w-4" />
              Condividi
            </Button>
            <Button
              variant="outline"
              onClick={copyLink}
              className="rounded-full gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiato!" : "Copia link"}
            </Button>
          </div>
        </div>
      </div>

      {/* Steps breakdown */}
      <div className="container mx-auto px-4 max-w-2xl py-10">
        <h2 className="text-lg font-bold text-foreground mb-5">
          Dettaglio percorso
        </h2>
        <div className="space-y-3">
          {data.steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border transition-all",
                step.done
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "font-semibold text-sm",
                    step.done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
              <div
                className={cn(
                  "text-sm font-bold shrink-0",
                  step.done ? "text-primary" : "text-muted-foreground/40",
                )}
              >
                {step.earned}/{step.points}pt
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <Star className="h-8 w-8 text-primary mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground mb-2">
            Scopri il tuo NorthStar Score
          </h3>
          <p className="text-muted-foreground text-sm mb-6">
            Orientamento professionale guidato dall'AI. Test RIASEC, settori,
            obiettivi e molto altro.
          </p>
          <Link href="/registra">
            <Button size="lg" className="rounded-full px-8">
              Inizia gratis →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
