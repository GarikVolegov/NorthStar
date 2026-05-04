import React, { useState } from "react";
import { motion } from "framer-motion";
import { usePageMeta } from "@/lib/seo";
import { ResultsSkeleton } from "@/components/skeletons/ResultsSkeleton";
import { useParams, Link, useLocation } from "wouter";
import { useGetTestSession, useConfirmSector, useGetStatsSummary, getGetTestSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, CheckCircle2, TrendingUp, DollarSign, Activity, Bot, BarChart3, AlertTriangle, Sparkles, Star, UserCheck, Bookmark, BookmarkCheck, Newspaper, Brain, Map, GitCompare, GraduationCap, Loader2, Zap, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectorIcon, RIASEC_LABELS } from "@/lib/sector-icon";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { WorkModeSelector, WorkModeBadge, useWorkPreference } from "@/components/WorkModeSelector";
import type { WorkPreference } from "@/components/WorkModeSelector";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { useReducedMotion } from "@/lib/motion";
import { useTranslation } from "react-i18next";
import { getWorkModeAlignment } from "@/lib/work-mode-utils";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import type { ProfessionResult, EducationResult, WorkModeResult } from "@/hooks/useAgentAnalysis";

const BASE = import.meta.env.BASE_URL || "/";

const SPIRIT_META: Record<string, { emoji: string; label: string; color: string }> = {
  shen: { emoji: "✨", label: "Presenza", color: "bg-violet-100 text-violet-700 border-violet-200" },
  hun:  { emoji: "🌙", label: "Visione",  color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  po:   { emoji: "⚡", label: "Istinto",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  yi:   { emoji: "🔮", label: "Focus",    color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  zhi:  { emoji: "🔥", label: "Tenacia",  color: "bg-rose-100 text-rose-700 border-rose-200" },
};

const SPIRIT_DESCRIPTIONS: Record<string, string> = {
  shen: "Coscienza & Presenza",
  hun:  "Visione & Direzione",
  po:   "Istinto & Energia",
  yi:   "Concentrazione & Analisi",
  zhi:  "Volontà & Resilienza",
};

const SPIRIT_RADAR_ORDER = ["shen", "hun", "po", "yi", "zhi"] as const;

const RIASEC_SUGGESTED_WORK_MODE: Record<string, WorkPreference> = {
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

function SpiritBar({ spirit, score }: { spirit: string; score: number }) {
  const { t } = useTranslation();
  const meta = SPIRIT_META[spirit];
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

function SpiritRadarChart({ spiritScores }: { spiritScores: Record<string, number> }) {
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

function SectorBookmarkButton({ sectorId }: { sectorId: number }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isSectorFavorite, getSectorFavoriteId, addFavorite, removeFavorite, isLoading } = useFavorites();
  if (!user) return null;
  const saved = isSectorFavorite(sectorId);
  const favId = getSectorFavoriteId(sectorId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); saved && favId !== undefined ? removeFavorite(favId) : addFavorite({ type: "sector", sectorId }); }}
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
  low:    { label: "Basso",  score: 3, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  medium: { label: "Medio",  score: 2, color: "text-amber-700 bg-amber-50 border-amber-200" },
  high:   { label: "Alto",   score: 1, color: "text-rose-700 bg-rose-50 border-rose-200" },
};

type Rec = {
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

function QuickCompare({ recs }: { recs: Rec[] }) {
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

  const PAIRS = [
    [0, 1], [0, 2], [1, 2],
  ].filter(([a, b]) => a < cols.length && b < cols.length);

  const ACCENT = ["hsl(var(--primary))", "#7c3aed", "#0891b2"];
  const ACCENT_CLS = [
    "bg-primary/10 text-primary border-primary/20",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
  ];

  function Cell({ val, isWinner, className }: { val: string; isWinner: boolean; className?: string }) {
    return (
      <td className={cn(
        "px-4 py-3 text-sm text-center font-medium transition-colors",
        isWinner ? "text-emerald-700 font-bold" : "text-foreground",
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
        <span className="text-sm text-muted-foreground ml-1">· {t("results.quickCompareBest")}</span>
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
                    val={`€${(rec.sector?.avgSalaryMax ?? 0) / 1000}k`}
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
                  const meta = RISK_LABEL[rec.sector?.automationRisk ?? ""] ?? RISK_LABEL["medium"];
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
                    val={t(`confronta.trend.${rec.sector?.trend ?? "stable"}`, { defaultValue: rec.sector?.trend ?? "—" })}
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
              href={`/confronta?a=${cols[a].sectorId}&b=${cols[b].sectorId}`}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-card text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors">
                <span
                  className={cn("inline-block w-2 h-2 rounded-full border", ACCENT_CLS[a])}
                  style={{ backgroundColor: ACCENT[a] }}
                />
                {cols[a].sector?.name?.split(" ")[0]}
                <span className="text-muted-foreground">{t("results.vs")}</span>
                <span
                  className="inline-block w-2 h-2 rounded-full border"
                  style={{ backgroundColor: ACCENT[b] }}
                />
                {cols[b].sector?.name?.split(" ")[0]}
                <ArrowRight className="w-3 h-3 ml-0.5 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Results() {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  usePageMeta({
    title: t("seo.test.title"),
    description: t("seo.test.description"),
    noIndex: true,
  });
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: session, isLoading, error } = useGetTestSession(id, {
    query: { queryKey: getGetTestSessionQueryKey(id), enabled: !!id }
  });

  const { data: stats } = useGetStatsSummary();
  const confirmSector = useConfirmSector();
  const queryClient = useQueryClient();

  const { workPreference, save: saveWorkPreference, isLoading: isSavingWorkPref } = useWorkPreference(user?.id);
  const [workModeConfirmed, setWorkModeConfirmed] = useState(false);
  const [anonymousWorkMode, setAnonymousWorkMode] = useState<WorkPreference | null>(null);
  const [overriddenRecs, setOverriddenRecs] = useState<typeof session | null>(null);

  // Effective session merges server data with any anonymous work-mode re-rank
  const effectiveSession = overriddenRecs ?? session;

  const handleConfirm = (sectorId: number) => {
    confirmSector.mutate({ id, data: { sectorId } }, {
      onSuccess: () => {
        if (user) {
          setLocation("/");
        } else {
          const wm = anonymousWorkMode ?? "unknown";
          setLocation(`/registra?session=${id}&sector=${sectorId}&work_mode=${wm}`);
        }
      },
    });
  };

  const handleInlineWorkModeSelect = async (mode: WorkPreference) => {
    if (user) {
      await saveWorkPreference(mode);
      await queryClient.refetchQueries({ queryKey: getGetTestSessionQueryKey(id) });
    } else {
      // For anonymous users: re-fetch session with work_mode override to re-rank recommendations
      setAnonymousWorkMode(mode);
      try {
        const BASE = import.meta.env.BASE_URL || "/";
        const res = await fetch(`${BASE}api/test-sessions/${id}?work_mode=${mode}`);
        if (res.ok) {
          const data = await res.json();
          setOverriddenRecs(data);
        }
      } catch {
        // non-critical — keep current rankings if fetch fails
      }
    }
    setWorkModeConfirmed(true);
  };

  if (isLoading) {
    return <ResultsSkeleton />;
  }

  if (error || !session) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-6 opacity-80" />
        <h2 className="text-3xl font-serif font-bold mb-4">{t("results.sessionNotFound")}</h2>
        <p className="text-muted-foreground mb-8">{t("results.sessionNotFoundDesc")}</p>
        <Button asChild><Link href="/test">{t("results.retakeTest")}</Link></Button>
      </div>
    );
  }

  type SessionExt = typeof session & {
    spiritScores?: Record<string, number> | null;
    dominantSpirit?: string | null;
    spiritInsight?: string | null;
    suggestedWorkMode?: WorkPreference | null;
  };
  const s = session as SessionExt;

  const primaryTypes = s.primaryTypes as string[];
  const primaryProfile = primaryTypes.join(" + ");
  const spiritScores = s.spiritScores;
  const dominantSpirit = s.dominantSpirit;
  const spiritInsight = s.spiritInsight;
  const hasSpiritData = spiritScores && Object.keys(spiritScores).length > 0;
  const dominantMeta = dominantSpirit ? SPIRIT_META[dominantSpirit] : null;

  const suggestedWorkMode: WorkPreference =
    s.suggestedWorkMode ?? (RIASEC_SUGGESTED_WORK_MODE[primaryTypes[0]] ?? "ibrido");
  const suggestedLabel = t(`results.workModes.${suggestedWorkMode}`);

  const riasecScoresAI = session.riasecScores as Record<string, number> | undefined;
  const topSectorsForAgent = (session.recommendations as Rec[])
    .map((r) => ({ sectorName: r.sector?.name ?? "" }))
    .filter((r) => r.sectorName);
  const { data: agentData, isLoading: agentLoading, isError: agentError } = useAgentAnalysis({
    sessionId: Number(id),
    riasecScores: riasecScoresAI,
    primaryTypes: session.primaryTypes as string[],
    spiritScores: spiritScores as Record<string, number> | undefined,
    topSectors: topSectorsForAgent,
    enabled: !!user,
  });
  const agentProfessions = agentData?.data?.summary?.professions ?? [];
  const agentEducation = agentData?.data?.summary?.educationPaths ?? [];
  const agentWorkMode = agentData?.data?.summary?.workMode;
  const isPremiumAgent = agentData?.plan === "premium";

  return (
    <div className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">

      {/* Saved banner — shown when logged in */}
      {user && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-5 py-3 mb-8 animate-in slide-in-from-top-2 fade-in duration-500">
          <UserCheck className="w-5 h-5 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium">
            {t("results.savedBanner", { name: user.name })}
          </p>
        </div>
      )}

      {/* Profile Header */}
      <div className="text-center mb-12 max-w-3xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
        <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
          {t("results.riasecProfile")}
        </Badge>
        <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 capitalize text-foreground">
          {primaryProfile}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
          {session.profileSummary}
        </p>
      </div>

      {/* Bussola Interiore — Spirit Panel */}
      {hasSpiritData && (
        <div className="mb-14 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="bg-gradient-to-br from-primary/5 via-background to-primary/5 border border-primary/15 rounded-3xl p-6 md:p-8">

            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">{t("results.innerCompass")}</h2>
                <p className="text-sm text-muted-foreground">{t("results.fiveSpirits")}</p>
              </div>
              {dominantMeta && (
                <div className={cn("ml-auto flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm font-semibold", dominantMeta.color)}>
                  <span>{dominantMeta.emoji}</span>
                  {t(`results.spirits.${dominantSpirit}`, { defaultValue: dominantMeta.label })} {t("results.dominantSpirit")}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="flex flex-col items-center justify-center bg-background/40 rounded-2xl border border-primary/10 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  {t("results.innerCompass")}
                </p>
                <SpiritRadarChart spiritScores={spiritScores!} />
              </div>
              {spiritInsight && (
                <div className="flex flex-col justify-center bg-background/60 rounded-2xl p-6 border border-primary/10">
                  <div className="text-2xl mb-3">{dominantMeta?.emoji ?? "✨"}</div>
                  <h3 className="font-semibold text-foreground mb-2 text-sm uppercase tracking-wide">
                    {t("results.innerCompass")}
                  </h3>
                  <p className="text-foreground leading-relaxed">{spiritInsight}</p>
                </div>
              )}
            </div>

            <div className="bg-background/40 rounded-2xl border border-primary/10 p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                {t("results.fiveSpirits")}
              </p>
              {(["shen", "hun", "po", "yi", "zhi"] as const).map((key) => {
                const score = spiritScores![key];
                if (score == null) return null;
                return <SpiritBar key={key} spirit={key} score={score} />;
              })}
            </div>
          </div>
        </div>
      )}

      <Separator className="mb-12" />

      {/* Work Mode Step — shown inline BEFORE sector confirmation for all users */}
      {(!workModeConfirmed && (!user || workPreference === "unknown")) && (
        <div className="mb-12 bg-gradient-to-br from-primary/3 via-background to-primary/3 border border-primary/15 rounded-3xl p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <WorkModeSelector
            suggestedMode={suggestedWorkMode}
            suggestedLabel={suggestedLabel}
            onSelect={handleInlineWorkModeSelect}
            isPending={isSavingWorkPref}
          />
        </div>
      )}

      {/* Recommendations */}
      <div className="mb-12">
        <AnimateOnScroll>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-center mb-4">
            {t("results.yourSectors")}
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            {t("results.sectorCount", { count: (effectiveSession?.recommendations ?? session?.recommendations ?? []).length })}
          </p>
        </AnimateOnScroll>

        <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {((effectiveSession?.recommendations ?? session?.recommendations ?? []) as Rec[]).map((rec, index) => {
            const workModes = rec.sector?.workMode ?? null;
            const currentWorkMode = user ? workPreference : anonymousWorkMode;
            const alignment = getWorkModeAlignment(currentWorkMode, workModes);

            return (
              <AnimateOnScrollItem key={rec.sectorId}>
              <motion.div
                whileHover={prefersReduced ? undefined : { y: -4, boxShadow: "0 12px 32px -4px hsl(160 20% 30% / 0.14)" }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
              >
              <Card
                className={cn(
                  "flex flex-col border-2 overflow-hidden transition-colors duration-300",
                  rec.matchScore >= 90 ? "border-primary shadow-lg" : "border-border",
                )}
              >
                {rec.matchScore >= 90 && (
                  <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-1.5">
                    {t("results.matchScore", { score: rec.matchScore })}
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center text-primary">
                      <SectorIcon name={rec.sector?.icon} size={26} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono font-medium text-sm">
                        {rec.matchScore}% Match
                      </Badge>
                      <SectorBookmarkButton sectorId={rec.sectorId} />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-serif">{rec.sector?.name}</CardTitle>
                  <CardDescription className="text-sm line-clamp-2 mt-2">
                    {rec.sector?.description}
                  </CardDescription>
                  <div className="mt-3 flex flex-col gap-2">
                    {workModes && workModes.length > 0 && (
                      <WorkModeBadge modes={workModes} size="xs" />
                    )}
                    {currentWorkMode && currentWorkMode !== "unknown" && alignment.tooltipKey && (
                      <div title={t(alignment.tooltipKey, alignment.tooltipModes ? { modes: alignment.tooltipModes.map(m => t(`workMode.${m}`, { defaultValue: m })).join("/") } : undefined)} className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border w-fit",
                        alignment.type === "aligned" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        alignment.type === "partial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-rose-50 text-rose-700 border-rose-200"
                      )}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{
                          backgroundColor: 
                            alignment.type === "aligned" ? "rgb(16 185 129)" :
                            alignment.type === "partial" ? "rgb(217 119 6)" :
                            "rgb(220 38 38)"
                        }} />
                        {alignment.type === "aligned" ? t("results.alignment.aligned") :
                         alignment.type === "partial" ? t("results.alignment.partial") :
                         t("results.alignment.misaligned")}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="space-y-4">
                    <div className="bg-muted rounded-lg p-3 text-sm flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-foreground">{rec.matchReason}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                          <DollarSign className="w-3.5 h-3.5 mr-1" /> {t("sector.annualSalary")}
                        </div>
                        <span className="font-semibold text-sm">
                          €{(rec.sector?.avgSalaryMin ?? 0) / 1000}k - €{(rec.sector?.avgSalaryMax ?? 0) / 1000}k
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                          <TrendingUp className="w-3.5 h-3.5 mr-1" /> {t("common.growth")}
                        </div>
                        <span className="font-semibold text-sm text-emerald-600">
                          {t("sector.annualGrowth", { rate: rec.sector?.growthRate })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                          <Activity className="w-3.5 h-3.5 mr-1" /> {t("common.trend")}
                        </div>
                        <span className="font-semibold text-sm capitalize">
                          {t(`results.trend.${rec.sector?.trend}`, { defaultValue: rec.sector?.trend ?? "" })}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-muted-foreground text-xs font-medium uppercase tracking-wider">
                          <Bot className="w-3.5 h-3.5 mr-1" /> {t("sector.automationRisk")}
                        </div>
                        <span className="font-semibold text-sm capitalize">
                          {t(`results.risk.${rec.sector?.automationRisk}`, { defaultValue: rec.sector?.automationRisk ?? "" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-6 pt-0 flex flex-col gap-3">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/settore/${rec.sectorId}`}>{t("home.personalized.fullDetail")}</Link>
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => handleConfirm(rec.sectorId)}
                    disabled={confirmSector.isPending}
                  >
                    {user ? t("results.confirmSector") : t("results.confirmSectorDesc")}
                  </Button>
                </CardFooter>
              </Card>
              </motion.div>
              </AnimateOnScrollItem>
            );
          })}
        </AnimateOnScroll>

        <QuickCompare recs={session.recommendations as Rec[]} />
      </div>

      {/* AI Analysis Section */}
      <div className="mt-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">{t("results.aiSection.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {!user
                ? t("results.aiSection.loginDesc")
                : agentLoading
                  ? t("results.aiSection.loadingDesc")
                  : agentData
                    ? isPremiumAgent
                      ? t("results.aiSection.planPremium", { count: agentProfessions.length })
                      : t("results.aiSection.planFree", { count: agentProfessions.length })
                    : t("results.aiSection.genericDesc")}
            </p>
          </div>
          {isPremiumAgent && (
            <div className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              <Crown className="w-3 h-3" /> Premium
            </div>
          )}
        </div>

        {!user && (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <Bot className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="font-serif text-xl font-bold mb-2">{t("results.aiSection.loginTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-lg mx-auto">
              {t("results.aiSection.loginBody")}
            </p>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/registra"><Sparkles className="w-3.5 h-3.5 mr-1.5" />{t("results.aiSection.loginBtn")}</Link>
            </Button>
          </div>
        )}

        {user && agentLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-primary animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">{t("results.aiSection.loadingMsg")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border p-5 space-y-3">
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user && agentError && !agentLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{t("results.aiSection.errorMsg")}</p>
          </div>
        )}

        {user && agentData && !agentLoading && (
          <div className="space-y-8">

            {/* Professions */}
            {agentProfessions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{t("results.aiSection.professionsTitle")}</h3>
                  {!isPremiumAgent && (
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 ml-1">{t("results.aiSection.freeLabel")}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {agentProfessions.map((p, i) => (
                    <div key={`${p.title}-${i}`} className="rounded-2xl border bg-card p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1.5 inline-block">#{i + 1}</span>
                          <h4 className="font-semibold text-foreground leading-snug">{p.title}</h4>
                          <p className="text-xs text-muted-foreground">{p.sector}</p>
                        </div>
                        {p.growthOutlook && (
                          <span className="shrink-0 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {p.growthOutlook}
                          </span>
                        )}
                      </div>
                      {p.salaryRange && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{p.salaryRange}</span>
                        </div>
                      )}
                      {p.skills && p.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {p.skills.slice(0, 4).map((sk) => (
                            <span key={sk} className="text-xs bg-primary/8 text-primary rounded-full px-2.5 py-0.5 font-medium">{sk}</span>
                          ))}
                        </div>
                      )}
                      {p.riasecAlignment && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.riasecAlignment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Mode — premium */}
            {agentWorkMode && (
              <div className="rounded-2xl border bg-card p-5 md:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-700">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{t("results.aiSection.workModeTitle")}</h3>
                    {isPremiumAgent && <span className="text-xs text-amber-700">{t("results.aiSection.premiumBadge")}</span>}
                  </div>
                  <span className="ml-auto text-sm font-semibold text-primary border border-primary/20 bg-primary/5 rounded-full px-3 py-1">
                    {agentWorkMode.recommendedLabel ?? agentWorkMode.recommended}
                  </span>
                </div>
                {agentWorkMode.riasecFit && <p className="text-sm text-muted-foreground mb-3">{agentWorkMode.riasecFit}</p>}
                {agentWorkMode.contextualAdvice && (
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-sm text-foreground">{agentWorkMode.contextualAdvice}</p>
                  </div>
                )}
              </div>
            )}

            {/* Premium upsell */}
            {!isPremiumAgent && (
              <div className="rounded-2xl border border-dashed p-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">{t("results.aiSection.upsellTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("results.aiSection.upsellDesc")}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Link href="/premium"><Crown className="w-3.5 h-3.5 mr-1.5" />{t("results.aiSection.upsellBtn")}</Link>
                </Button>
              </div>
            )}

            {/* Education paths — premium only */}
            {isPremiumAgent && agentEducation.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-foreground">{t("results.aiSection.educationTitle")}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agentEducation.map((e, i) => (
                    <div key={`${e.path}-${i}`} className="rounded-2xl border bg-card p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{e.path}</h4>
                          <p className="text-xs text-muted-foreground">{e.type}</p>
                        </div>
                        <div className="shrink-0 text-right space-y-0.5">
                          {e.duration && <p className="text-xs text-muted-foreground">{e.duration}</p>}
                          {e.cost && <p className="text-xs font-medium text-primary">{e.cost}</p>}
                        </div>
                      </div>
                      {e.steps?.slice(0, 3).map((step, si) => (
                        <div key={si} className="flex items-start gap-2 text-xs text-muted-foreground mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {step}
                        </div>
                      ))}
                      {e.careerOutcomes && e.careerOutcomes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {e.careerOutcomes.slice(0, 3).map((o) => (
                            <span key={o} className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">{o}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/dashboard">
                <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                  {t("results.aiSection.dashboardLink")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="mt-20 bg-card border rounded-2xl p-8 text-center animate-in fade-in duration-1000 delay-500">
          <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="font-serif text-xl font-medium mb-2">{t("results.statsFooterTitle")}</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("results.statsFooterDesc", { count: stats.totalTestsTaken })} {stats.topSectors.slice(0, 3).map(s => s.name).join(", ")}.
          </p>
        </div>
      )}

      {/* Premium upgrade CTA */}
      <div className="mt-10 rounded-3xl overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-primary/5 animate-in fade-in duration-1000 delay-700">
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-primary/10">
          <div className="flex flex-col items-center text-center p-8 gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground text-sm">{t("premium.features.updates.title")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("premium.features.updates.desc")}
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-8 gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground text-sm">{t("premium.features.wiki.title")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("premium.features.wiki.desc")}
            </p>
          </div>
          <div className="flex flex-col items-center text-center p-8 gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Map className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground text-sm">{t("premium.features.roadmap.title")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("premium.features.roadmap.desc")}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-8 py-6 border-t border-primary/10 bg-primary/3">
          <p className="text-sm text-muted-foreground">{t("sector.deepenWithAI")}</p>
          <Button asChild className="rounded-full" size="sm">
            <Link href="/premium"><Sparkles className="h-3.5 w-3.5 mr-1.5" />{t("wiki.upgrade")}</Link>
          </Button>
        </div>
      </div>

    </div>
  );
}
