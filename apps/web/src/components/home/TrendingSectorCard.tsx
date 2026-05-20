import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Bot,
  DollarSign,
  Flame,
  GitCompare,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { RISK_COLOR, TREND_COLOR, TrendingSector } from "./types";

interface TrendingSectorCardProps {
  sector: TrendingSector;
  rank: number;
}

export function TrendingSectorCard({ sector, rank }: TrendingSectorCardProps) {
  const { t } = useTranslation();
  const trendColor = TREND_COLOR[sector.trend] ?? TREND_COLOR["stable"];
  const trendLabel = t(`results.trend.${sector.trend}`, {
    defaultValue: sector.trend,
  });
  const riskColor = RISK_COLOR[sector.automationRisk] ?? RISK_COLOR["medium"];
  const riskLabel = t(`results.risk.${sector.automationRisk}`, {
    defaultValue: sector.automationRisk,
  });

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {rank === 1 && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary border-b border-primary/20 text-xs font-bold px-4 py-1.5">
          <Flame className="w-3 h-3" /> {t("home.trending.topThisWeek")}
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <SectorIcon name={sector.icon} size={22} />
            </div>
            <div>
              <h3 className="font-bold text-foreground leading-tight">
                {sector.name}
              </h3>
              <span
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5",
                  trendColor,
                )}
              >
                <TrendingUp className="w-3 h-3" /> {trendLabel}
              </span>
            </div>
          </div>
          <span className="shrink-0 text-2xl font-bold text-foreground/8 leading-none">
            #{rank}
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
          {sector.description}
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> {t("common.salary")}
            </div>
            <p className="text-xs font-bold text-foreground">
              €{Math.round(sector.avgSalaryMin / 1000)}k–
              {Math.round(sector.avgSalaryMax / 1000)}k
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> {t("common.growth")}
            </div>
            <p className="text-xs font-bold text-primary">
              +{sector.growthRate}%
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <Bot className="w-3 h-3" /> {t("common.aiRisk")}
            </div>
            <p className={cn("text-xs font-bold", riskColor)}>{riskLabel}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-auto">
          <Link href={`/settore/${sector.id}`} className="flex-1">
            <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
              {t("home.trending.deepen")} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
          <Link href={`/confronta?a=${sector.id}`}>
            <div
              className="px-3 py-2 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
              title={t("home.trending.compareWith")}
            >
              <GitCompare className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
