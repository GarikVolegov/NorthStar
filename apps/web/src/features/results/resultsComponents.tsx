import type { WorkPreference } from "@/components/WorkModeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useReducedMotion } from "@/lib/motion";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Bookmark, BookmarkCheck, Bot, DollarSign, GitCompare, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Link } from "wouter";

export const SPIRIT_META: Record<string, { emoji: string; label: string; color: string }> = {
  shen: { emoji: "ðŸ§ ", label: "Intelligenza Emotiva",    color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  hun:  { emoji: "ðŸŽ¯", label: "Orientamento Strategico", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  po:   { emoji: "âš¡", label: "Motivazione e Impulso",   color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  yi:   { emoji: "ðŸ“Š", label: "Pensiero Analitico",      color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  zhi:  { emoji: "ðŸ›¡", label: "Resilienza",              color: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
};

const SPIRIT_DESCRIPTIONS: Record<string, string> = {
  shen: "Riconoscere e gestire le proprie emozioni",
  hun:  "Visione a lungo termine e pianificazione strategica",
  po:   "Energia, iniziativa e fiducia nelle proprie scelte",
  yi:   "Analisi, focus e gestione della complessita",
  zhi:  "Perseveranza e capacita di superare gli ostacoli",
};

export const SPIRIT_RADAR_ORDER = ["shen", "hun", "po", "yi", "zhi"] as const;
void SPIRIT_DESCRIPTIONS;

export const RIASEC_SUGGESTED_WORK_MODE: Record<string, WorkPreference> = {
  E: "autonomo",
  A: "ibrido",
  I: "ibrido",
  R: "dipendente",
  S: "dipendente",
  C: "dipendente",
};

const WORK_MODE_LABELS: Record<WorkPreference, string> = {
  dipendente: "Dipendente",
  autonomo: "Autonomo / Freelance",
  ibrido: "Ibrido",
  unknown: "Non definita",
};
void WORK_MODE_LABELS;

export function SpiritBar({ spirit, score }: { spirit: string; score: number }) {
  const { t } = useTranslation();
  const meta = SPIRIT_META[spirit] ?? SPIRIT_META.shen!;
  if (!meta) return null;
  const pct = ((score - 1) / 4) * 100;
  const displayScore = Number.isInteger(score) ? score : score.toFixed(1);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl w-7 text-center">{meta.emoji}</span>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-foreground">{t(`results.spirits.${spirit}`)}</span>
          <span className="text-xs text-muted-foreground">{t(`results.spirits.${spirit}_desc`)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="text-sm font-bold text-foreground w-8 text-right">{displayScore}</span>
    </div>
  );
}

export function SpiritRadarChart({ spiritScores }: { spiritScores: Record<string, number> }) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const data = SPIRIT_RADAR_ORDER.map((key) => ({
    spirit: `${SPIRIT_META[key]?.emoji} ${t(`results.spirits.${key}`)}`,
    value: spiritScores[key] ?? 0,
    fullMark: 5,
  }));

  return (
    <motion.div
      initial={prefersReduced ? {} : { opacity: 0, scale: 0.88 }}
      animate={prefersReduced ? {} : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 24 }}>
          <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <PolarAngleAxis
            dataKey="spirit"
            tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }}
            tickLine={false}
          />
          <Radar
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.22}
            strokeWidth={2.5}
            dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function SectorBookmarkButton({ sectorId }: { sectorId: number }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSectorFavorite, getSectorFavoriteId, addFavorite, removeFavorite, isLoading } = useFavorites();
  if (!user) return null;
  const saved = isSectorFavorite(sectorId);
  const favId = getSectorFavoriteId(sectorId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (saved && favId !== undefined) removeFavorite(favId); else addFavorite({ type: "sector", sectorId }); }}
      disabled={isLoading}
      title={saved ? t("results.bookmarkRemove") : t("results.bookmarkSave")}
      className={cn(
        "p-2 rounded-xl transition-colors",
        saved ? "text-primary bg-primary/10" : "text-slate-400 hover:text-primary hover:bg-primary/5"
      )}
    >
      {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  );
}

