import type { AgentSummary } from "@/hooks/useAgentAnalysis";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { BrainCircuit, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";

const RIASEC_LABELS = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditivo",
  C: "Convenzionale",
} as const;

type RiasecKey = keyof typeof RIASEC_LABELS;

const RIASEC_BY_LABEL = Object.fromEntries(
  Object.entries(RIASEC_LABELS).map(([key, label]) => [label.toLowerCase(), key]),
) as Record<string, RiasecKey>;

const SPIRIT_LABELS = {
  shen: "Int. Emotiva",
  hun: "Or. Strategico",
  po: "Motivazione",
  yi: "Pens. Analitico",
  zhi: "Resilienza",
} as const;

type SpiritKey = keyof typeof SPIRIT_LABELS;

const SPIRIT_COLORS: Record<SpiritKey, string> = {
  shen: "bg-chart-4/70",
  hun: "bg-info/70",
  po: "bg-primary/70",
  yi: "bg-growth/70",
  zhi: "bg-destructive/60",
};

const SPIRIT_ALIASES: Record<string, SpiritKey> = {
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
type ProfileSignal = "test" | "advisor" | "activity";

type ProfileSignalsInput = {
  hasTestProfile: boolean;
  agentSummary?: AgentSummary | null | undefined;
  objectivesProgress?: { total: number; done: number; percent: number } | null | undefined;
};

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage || i18n.language || "it";
}

function clampScore(value: unknown): number {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(5, Math.max(0, Math.round(score * 10) / 10));
}

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function sanitizePrimaryTypes(primaryTypes?: string[]): string[] {
  return (primaryTypes ?? []).filter((type): type is string => typeof type === "string" && type.trim().length > 0);
}

function primaryTypeKey(type: string | undefined, fallback: string): string {
  return normalizeKey(type)?.replace(/[^a-z0-9]+/g, "-") ?? fallback;
}

function isRiasecKey(value: string | undefined): value is RiasecKey {
  return Boolean(value && Object.prototype.hasOwnProperty.call(RIASEC_LABELS, value));
}

function isSpiritKey(value: string | undefined): value is SpiritKey {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SPIRIT_LABELS, value));
}

export function normalizeRiasecProfile(
  riasecScores?: Record<string, number>,
  primaryTypes?: string[],
): ProfileScore[] {
  const values: Partial<Record<RiasecKey, number>> = {};

  for (const [key, rawValue] of Object.entries(riasecScores ?? {})) {
    const normalizedLabel = normalizeKey(key);
    const normalizedKey = key.length === 1
      ? key.toUpperCase()
      : normalizedLabel
        ? RIASEC_BY_LABEL[normalizedLabel]
        : undefined;
    if (isRiasecKey(normalizedKey)) {
      values[normalizedKey] = Math.max(values[normalizedKey] ?? 0, clampScore(rawValue));
    }
  }

  for (const type of sanitizePrimaryTypes(primaryTypes)) {
    const normalizedLabel = normalizeKey(type);
    const normalizedKey = normalizedLabel ? RIASEC_BY_LABEL[normalizedLabel] ?? type.trim().charAt(0).toUpperCase() : undefined;
    if (isRiasecKey(normalizedKey) && values[normalizedKey] === undefined) {
      values[normalizedKey] = 0;
    }
  }

  return (Object.entries(RIASEC_LABELS) as Array<[RiasecKey, string]>).map(([key, subject]) => ({
    key,
    subject,
    value: values[key] ?? 0,
  }));
}

export function normalizeSpiritProfile(spiritScores?: Record<string, number>): Array<[SpiritKey, number]> {
  const values: Partial<Record<SpiritKey, number>> = {};
  for (const [key, rawValue] of Object.entries(spiritScores ?? {})) {
    const normalizedAlias = normalizeKey(key);
    const normalizedKey = isSpiritKey(key) ? key : normalizedAlias ? SPIRIT_ALIASES[normalizedAlias] : undefined;
    if (isSpiritKey(normalizedKey)) {
      values[normalizedKey] = Math.max(values[normalizedKey] ?? 0, clampScore(rawValue));
    }
  }

  return (Object.entries(values) as Array<[SpiritKey, number]>)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
}

