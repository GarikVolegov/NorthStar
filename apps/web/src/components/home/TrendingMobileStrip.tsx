import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Flame, TrendingUp, ArrowRight, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";

type TrendingSector = {
  id: number;
  name: string;
  icon: string;
  description: string;
  trend: string;
  growthRate: number;
  automationRisk: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  riasecTypes: string[];
  weeklyPicks: number;
  totalPicks: number;
};

const TREND_COLOR: Record<string, string> = {
  booming: "text-primary bg-primary/10 border-primary/30",
  growing: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  stable: "text-muted-foreground bg-muted border-border",
  declining: "text-red-400 bg-red-400/10 border-red-400/30",
};

const RISK_COLOR: Record<string, string> = {
  low: "text-primary",
  medium: "text-amber-400",
  high: "text-red-400",
};

export function TrendingMobileStrip({
  sectors,
}: {
  sectors: TrendingSector[] | undefined;
}) {
  const { t } = useTranslation();

  if (!sectors?.length) return null;

  return (
    <section className="md:hidden border-b border-border bg-background">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Flame className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Settori in crescita
          </span>
        </div>
        <Link href="/settori">
          <div className="flex items-center gap-1 text-xs font-semibold text-primary">
            Vedi tutti <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <div
        className="flex gap-3 overflow-x-auto pb-5 px-4 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {sectors.map((sector, i) => {
          const trendColor = TREND_COLOR[sector.trend] ?? TREND_COLOR["stable"];
          const trendLabel = t(`results.trend.${sector.trend}`, {
            defaultValue: sector.trend,
          });
          return (
            <Link
              key={sector.id}
              href={`/settore/${sector.id}`}
              className="shrink-0"
            >
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="w-44 rounded-2xl border border-border bg-card hover:border-primary/35 active:scale-[0.97] transition-all duration-200 overflow-hidden"
              >
                {/* Top accent stripe */}
                <div className="h-0.5 w-full bg-linear-to-r from-primary/40 via-primary/70 to-primary/40" />

                <div className="p-3.5 flex flex-col gap-2.5">
                  {/* Icon + rank */}
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <SectorIcon name={sector.icon} size={18} />
                    </div>
                    <span className="text-xs font-bold text-foreground/20">
                      #{i + 1}
                    </span>
                  </div>

                  {/* Name */}
                  <div>
                    <p className="text-sm font-bold text-foreground leading-snug line-clamp-2 mb-1.5">
                      {sector.name}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5",
                        trendColor,
                      )}
                    >
                      <TrendingUp className="w-2.5 h-2.5" /> {trendLabel}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
                        Stipendio
                      </p>
                      <p className="text-xs font-bold text-foreground">
                        €{Math.round(sector.avgSalaryMin / 1000)}k
                      </p>
                    </div>
                    <div className="w-px h-6 bg-border/60" />
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
                        Crescita
                      </p>
                      <p className="text-xs font-bold text-primary">
                        +{sector.growthRate}%
                      </p>
                    </div>
                    <div className="w-px h-6 bg-border/60" />
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide font-medium">
                        AI
                      </p>
                      <p
                        className={cn(
                          "text-xs font-bold",
                          RISK_COLOR[sector.automationRisk] ??
                            RISK_COLOR["medium"],
                        )}
                      >
                        {sector.automationRisk === "low"
                          ? "Basso"
                          : sector.automationRisk === "high"
                            ? "Alto"
                            : "Med"}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}

        {/* "Explore all" card at the end */}
        <Link href="/settori" className="shrink-0">
          <div className="w-28 h-full min-h-38 rounded-2xl border border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-[0.97]">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <ArrowRight className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-center px-2 leading-snug">
              Esplora tutti
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}
