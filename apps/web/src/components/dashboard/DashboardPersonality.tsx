import type { AgentSummary } from "@/hooks/useAgentAnalysis";
import { cn } from "@/lib/utils";
import { BrainCircuit, Sparkles } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis, Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";

// Chiavi short (R, I, A, S, E, C) usate nel DB
const RIASEC_LABELS: Record<string, string> = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditivo",
  C: "Convenzionale",
};

const RIASEC_BY_LABEL = Object.fromEntries(
  Object.entries(RIASEC_LABELS).map(([key, label]) => [label.toLowerCase(), key]),
) as Record<string, string>;

const SPIRIT_LABELS: Record<string, string> = {
  shen: "Int. Emotiva",
  hun:  "Or. Strategico",
  po:   "Motivazione",
  yi:   "Pens. Analitico",
  zhi:  "Resilienza",
};

const SPIRIT_COLORS: Record<string, string> = {
  shen: "bg-chart-4/70",
  hun:  "bg-info/70",
  po:   "bg-primary/70",
  yi:   "bg-growth/70",
  zhi:  "bg-destructive/60",
};

const SPIRIT_ALIASES: Record<string, string> = {
  "int. emotiva": "shen",
  "intelligenza emotiva": "shen",
  "or. strategico": "hun",
  "orientamento strategico": "hun",
  motivazione: "po",
  "pens. analitico": "yi",
  "pensiero analitico": "yi",
  resilienza: "zhi",
};

type ProfileScore = { key: string; subject: string; value: number };

type ProfileSignalsInput = {
  hasTestProfile: boolean;
  agentSummary?: AgentSummary | null | undefined;
  objectivesProgress?: { total: number; done: number; percent: number } | null | undefined;
};

function clampScore(value: unknown): number {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(5, Math.max(0, Math.round(score * 10) / 10));
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function normalizeRiasecProfile(
  riasecScores?: Record<string, number>,
  primaryTypes?: string[],
): ProfileScore[] {
  const values: Record<string, number> = {};

  for (const [key, rawValue] of Object.entries(riasecScores ?? {})) {
    const normalizedKey = key.length === 1
      ? key.toUpperCase()
      : RIASEC_BY_LABEL[normalizeKey(key)];
    if (normalizedKey && RIASEC_LABELS[normalizedKey]) {
      values[normalizedKey] = Math.max(values[normalizedKey] ?? 0, clampScore(rawValue));
    }
  }

  primaryTypes?.forEach((type, index) => {
    const normalizedKey = RIASEC_BY_LABEL[normalizeKey(type)] ?? type.trim().charAt(0).toUpperCase();
    if (normalizedKey && RIASEC_LABELS[normalizedKey] && !values[normalizedKey]) {
      values[normalizedKey] = Math.max(3.2, 4.5 - index * 0.5);
    }
  });

  return Object.entries(RIASEC_LABELS).map(([key, subject]) => ({
    key,
    subject,
    value: values[key] ?? 0,
  }));
}

export function normalizeSpiritProfile(spiritScores?: Record<string, number>): Array<[string, number]> {
  const values: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(spiritScores ?? {})) {
    const normalizedKey = SPIRIT_LABELS[key] ? key : SPIRIT_ALIASES[normalizeKey(key)];
    if (normalizedKey && SPIRIT_LABELS[normalizedKey]) {
      values[normalizedKey] = Math.max(values[normalizedKey] ?? 0, clampScore(rawValue));
    }
  }

  return Object.entries(values)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
}

export function buildProfileSignals({
  hasTestProfile,
  agentSummary,
  objectivesProgress,
}: ProfileSignalsInput): string[] {
  const signals: string[] = [];
  if (hasTestProfile) signals.push("Test");
  if (
    (agentSummary?.professions?.length ?? 0) > 0 ||
    !!agentSummary?.workMode ||
    (agentSummary?.growth?.length ?? 0) > 0
  ) {
    signals.push("Wendy");
  }
  if ((objectivesProgress?.total ?? 0) > 0 || (agentSummary?.news?.length ?? 0) > 0) {
    signals.push("Strumenti");
  }
  return signals;
}

export function DashboardPersonality({
  riasecScores,
  spiritScores,
  primaryTypes,
  agentSummary,
  objectivesProgress,
}: {
  riasecScores?: Record<string, number>;
  spiritScores?: Record<string, number>;
  primaryTypes?: string[];
  agentSummary?: AgentSummary | null | undefined;
  objectivesProgress?: { total: number; done: number; percent: number } | undefined;
}) {
  const radarData = normalizeRiasecProfile(riasecScores, primaryTypes);
  const hasRiasecData = radarData.some((item) => item.value > 0);

  // Top 3 spirit per dimensione motivazionale
  const topSpirits = normalizeSpiritProfile(spiritScores);
  const profileSignals = buildProfileSignals({
    hasTestProfile: hasRiasecData || (primaryTypes?.length ?? 0) > 0,
    agentSummary,
    objectivesProgress,
  });
  const topProfession = agentSummary?.professions?.[0]?.title;
  const workMode = agentSummary?.workMode?.recommendedLabel ?? agentSummary?.workMode?.recommended;

  if (!hasRiasecData && topSpirits.length === 0 && profileSignals.length === 0) {
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

      {profileSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profileSignals.map((signal) => (
            <span
              key={signal}
              className="text-[10px] rounded-full border bg-muted/40 px-2 py-0.5 font-medium text-muted-foreground"
            >
              Da {signal}
            </span>
          ))}
        </div>
      )}

      {(topProfession || workMode) && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          {topProfession && (
            <p className="text-xs text-foreground">
              Direzione suggerita: <span className="font-semibold">{topProfession}</span>
            </p>
          )}
          {workMode && (
            <p className="text-xs text-muted-foreground">
              Modalita di lavoro coerente: <span className="font-medium text-foreground">{workMode}</span>
            </p>
          )}
        </div>
      )}

      {/* RadarChart RIASEC */}
      {hasRiasecData && (
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
                  <div className="h-1.5 bg-muted/70 rounded-full overflow-hidden">
                    <div
                      role="meter"
                      aria-label={`${SPIRIT_LABELS[key] ?? key}: ${val.toFixed(1)} su 5`}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={val}
                      className={cn("h-full rounded-full transition-all duration-700", SPIRIT_COLORS[key] ?? "bg-primary/70")}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topSpirits.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Dimensioni Motivazionali
          </p>
          <p className="text-xs text-muted-foreground">
            Dimensioni motivazionali in aggiornamento: completa la sezione motivazionale o parla con Wendy per arricchirle.
          </p>
        </div>
      )}
    </div>
  );
}
