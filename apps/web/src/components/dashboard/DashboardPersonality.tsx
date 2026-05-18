import { Link } from "wouter";
import { BrainCircuit, Sparkles } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { cn } from "@/lib/utils";

// Chiavi short (R, I, A, S, E, C) usate nel DB
const RIASEC_LABELS: Record<string, string> = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditivo",
  C: "Convenzionale",
};

const SPIRIT_LABELS: Record<string, string> = {
  shen: "Int. Emotiva",
  hun:  "Or. Strategico",
  po:   "Motivazione",
  yi:   "Pens. Analitico",
  zhi:  "Resilienza",
};

const SPIRIT_COLORS: Record<string, string> = {
  shen: "bg-violet-400",
  hun:  "bg-indigo-400",
  po:   "bg-amber-400",
  yi:   "bg-cyan-400",
  zhi:  "bg-rose-400",
};

export function DashboardPersonality({
  riasecScores,
  spiritScores,
  primaryTypes,
}: {
  riasecScores?: Record<string, number>;
  spiritScores?: Record<string, number>;
  primaryTypes?: string[];
}) {
  const radarData = riasecScores
    ? Object.entries(riasecScores)
        .filter(([k]) => RIASEC_LABELS[k])
        .map(([k, v]) => ({ subject: RIASEC_LABELS[k], value: Math.max(0, v ?? 0) }))
    : [];

  // Top 3 spirit per dimensione motivazionale
  const topSpirits = spiritScores
    ? Object.entries(spiritScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  if (!riasecScores && !spiritScores) {
    return (
      <div className="rounded-2xl border bg-card p-5 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <BrainCircuit className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Profilo non disponibile</p>
          <p className="text-xs text-muted-foreground">Completa il test per visualizzare il tuo profilo professionale.</p>
        </div>
        <Link href="/test" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Fai il test
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-5">
      {/* Titolo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm leading-tight">Profilo Professionale</h3>
          {primaryTypes && primaryTypes.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {primaryTypes.slice(0, 2).map((t) => (
                <span key={t} className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RadarChart RIASEC */}
      {radarData.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Attitudini e Competenze
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="62%">
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                />
                <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                <Radar
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.18}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 3 Dimensioni Motivazionali */}
      {topSpirits.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Dimensioni Motivazionali
          </p>
          <div className="space-y-2">
            {topSpirits.map(([key, val]) => {
              const pct = Math.round(((val - 1) / 4) * 100);
              return (
                <div key={key}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-foreground font-medium">{SPIRIT_LABELS[key] ?? key}</span>
                    <span className="text-muted-foreground">{val.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", SPIRIT_COLORS[key] ?? "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
