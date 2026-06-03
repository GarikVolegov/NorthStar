/**
 * DashboardCareerComparison
 *
 * Side-by-side comparison of two top-recommended sectors.
 * Uses data already available from recommendations, without extra fetches.
 */
import { cn } from "@/lib/utils";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { ArrowRight, Scale, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { AdaptiveSectionPresentation } from "./dashboard-adaptive-flow";

export interface ComparisonSector {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  avgSalaryMin?: number;
  avgSalaryMax?: number;
  growthRate?: number;
  automationRisk?: "low" | "medium" | "high";
  trend?: "declining" | "stable" | "growing" | "booming";
  autonomyScore?: number;
  stabilityScore?: number;
}

type RiskLevel = NonNullable<ComparisonSector["automationRisk"]>;
type TrendLevel = NonNullable<ComparisonSector["trend"]>;

type CareerComparisonCopy = ReturnType<typeof useCareerComparisonCopy>;

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage || i18n.language || "it";
}

function useCareerComparisonCopy(locale: string) {
  const ariaLabel = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.ariaLabel",
    source: "Confronto settori e ruoli",
    context: "Accessible label for the dashboard career comparison card.",
  });
  const primaryAriaSuffix = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.primaryAriaSuffix",
    source: "azione principale",
    context: "ARIA suffix when the comparison is the primary next action.",
  });
  const title = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.title",
    source: "Confronto settori e ruoli",
    context: "Dashboard career comparison title.",
  });
  const subtitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.subtitle",
    source: "Le due opzioni piu compatibili messe a confronto in modo pratico",
    context: "Dashboard career comparison subtitle. Keep it user-facing.",
  });
  const matchLabel = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.matchLabel",
    source: "affinita",
    context: "Match percentage suffix. Keep the percentage outside this text.",
  });
  const unavailable = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.unavailable",
    source: "Dato non ancora disponibile",
    context: "Fallback for missing comparison data. Avoid abbreviations.",
  });
  const salaryFrom = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.salary.from",
    source: "da",
    context: "Salary range lower-bound prefix.",
  });
  const salaryUpTo = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.salary.upTo",
    source: "fino a",
    context: "Salary range upper-bound prefix.",
  });
  const cta = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.cta",
    source: "Confronta settori e scegli il ruolo",
    context: "Dashboard career comparison full CTA.",
  });
  const compactTitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.compact.title",
    source: "Confronto rapido",
    context: "Dashboard career comparison compact title.",
  });
  const compactSubtitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.compact.subtitle",
    source: "Riepilogo delle due opzioni principali",
    context: "Dashboard career comparison compact subtitle.",
  });
  const compactCta = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.compact.cta",
    source: "Riapri confronto",
    context: "Dashboard career comparison compact CTA.",
  });
  const gatedTitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.gated.title",
    source: "Confronto settori e ruoli bloccato",
    context: "Dashboard career comparison gated title.",
  });
  const gatedCopy = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.gated.copy",
    source: "Salva almeno 3 settori consigliati per confrontare alternative e scegliere il ruolo target.",
    context: "Dashboard career comparison gated guidance. Avoid internal app mechanics.",
  });
  const gatedCta = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.gated.cta",
    source: "Esplora e salva settori",
    context: "Dashboard career comparison gated CTA.",
  });
  const emptyTitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.empty.title",
    source: "Completa il test per confrontare i settori piu adatti a te",
    context: "Dashboard career comparison empty state title.",
  });
  const emptyCta = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.empty.cta",
    source: "Inizia il test",
    context: "Dashboard career comparison empty state CTA.",
  });
  const partialTitle = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.partial.title",
    source: "Servono due opzioni confrontabili",
    context: "Dashboard career comparison partial data title.",
  });
  const partialCopy = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.partial.copy",
    source: "Hai ancora una sola area consigliata. Salva o esplora un'altra opzione prima di decidere.",
    context: "Dashboard career comparison partial data copy. Keep it practical.",
  });
  const partialCta = useDynamicTranslation({
    locale,
    key: "dashboard.careerComparison.partial.cta",
    source: "Esplora aree e ruoli",
    context: "Dashboard career comparison partial data CTA.",
  });
  const metrics = {
    salary: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.metrics.salary",
      source: "Retribuzione",
      context: "Career comparison metric label for salary.",
    }),
    trend: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.metrics.trend",
      source: "Trend",
      context: "Career comparison metric label for market trend.",
    }),
    automation: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.metrics.automation",
      source: "Automazione",
      context: "Career comparison metric label for automation risk.",
    }),
    autonomy: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.metrics.autonomy",
      source: "Autonomia",
      context: "Career comparison metric label for autonomy.",
    }),
    stability: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.metrics.stability",
      source: "Stabilita",
      context: "Career comparison metric label for stability.",
    }),
  };
  const risks: Record<RiskLevel, string> = {
    low: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.risks.low",
      source: "Basso",
      context: "Low automation risk label.",
    }),
    medium: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.risks.medium",
      source: "Medio",
      context: "Medium automation risk label.",
    }),
    high: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.risks.high",
      source: "Alto",
      context: "High automation risk label.",
    }),
  };
  const trends: Record<TrendLevel, string> = {
    declining: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.trends.declining",
      source: "In calo",
      context: "Declining market trend label.",
    }),
    stable: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.trends.stable",
      source: "Stabile",
      context: "Stable market trend label.",
    }),
    growing: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.trends.growing",
      source: "In crescita",
      context: "Growing market trend label.",
    }),
    booming: useDynamicTranslation({
      locale,
      key: "dashboard.careerComparison.trends.booming",
      source: "In forte crescita",
      context: "Booming market trend label.",
    }),
  };

  return {
    ariaLabel,
    compactCta,
    compactSubtitle,
    compactTitle,
    cta,
    emptyCta,
    emptyTitle,
    gatedCopy,
    gatedCta,
    gatedTitle,
    matchLabel,
    metrics,
    partialCopy,
    partialCta,
    partialTitle,
    primaryAriaSuffix,
    risks,
    salaryFrom,
    salaryUpTo,
    subtitle,
    title,
    trends,
    unavailable,
  };
}

