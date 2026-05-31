import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BarChart3,
  ChevronRight,
  Flame,
  ShieldCheck,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { RISK_COLOR } from "./homeConstants";
import type { TrendingSector } from "./homeTypes";

type PyramidCardVariant = "apex" | "middle" | "base";

function formatSalaryRange(min: number, max: number) {
  const minValue = Math.round(min / 1000);
  const maxValue = Math.round(max / 1000);

  if (!Number.isFinite(minValue) || minValue <= 0) return "Dato in verifica";
  if (!Number.isFinite(maxValue) || maxValue <= minValue) return `Da EUR ${minValue}k`;

  return `EUR ${minValue}k-${maxValue}k`;
}

function formatUserSignal(weeklyPicks: number, totalPicks: number) {
  if (weeklyPicks > 0) return `${weeklyPicks} scelte sett.`;
  if (totalPicks > 0) return `${totalPicks} scelte totali`;
  return "Interesse stabile";
}

function getRiskLabel(risk: string) {
  if (risk === "low") return "Basso impatto";
  if (risk === "high") return "Alta esposizione";
  return "Impatto medio";
}

function getTrendLabel(trend: string) {
  if (trend === "booming") return "Domanda molto alta";
  if (trend === "growing") return "Domanda in crescita";
  if (trend === "declining") return "Domanda in calo";
  return "Domanda stabile";
}

export function TrendingMobileStrip({
  sectors,
}: {
  sectors: TrendingSector[] | undefined;
}) {
  const { t } = useTranslation();

  if (!sectors?.length) return null;

  const topSectors = sectors.slice(0, 8);
  const [apexSector, ...remainingSectors] = topSectors;
  const middleSectors = remainingSectors.slice(0, 2);
  const baseSectors = remainingSectors.slice(2);

  const renderSectorCard = (
    sector: TrendingSector,
    index: number,
    variant: PyramidCardVariant,
  ) => {
    const trendLabel = getTrendLabel(sector.trend);
    const isApex = variant === "apex";
    const isMiddle = variant === "middle";
    const rank = index + 1;
    const evidenceItems = [
      {
        icon: BarChart3,
        label: "Compenso indicativo",
        value: formatSalaryRange(sector.avgSalaryMin, sector.avgSalaryMax),
        className: "text-foreground",
      },
      {
        icon: UsersRound,
        label: "Segnale utenti",
        value: formatUserSignal(sector.weeklyPicks, sector.totalPicks),
        className: "text-primary",
      },
      {
        icon: ShieldCheck,
        label: "Impatto AI",
        value: getRiskLabel(sector.automationRisk),
        className: RISK_COLOR[sector.automationRisk] ?? RISK_COLOR.medium,
      },
    ];

    return (
      <Link
        key={sector.id}
        href={`/settore/${sector.id}`}
        className={cn("block", variant === "base" && "shrink-0")}
      >
        <motion.div
          initial={{ opacity: 0, y: isApex ? 16 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.06, duration: 0.32 }}
          className={cn(
            "group relative overflow-hidden border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md active:scale-[0.98]",
            isApex
              ? "rounded-2xl border-primary/35 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-lg shadow-primary/10 md:p-6"
              : isMiddle
                ? "rounded-2xl border-primary/20 p-4 md:p-5"
                : "min-h-64 w-52 rounded-xl border-border p-4 md:w-60",
          )}
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 bg-linear-to-r from-primary/25 via-primary to-primary/25",
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
                <SectorIcon
                  name={sector.icon}
                  size={isApex ? 24 : isMiddle ? 20 : 18}
                />
              </div>
              {isApex ? (
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Award className="h-3 w-3" />
                    Area guida
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Priorita nella mappa delle opportunita
                  </p>
                </div>
              ) : null}
            </div>
            <span
              className={cn(
                "font-bold tabular-nums text-foreground/30",
                isApex ? "text-2xl" : "text-base",
              )}
            >
              #{rank}
            </span>
          </div>

          <div className={cn(isApex ? "mt-6" : "mt-5")}>
            <p
              className={cn(
                "font-bold leading-tight text-foreground",
                isApex
                  ? "text-xl md:text-2xl"
                  : isMiddle
                    ? "text-base"
                    : "line-clamp-2 text-sm",
              )}
            >
              {sector.name}
            </p>
            {sector.description ? (
              <p
                className={cn(
                  "mt-2 leading-relaxed text-muted-foreground",
                  isApex ? "line-clamp-2 text-sm" : "line-clamp-2 text-xs",
                )}
              >
                {sector.description}
              </p>
            ) : null}
            <span
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
            >
              <TrendingUp className="h-3 w-3" /> {trendLabel}
            </span>
          </div>

          <div
            className={cn(
              "mt-5 border-t border-border/60",
              isApex
                ? "grid grid-cols-1 gap-3 pt-4 sm:grid-cols-3"
                : "space-y-3 pt-4",
            )}
          >
            {evidenceItems.map(({ icon: Icon, label, value, className }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2",
                  isApex && "rounded-lg border border-border/60 bg-background/35 p-3",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p
                    className={cn(
                      "truncate font-bold",
                      isApex ? "text-sm" : "text-xs",
                      className,
                    )}
                  >
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </Link>
    );
  };

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-3 md:px-6 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 md:h-8 md:w-8">
              <Flame className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground md:text-sm">
              {t("home.trending.heading")}
            </span>
          </div>
          <Link href="/settori">
            <div className="flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-primary/10">
              Vedi tutti <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>
      </div>

      <div
        data-testid="growth-pyramid"
        className="mx-auto max-w-6xl px-4 pb-6 md:px-6 md:pb-8"
      >
        <div className="mx-auto mb-5 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Piramide delle priorita
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Una lettura ordinata delle aree con segnali piu forti: prima il
            leader, poi le alternative ad alta attenzione.
          </p>
        </div>

        {apexSector ? (
          <div data-testid="growth-pyramid-apex" className="mx-auto max-w-2xl">
            {renderSectorCard(apexSector, 0, "apex")}
          </div>
        ) : null}

        {middleSectors.length ? (
          <div
            data-testid="growth-pyramid-middle"
            className="mx-auto mt-3 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 md:mt-4 md:gap-4"
          >
            {middleSectors.map((sector, index) =>
              renderSectorCard(sector, index + 1, "middle"),
            )}
          </div>
        ) : null}

        <div
          data-testid="growth-pyramid-base"
          className="mt-3 flex gap-3 overflow-x-auto scroll-smooth pb-1 md:mt-4 md:gap-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {baseSectors.map((sector, index) =>
            renderSectorCard(sector, index + 3, "base"),
          )}

          <Link href="/settori" className="shrink-0">
            <div className="flex h-full min-h-38 w-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-muted-foreground transition-all hover:border-primary/30 hover:text-primary active:scale-[0.97] md:w-36">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <ArrowRight className="h-4 w-4" />
              </div>
              <p className="px-2 text-center text-xs font-semibold leading-snug">
                Esplora tutti
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
