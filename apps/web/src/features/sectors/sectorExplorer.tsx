import { getJson } from "@/lib/apiClient";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { Sector as ApiSector } from "@workspace/api-client-react";
import { ArrowRight, Award, BarChart3, ShieldCheck, Target, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import type { WorkPreference } from "@/components/WorkModeSelector";

const BASE = import.meta.env.BASE_URL || "/";

export const ALL_RIASEC = ["R", "I", "A", "S", "E", "C"];
export const ALL_RISK = ["low", "medium", "high"];

export type Sector = ApiSector & {
  workMode?: Array<"dipendente" | "autonomo" | "ibrido"> | null;
};

type LatestRecommendation = {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  matchReason?: string;
};

export type LatestSession = {
  sessionId: number;
  recommendations?: LatestRecommendation[];
  riasecScores?: Record<string, number>;
};

export type RankedSector = Sector & {
  rankScore: number;
  fitScore: number;
  workModeScore: number;
  marketScore: number;
  reason: string;
};

export function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors"],
    queryFn: () => getJson<Sector[]>(`${BASE}api/sectors`),
    staleTime: 300_000,
  });
}

export function useLatestSession(enabled: boolean) {
  return useQuery<LatestSession | null>({
    queryKey: ["test-sessions-latest-for-sectors"],
    enabled,
    queryFn: () =>
      getJson<LatestSession>(`${BASE}api/test-sessions/latest`, {
        okStatuses: [404],
      }).catch(() => null),
    staleTime: 120_000,
    retry: false,
  });
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function formatSalaryRange(min: number, max: number) {
  const minValue = Math.round(min / 1000);
  const maxValue = Math.round(max / 1000);

  if (!Number.isFinite(minValue) || minValue <= 0) return "Dato in verifica";
  if (!Number.isFinite(maxValue) || maxValue <= minValue) return `Da EUR ${minValue}k`;

  return `EUR ${minValue}k-${maxValue}k`;
}

export function getTrendLabel(trend: string) {
  if (trend === "booming") return "Domanda molto alta";
  if (trend === "growing") return "Domanda in crescita";
  if (trend === "declining") return "Domanda in calo";
  return "Domanda stabile";
}

export function getRiskLabel(risk: string) {
  if (risk === "low") return "Basso impatto";
  if (risk === "high") return "Alta esposizione";
  return "Impatto medio";
}

function computeMarketScore(sector: Sector) {
  const trendScore =
    sector.trend === "booming"
      ? 100
      : sector.trend === "growing"
        ? 78
        : sector.trend === "stable"
          ? 55
          : 28;
  const riskScore =
    sector.automationRisk === "low" ? 100 : sector.automationRisk === "medium" ? 62 : 34;
  const salaryMid = (sector.avgSalaryMin + sector.avgSalaryMax) / 2;
  const salaryScore = Math.max(20, Math.min(100, Math.round(salaryMid / 900)));

  return Math.round(trendScore * 0.45 + salaryScore * 0.3 + riskScore * 0.25);
}

function computeRiasecFit(sector: Sector, riasecScores?: Record<string, number>) {
  if (!riasecScores || !sector.riasecTypes.length) return 0;

  const maxScore = Math.max(...Object.values(riasecScores), 0);
  if (maxScore <= 0) return 0;

  const sectorScore =
    sector.riasecTypes.reduce((sum, type) => {
      const letter = type.charAt(0).toUpperCase();
      return sum + (riasecScores[letter] ?? 0);
    }, 0) / sector.riasecTypes.length;

  return Math.round((sectorScore / maxScore) * 100);
}

function computeWorkModeScore(
  sector: Sector,
  workPreference: WorkPreference | "unknown",
) {
  if (!workPreference || workPreference === "unknown") return 50;
  if (!sector.workMode?.length) return 50;
  if (sector.workMode.includes(workPreference)) return 100;
  if (workPreference === "autonomo" && sector.workMode.includes("ibrido")) return 72;
  if (workPreference === "dipendente" && sector.workMode.includes("ibrido")) return 72;
  return 32;
}

function buildReason(
  sector: Sector,
  fitScore: number,
  marketScore: number,
  recommendation?: LatestRecommendation,
) {
  if (recommendation?.matchReason) return recommendation.matchReason;
  if (fitScore >= 75) return "Forte coerenza con il tuo profilo e i tuoi interessi.";
  if (marketScore >= 75) return "Segnali di mercato solidi e buona sostenibilita del percorso.";
  if (sector.workMode?.length) return "Buona area da esplorare per modalita e competenze richieste.";
  return "Area ordinata per segnali generali di mercato.";
}

export function rankSectors(
  sectors: Sector[],
  latestSession: LatestSession | null | undefined,
  workPreference: WorkPreference | "unknown",
) {
  const recommendations = new Map(
    (latestSession?.recommendations ?? []).map((rec) => [rec.sectorId, rec]),
  );

  return sectors
    .map((sector) => {
      const recommendation = recommendations.get(sector.id);
      const fitScore =
        recommendation?.matchScore ?? computeRiasecFit(sector, latestSession?.riasecScores);
      const workModeScore = computeWorkModeScore(sector, workPreference);
      const marketScore = computeMarketScore(sector);
      const rankScore = Math.round(fitScore * 0.6 + workModeScore * 0.2 + marketScore * 0.2);

      return {
        ...sector,
        rankScore,
        fitScore,
        workModeScore,
        marketScore,
        reason: buildReason(sector, fitScore, marketScore, recommendation),
      };
    })
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return computeMarketScore(b) - computeMarketScore(a);
    });
}

