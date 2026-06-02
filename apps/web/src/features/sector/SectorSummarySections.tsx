import { SectorFreshnessBadge } from "@/components/sector/SectorFreshnessBadge";
import type { WorkPreference } from "@/components/WorkModeSelector";
import { getWorkModeAlignment } from "@/lib/work-mode-utils";
import { cn } from "@/lib/utils";
import { ArrowRight, Bot, Clock, DollarSign, GitCompare, TrendingUp } from "lucide-react";
import type { TFunction } from "i18next";
import { Link } from "wouter";

import type { SectorExtended } from "./sectorTypes";

export function SectorKeyMetrics({
  sector,
  t,
}: {
  sector: SectorExtended;
  t: TFunction;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
      <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
        <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
          <DollarSign className="w-4 h-4 mr-1.5" /> {t("sector.annualSalary")}
        </div>
        <div className="text-xl md:text-2xl font-semibold">
          €{sector.avgSalaryMin / 1000}k - {sector.avgSalaryMax / 1000}k
        </div>
        <div className="text-xs text-muted-foreground/60 mt-1">{t("sector.italianMarketNote")}</div>
      </div>
      <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
        <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 mr-1.5" /> {t("sector.growth")}
        </div>
        <div className={cn(
          "text-xl md:text-2xl font-semibold",
          sector.growthRate >= 0 ? "text-emerald-600" : "text-amber-600",
        )}>
          {sector.growthRate >= 0 ? "+" : ""}{sector.growthRate}%
        </div>
      </div>
      <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
        <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
          <Clock className="w-4 h-4 mr-1.5" /> {t("sector.trainingTime")}
        </div>
        <div className="text-xl md:text-2xl font-semibold capitalize">
          {t("sector.timeToAutonomyValue", { defaultValue: sector.timeToAutonomy })}
        </div>
      </div>
      <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
        <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
          <Bot className="w-4 h-4 mr-1.5" /> {t("sector.automationRisk")}
        </div>
        <div className="text-xl md:text-2xl font-semibold capitalize">
          {t(`sectors.risk.${sector.automationRisk}`, { defaultValue: sector.automationRisk })}
        </div>
      </div>
    </div>
  );
}

export function SectorFreshness({ sector }: { sector: SectorExtended }) {
  const updatedAt = (sector as unknown as Record<string, unknown>).updatedAt;
  return (
    <div className="flex justify-end mb-4">
      <SectorFreshnessBadge {...(typeof updatedAt === "string" ? { updatedAt } : {})} />
    </div>
  );
}

export function SectorCompareCta({
  sectorId,
  sectorName,
  t,
}: {
  sectorId: number;
  sectorName: string;
  t: TFunction;
}) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4 p-4 rounded-2xl border border-dashed border-border bg-muted/30">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <GitCompare className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t("sector.compareNotSure")}</p>
          <p className="text-xs text-muted-foreground">{t("sector.compareDesc", { name: sectorName })}</p>
        </div>
      </div>
      <Link href={`/confronta?a=${sectorId}`}>
        <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          {t("sector.compare")} <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>
    </div>
  );
}

export function WorkModeAlignmentBadge({
  sector,
  workPreference,
  t,
}: {
  sector: SectorExtended;
  workPreference: WorkPreference;
  t: TFunction;
}) {
  const alignment = getWorkModeAlignment(workPreference, sector.workMode);
  if (!alignment.tooltipKey) return null;
  const title = alignment.tooltipModes
    ? t(alignment.tooltipKey, {
        modes: alignment.tooltipModes.map((mode) => t(`workMode.${mode}`, { defaultValue: mode })).join("/"),
      })
    : t(alignment.tooltipKey);

  return (
    <div
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
        alignment.type === "aligned"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : alignment.type === "partial"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-rose-50 text-rose-700 border-rose-200",
      )}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor:
            alignment.type === "aligned"
              ? "hsl(var(--chart-2))"
              : alignment.type === "partial"
                ? "hsl(var(--chart-1))"
                : "hsl(var(--chart-5))",
        }}
      />
      {alignment.type === "aligned"
        ? t("sector.alignment.aligned")
        : alignment.type === "partial"
          ? t("sector.alignment.partial")
          : t("sector.alignment.misaligned")}
    </div>
  );
}