const TREND_LABEL: Record<string, { label: string; score: number }> = {
  booming:  { label: "In forte crescita", score: 4 },
  growing:  { label: "In crescita",       score: 3 },
  stable:   { label: "Stabile",           score: 2 },
  declining:{ label: "In calo",           score: 1 },
};
const RISK_LABEL: Record<string, { label: string; score: number; color: string }> = {
  low:    { label: "Basso",  score: 3, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  medium: { label: "Medio",  score: 2, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  high:   { label: "Alto",   score: 1, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
};

export type Rec = {
  sectorId: number;
  matchScore: number;
  matchReason?: string | null;
  sector?: {
    name?: string; icon?: string; description?: string;
    avgSalaryMin?: number; avgSalaryMax?: number;
    growthRate?: number; automationRisk?: string; trend?: string;
    workMode?: Array<"dipendente" | "autonomo" | "ibrido"> | null;
  } | null;
};

export function QuickCompare({ recs }: { recs: Rec[] }) {
  const { t } = useTranslation();
  if (recs.length < 2) return null;

  const cols = recs.slice(0, 3);

  function winnerIdx(vals: number[]) {
    const max = Math.max(...vals);
    return vals.indexOf(max);
  }

  const salaryVals  = cols.map(r => r.sector?.avgSalaryMax ?? 0);
  const growthVals  = cols.map(r => r.sector?.growthRate   ?? 0);
  const riskVals    = cols.map(r => RISK_LABEL[r.sector?.automationRisk ?? ""]?.score ?? 2);
  const trendVals   = cols.map(r => TREND_LABEL[r.sector?.trend ?? ""]?.score ?? 2);

  const PAIRS = ([
    [0, 1], [0, 2], [1, 2],
  ] as Array<readonly [number, number]>).filter(([a, b]) => a < cols.length && b < cols.length);

  const ACCENT = ["hsl(var(--primary))", "hsl(var(--chart-4))", "hsl(var(--chart-3))"];
  const ACCENT_CLS = [
    "bg-primary/10 text-primary border-primary/20",
    "bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.2)]",
    "bg-[hsl(var(--chart-3)/0.1)] text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3)/0.2)]",
  ];

  function Cell({ val, isWinner, className }: { val: string; isWinner: boolean; className?: string }) {
    return (
      <td className={cn(
        "px-4 py-3 text-sm text-center font-medium transition-colors",
        isWinner ? "text-emerald-400 font-bold" : "text-foreground",
        className,
      )}>
        {isWinner && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 mb-0.5 align-middle" />}
        {val}
      </td>
    );
  }

  return (
    <div className="mt-10 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="w-5 h-5 text-primary" />
        <h3 className="font-serif text-xl font-bold text-foreground">{t("results.quickCompare")}</h3>
        <span className="text-sm text-muted-foreground ml-1">- {t("results.quickCompareBest")}</span>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-32">
                  {t("confronta.vs", { defaultValue: "Metrica" })}
                </th>
                {cols.map((rec, i) => (
                  <th key={rec.sectorId} className="px-4 py-3 text-center min-w-[160px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center",
                        ACCENT_CLS[i],
                      )}>
                        <SectorIcon name={rec.sector?.icon} size={18} />
                      </div>
                      <span className="text-xs font-semibold text-foreground leading-snug line-clamp-2 text-center">
                        {rec.sector?.name ?? t("results.sectorFallback", { n: i + 1 })}
                      </span>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full border",
                        ACCENT_CLS[i],
                      )}>
                        {rec.matchScore}% match
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    {t("results.maxSalary")}
                  </div>
                </td>
                {cols.map((rec, i) => (
                  <Cell
                    key={rec.sectorId}
                    val={`EUR${(rec.sector?.avgSalaryMax ?? 0) / 1000}k`}
                    isWinner={winnerIdx(salaryVals) === i}
                  />
                ))}
              </tr>
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {t("results.annualGrowth")}
                  </div>
                </td>
                {cols.map((rec, i) => (
                  <Cell
                    key={rec.sectorId}
                    val={`+${rec.sector?.growthRate ?? 0}%`}
                    isWinner={winnerIdx(growthVals) === i}
                  />
                ))}
              </tr>
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    {t("common.aiRisk")}
                  </div>
                </td>
                {cols.map((rec, i) => {
                  const meta = RISK_LABEL[rec.sector?.automationRisk ?? ""] ?? RISK_LABEL.medium!;
                  return (
                    <td key={rec.sectorId} className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border",
                        meta.color,
                        winnerIdx(riskVals) === i ? "ring-1 ring-emerald-400/40" : "",
                      )}>
                        {winnerIdx(riskVals) === i && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-0.5" />
                        )}
                        {t(`confronta.risk.${rec.sector?.automationRisk ?? "medium"}`, { defaultValue: meta.label })}
                      </span>
                    </td>
                  );
                })}
              </tr>
              <tr className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    {t("results.marketTrend")}
                  </div>
                </td>
                {cols.map((rec, i) => (
                  <Cell
                    key={rec.sectorId}
                    val={t(`confronta.trend.${rec.sector?.trend ?? "stable"}`, { defaultValue: rec.sector?.trend ?? "-" })}
                    isWinner={winnerIdx(trendVals) === i}
                  />
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4 border-t bg-muted/20">
          <span className="text-xs text-muted-foreground font-medium mr-1">{t("results.deepCompare")}</span>
          {PAIRS.map(([a, b]) => (
            <Link
              key={`${a}-${b}`}
              href={`/confronta?a=${cols[a]!.sectorId}&b=${cols[b]!.sectorId}`}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors">
                <span
                  className={cn("inline-block w-2 h-2 rounded-full border", ACCENT_CLS[a] ?? ACCENT_CLS[0])}
                  style={{ backgroundColor: ACCENT[a] ?? ACCENT[0] }}
                />
                {cols[a]?.sector?.name?.split(" ")[0]}
                <span className="text-muted-foreground">{t("results.vs")}</span>
                <span
                  className="inline-block w-2 h-2 rounded-full border"
                  style={{ backgroundColor: ACCENT[b] ?? ACCENT[0] }}
                />
                {cols[b]?.sector?.name?.split(" ")[0]}
                <ArrowRight className="w-3 h-3 ml-0.5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