export function buildProfileSignals({
  hasTestProfile,
  agentSummary,
  objectivesProgress,
}: ProfileSignalsInput): ProfileSignal[] {
  const signals: ProfileSignal[] = [];
  if (hasTestProfile) signals.push("test");
  if (
    (agentSummary?.professions?.length ?? 0) > 0 ||
    !!agentSummary?.workMode ||
    (agentSummary?.growth?.length ?? 0) > 0
  ) {
    signals.push("advisor");
  }
  if ((objectivesProgress?.total ?? 0) > 0 || (agentSummary?.news?.length ?? 0) > 0) {
    signals.push("activity");
  }
  return signals;
}

function usePersonalityCopy(locale: string) {
  const title = useDynamicTranslation({
    locale,
    key: "dashboard.personality.title",
    source: "Profilo professionale",
    context: "Dashboard personality profile card title.",
  });
  const emptyTitle = useDynamicTranslation({
    locale,
    key: "dashboard.personality.empty.title",
    source: "Profilo non disponibile",
    context: "Dashboard personality empty state title.",
  });
  const emptyCopy = useDynamicTranslation({
    locale,
    key: "dashboard.personality.empty.copy",
    source: "Completa il test per visualizzare un profilo professionale basato sui tuoi segnali.",
    context: "Dashboard personality empty state copy. Keep it practical and user-facing.",
  });
  const emptyCta = useDynamicTranslation({
    locale,
    key: "dashboard.personality.empty.cta",
    source: "Fai il test",
    context: "Dashboard personality empty state CTA.",
  });
  const riasecHeading = useDynamicTranslation({
    locale,
    key: "dashboard.personality.riasec.heading",
    source: "Attitudini e competenze",
    context: "Dashboard personality RIASEC radar heading.",
  });
  const motivationalHeading = useDynamicTranslation({
    locale,
    key: "dashboard.personality.motivational.heading",
    source: "Dimensioni motivazionali",
    context: "Dashboard personality motivational dimensions heading.",
  });
  const motivationalEmptyTitle = useDynamicTranslation({
    locale,
    key: "dashboard.personality.motivational.empty.title",
    source: "Dimensioni motivazionali",
    context: "Dashboard personality motivational empty state heading.",
  });
  const motivationalEmptyCopy = useDynamicTranslation({
    locale,
    key: "dashboard.personality.motivational.empty.copy",
    source: "Non ci sono ancora abbastanza segnali motivazionali: completa il test o annota cosa ti da energia nel percorso.",
    context: "Dashboard personality motivational empty copy. Avoid internal system wording.",
  });
  const meterLabel = useDynamicTranslation({
    locale,
    key: "dashboard.personality.motivational.meterLabel",
    source: "Punteggio motivazionale",
    context: "Accessible name for motivational score meters.",
  });
  const directionLabel = useDynamicTranslation({
    locale,
    key: "dashboard.personality.recommendation.directionLabel",
    source: "Direzione suggerita",
    context: "Dashboard personality suggested direction label.",
  });
  const workModeLabel = useDynamicTranslation({
    locale,
    key: "dashboard.personality.recommendation.workModeLabel",
    source: "Modalita di lavoro coerente",
    context: "Dashboard personality work mode label.",
  });
  const sources: Record<ProfileSignal, string> = {
    test: useDynamicTranslation({
      locale,
      key: "dashboard.personality.sources.test",
      source: "Basato sul tuo test",
      context: "Dashboard personality source chip for test profile.",
    }),
    advisor: useDynamicTranslation({
      locale,
      key: "dashboard.personality.sources.advisor",
      source: "Basato sulle indicazioni emerse",
      context: "Dashboard personality source chip for AI advisor signals. Avoid naming internal tools.",
    }),
    activity: useDynamicTranslation({
      locale,
      key: "dashboard.personality.sources.activity",
      source: "Basato sulle tue attivita",
      context: "Dashboard personality source chip for objectives and app activity.",
    }),
  };
  const riasecLabels: Record<string, string> = {
    R: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.R", source: RIASEC_LABELS.R, context: "RIASEC Realistic label." }),
    I: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.I", source: RIASEC_LABELS.I, context: "RIASEC Investigative label." }),
    A: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.A", source: RIASEC_LABELS.A, context: "RIASEC Artistic label." }),
    S: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.S", source: RIASEC_LABELS.S, context: "RIASEC Social label." }),
    E: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.E", source: RIASEC_LABELS.E, context: "RIASEC Enterprising label." }),
    C: useDynamicTranslation({ locale, key: "dashboard.personality.riasec.C", source: RIASEC_LABELS.C, context: "RIASEC Conventional label." }),
  };
  const spiritLabels: Record<string, string> = {
    shen: useDynamicTranslation({ locale, key: "dashboard.personality.motivational.shen", source: SPIRIT_LABELS.shen, context: "Motivational dimension label." }),
    hun: useDynamicTranslation({ locale, key: "dashboard.personality.motivational.hun", source: SPIRIT_LABELS.hun, context: "Motivational dimension label." }),
    po: useDynamicTranslation({ locale, key: "dashboard.personality.motivational.po", source: SPIRIT_LABELS.po, context: "Motivational dimension label." }),
    yi: useDynamicTranslation({ locale, key: "dashboard.personality.motivational.yi", source: SPIRIT_LABELS.yi, context: "Motivational dimension label." }),
    zhi: useDynamicTranslation({ locale, key: "dashboard.personality.motivational.zhi", source: SPIRIT_LABELS.zhi, context: "Motivational dimension label." }),
  };

  return {
    directionLabel,
    emptyCopy,
    emptyCta,
    emptyTitle,
    meterLabel,
    motivationalEmptyCopy,
    motivationalEmptyTitle,
    motivationalHeading,
    riasecHeading,
    riasecLabels,
    sources,
    spiritLabels,
    title,
    workModeLabel,
  };
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
  const locale = useDashboardLocale();
  const copy = usePersonalityCopy(locale);
  const safePrimaryTypes = sanitizePrimaryTypes(primaryTypes);
  const primaryTypeLabelA = useDynamicTranslation({
    locale,
    key: `dashboard.personality.primaryTypes.${primaryTypeKey(safePrimaryTypes[0], "first")}`,
    source: safePrimaryTypes[0] ?? "",
    context: "Dashboard personality primary type chip. Keep it short.",
  });
  const primaryTypeLabelB = useDynamicTranslation({
    locale,
    key: `dashboard.personality.primaryTypes.${primaryTypeKey(safePrimaryTypes[1], "second")}`,
    source: safePrimaryTypes[1] ?? "",
    context: "Dashboard personality primary type chip. Keep it short.",
  });
  const primaryTypeLabels = [primaryTypeLabelA, primaryTypeLabelB].filter((label) => label.trim().length > 0);
  const radarData = normalizeRiasecProfile(riasecScores, safePrimaryTypes).map((item) => ({
    ...item,
    subject: copy.riasecLabels[item.key] ?? item.subject,
  }));
  const hasRiasecData = radarData.some((item) => item.value > 0);
  const topSpirits = normalizeSpiritProfile(spiritScores);
  const profileSignals = buildProfileSignals({
    hasTestProfile: hasRiasecData || safePrimaryTypes.length > 0,
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
          <p className="text-sm font-semibold text-foreground mb-1">{copy.emptyTitle}</p>
          <p className="text-xs text-muted-foreground">{copy.emptyCopy}</p>
        </div>
        <Link
          href="/test"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        >
          <Sparkles className="w-3 h-3" />
          {copy.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm leading-tight">{copy.title}</h3>
          {primaryTypeLabels.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {primaryTypeLabels.map((label) => (
                <span key={label} className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-medium">
                  {label}
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
              {copy.sources[signal]}
            </span>
          ))}
        </div>
      )}

      {(topProfession || workMode) && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          {topProfession && (
            <p className="text-xs text-foreground">
              {copy.directionLabel}: <span className="font-semibold">{topProfession}</span>
            </p>
          )}
          {workMode && (
            <p className="text-xs text-muted-foreground">
              {copy.workModeLabel}: <span className="font-medium text-foreground">{workMode}</span>
            </p>
          )}
        </div>
      )}

      {hasRiasecData && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {copy.riasecHeading}
          </p>
          <div className="sr-only">{radarData.map((item) => item.subject).join(" ")}</div>
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

      {topSpirits.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {copy.motivationalHeading}
          </p>
          <div className="space-y-2">
            {topSpirits.map(([key, val]) => {
              const pct = Math.round(((val - 1) / 4) * 100);
              const label = copy.spiritLabels[key] ?? SPIRIT_LABELS[key] ?? key;
              return (
                <div key={key}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-foreground font-medium">{label}</span>
                    <span className="text-muted-foreground">{val.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/70 rounded-full overflow-hidden">
                    <div
                      role="meter"
                      aria-label={copy.meterLabel}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={val}
                      aria-valuetext={`${label}: ${val.toFixed(1)} / 5`}
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
            {copy.motivationalEmptyTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.motivationalEmptyCopy}
          </p>
        </div>
      )}
    </div>
  );
}