function formatSalary(min: number | undefined, max: number | undefined, copy: CareerComparisonCopy): string {
  const hasMin = typeof min === "number";
  const hasMax = typeof max === "number";
  if (!hasMin && !hasMax) return copy.unavailable;
  if (hasMin && hasMax) return `EUR ${(min / 1000).toFixed(0)}k - EUR ${(max / 1000).toFixed(0)}k`;
  if (hasMax) return `${copy.salaryUpTo} EUR ${(max / 1000).toFixed(0)}k`;
  return `${copy.salaryFrom} EUR ${((min ?? 0) / 1000).toFixed(0)}k`;
}

function RiskChip({
  copy,
  risk,
}: {
  copy: CareerComparisonCopy;
  risk: "low" | "medium" | "high" | undefined;
}) {
  if (!risk) return <span className="text-xs text-muted-foreground">{copy.unavailable}</span>;
  const tone = {
    low: "text-emerald-600 bg-emerald-50 border-emerald-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    high: "text-red-600 bg-red-50 border-red-200",
  };
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone[risk])}>
      {copy.risks[risk]}
    </span>
  );
}

function TrendIcon({ trend }: { trend: string | undefined }) {
  if (trend === "booming" || trend === "growing") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Zap className="h-3.5 w-3.5 text-amber-400" />;
}

function TrendValue({ copy, trend }: { copy: CareerComparisonCopy; trend: TrendLevel | undefined }) {
  return (
    <div className="flex items-center gap-1">
      <TrendIcon trend={trend} />
      <span className="text-xs text-foreground">{trend ? copy.trends[trend] : copy.unavailable}</span>
    </div>
  );
}

function ScoreBar({
  copy,
  max = 10,
  value,
}: {
  copy: CareerComparisonCopy;
  max?: number;
  value: number | undefined;
}) {
  if (typeof value !== "number") {
    return <span className="text-xs text-muted-foreground">{copy.unavailable}</span>;
  }
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}/10</span>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
}

function MetricRow({ label, left, right }: MetricRowProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="flex justify-end">{left}</div>
      <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 w-20 shrink-0">
        {label}
      </span>
      <div>{right}</div>
    </div>
  );
}

function SectorMiniCard({
  copy,
  sector,
  tone,
}: {
  copy: CareerComparisonCopy;
  sector: ComparisonSector;
  tone: "primary" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-center",
        tone === "primary" ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <p className={cn("text-xs font-bold leading-tight line-clamp-2", tone === "primary" ? "text-primary" : "text-foreground")}>
        {sector.sectorName}
      </p>
      <p className={cn("mt-0.5 text-[11px] font-semibold", tone === "primary" ? "text-primary/70" : "text-muted-foreground")}>
        {Math.round(sector.matchScore)}% {copy.matchLabel}
      </p>
    </div>
  );
}