export function PyramidCard({
  sector,
  rank,
  variant,
}: {
  sector: RankedSector;
  rank: number;
  variant: "apex" | "middle" | "base";
}) {
  const isApex = variant === "apex";
  const isMiddle = variant === "middle";

  return (
    <Link
      href={`/settore/${sector.id}`}
      className={cn("block", variant === "base" && "shrink-0")}
    >
      <article
        className={cn(
          "group relative h-full overflow-hidden border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md",
          isApex
            ? "rounded-2xl border-primary/35 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-lg shadow-primary/10 md:p-6"
            : isMiddle
              ? "rounded-2xl border-primary/20 p-4 md:p-5"
              : "min-h-64 w-52 rounded-xl border-border p-4 md:w-60",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 bg-linear-to-r from-primary/20 via-primary to-primary/20",
            isApex ? "h-1" : "h-0.5",
          )}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center border border-primary/25 bg-primary/10 text-primary",
                isApex
                  ? "h-14 w-14 rounded-2xl"
                  : isMiddle
                    ? "h-11 w-11 rounded-xl"
                    : "h-10 w-10 rounded-xl",
              )}
            >
              <SectorIcon name={sector.icon} size={isApex ? 24 : isMiddle ? 20 : 18} />
            </div>
            {isApex ? (
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Award className="h-3 w-3" />
                  Area guida
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Il settore piu coerente con i segnali attivi.
                </p>
              </div>
            ) : null}
            {isMiddle ? (
              <div className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                Alternative forti
              </div>
            ) : null}
          </div>
          <span className="font-bold tabular-nums text-foreground/30">#{rank}</span>
        </div>

        <div className={cn(isApex ? "mt-6" : "mt-5")}>
          <h2
            className={cn(
              "font-bold leading-tight text-foreground transition-colors group-hover:text-primary",
              isApex ? "text-xl md:text-2xl" : isMiddle ? "text-base" : "line-clamp-2 text-sm",
            )}
          >
            {sector.name}
          </h2>
          <p
            className={cn(
              "mt-2 leading-relaxed text-muted-foreground",
              isApex ? "line-clamp-2 text-sm" : "line-clamp-2 text-xs",
            )}
          >
            {sector.description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            <BarChart3 className="h-3 w-3" />
            {getTrendLabel(sector.trend)}
          </span>
        </div>

        <div
          className={cn(
            "mt-5 border-t border-border/60",
            isApex ? "grid grid-cols-1 gap-3 pt-4 sm:grid-cols-3" : "space-y-3 pt-4",
          )}
        >
          <EvidenceItem
            icon={Target}
            label="Perche e in alto"
            value={sector.reason}
            large={isApex}
          />
          <EvidenceItem
            icon={UsersRound}
            label="Compenso indicativo"
            value={formatSalaryRange(sector.avgSalaryMin, sector.avgSalaryMax)}
            large={isApex}
          />
          <EvidenceItem
            icon={ShieldCheck}
            label="Impatto AI"
            value={getRiskLabel(sector.automationRisk)}
            large={isApex}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {sector.riasecTypes.slice(0, 3).map((type) => (
              <span
                key={type}
                className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground"
              >
                {type}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Apri <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function EvidenceItem({
  icon: Icon,
  label,
  value,
  large,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  large: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", large && "rounded-lg border border-border/60 bg-background/35 p-3")}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("line-clamp-2 font-bold text-foreground", large ? "text-sm" : "text-xs")}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function SectorEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
      <Icon className="mx-auto mb-3 h-10 w-10 opacity-40" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