function ComparisonFallback({
  cta,
  iconSize,
  title,
  description,
  href,
}: {
  cta: string;
  iconSize: "sm" | "md";
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-center">
      <Scale className={cn("mx-auto mb-2 text-muted-foreground/40", iconSize === "md" ? "h-8 w-8" : "h-6 w-6")} />
      <p className={cn("text-foreground", description ? "text-sm font-semibold" : "text-sm font-medium text-muted-foreground")}>
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      <Link
        href={href}
        className={cn(
          "mt-3 inline-flex items-center gap-1 text-xs font-semibold transition-colors",
          href === "/test"
            ? "rounded-full bg-primary px-4 py-1.5 text-primary-foreground hover:bg-primary/90"
            : "text-primary hover:underline",
        )}
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function DashboardCareerComparison({
  sectorA,
  sectorB,
  presentation,
}: {
  sectorA: ComparisonSector | null;
  sectorB: ComparisonSector | null;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  const locale = useDashboardLocale();
  const copy = useCareerComparisonCopy(locale);

  if (presentation?.gated) {
    return (
      <ComparisonFallback
        cta={copy.gatedCta}
        description={copy.gatedCopy}
        href="/settori"
        iconSize="sm"
        title={copy.gatedTitle}
      />
    );
  }

  if (!sectorA && !sectorB) {
    return (
      <ComparisonFallback
        cta={copy.emptyCta}
        href="/test"
        iconSize="md"
        title={copy.emptyTitle}
      />
    );
  }

  if (!sectorA || !sectorB) {
    return (
      <ComparisonFallback
        cta={copy.partialCta}
        description={copy.partialCopy}
        href="/settori"
        iconSize="sm"
        title={copy.partialTitle}
      />
    );
  }

  if (presentation?.priority === "compact") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Scale className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {copy.compactTitle}
            </p>
            <p className="text-xs text-muted-foreground/70">{copy.compactSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <SectorMiniCard copy={copy} sector={sectorA} tone="primary" />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30">
            <span className="text-[10px] font-black text-muted-foreground">VS</span>
          </div>
          <SectorMiniCard copy={copy} sector={sectorB} tone="muted" />
        </div>

        <Link
          href="/settori"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {copy.compactCta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div
      aria-label={`${copy.ariaLabel}${presentation?.priority === "primary" ? ` ${copy.primaryAriaSuffix}` : ""}`}
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        presentation?.priority === "primary" ? "border-primary/35 bg-primary/5 shadow-primary/10" : "border-border",
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
          <Scale className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {copy.title}
          </p>
          <p className="text-xs text-muted-foreground/70">{copy.subtitle}</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <SectorMiniCard copy={copy} sector={sectorA} tone="primary" />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30">
          <span className="text-[10px] font-black text-muted-foreground">VS</span>
        </div>
        <SectorMiniCard copy={copy} sector={sectorB} tone="muted" />
      </div>

      <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-1">
        <MetricRow
          label={copy.metrics.salary}
          left={<span className="text-xs font-semibold text-foreground">{formatSalary(sectorA.avgSalaryMin, sectorA.avgSalaryMax, copy)}</span>}
          right={<span className="text-xs font-semibold text-foreground">{formatSalary(sectorB.avgSalaryMin, sectorB.avgSalaryMax, copy)}</span>}
        />
        <MetricRow
          label={copy.metrics.trend}
          left={<TrendValue copy={copy} trend={sectorA.trend} />}
          right={<TrendValue copy={copy} trend={sectorB.trend} />}
        />
        <MetricRow
          label={copy.metrics.automation}
          left={<RiskChip copy={copy} risk={sectorA.automationRisk} />}
          right={<RiskChip copy={copy} risk={sectorB.automationRisk} />}
        />
        <MetricRow
          label={copy.metrics.autonomy}
          left={<ScoreBar copy={copy} value={sectorA.autonomyScore} />}
          right={<ScoreBar copy={copy} value={sectorB.autonomyScore} />}
        />
        <MetricRow
          label={copy.metrics.stability}
          left={<ScoreBar copy={copy} value={sectorA.stabilityScore} />}
          right={<ScoreBar copy={copy} value={sectorB.stabilityScore} />}
        />
      </div>

      <div className="mt-3 flex items-center justify-end">
        <Link
          href="/settori"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {copy.cta}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
