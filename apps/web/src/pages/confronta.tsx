import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePageMeta } from "@/lib/seo";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorIcon, RIASEC_LABELS } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import {
  TrendingUp, DollarSign, Bot, Clock, ArrowRight,
  GitCompare, ChevronDown, X, Check, Minus, Plus,
  Sparkles, BarChart2, Link2, Copy, CheckCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type Sector = {
  id: number; name: string; icon: string; description: string;
  riasecTypes: string[]; skills: string[]; avgSalaryMin: number;
  avgSalaryMax: number; growthRate: number; automationRisk: string;
  scalability: string; trend: string; timeToAutonomy: string;
  advantages: string[]; disadvantages: string[]; opportunities: string[];
  color: string;
};

const TREND_META: Record<string, { label: string; color: string; score: number }> = {
  booming:  { label: "In forte crescita", color: "text-emerald-700 bg-emerald-50 border-emerald-200", score: 4 },
  growing:  { label: "In crescita",        color: "text-blue-700 bg-blue-50 border-blue-200",         score: 3 },
  stable:   { label: "Stabile",            color: "text-muted-foreground bg-muted border-border",      score: 2 },
  declining:{ label: "In calo",            color: "text-rose-700 bg-rose-50 border-rose-200",          score: 1 },
};
const RISK_META: Record<string, { label: string; color: string; score: number }> = {
  low:    { label: "Basso",  color: "text-emerald-700 bg-emerald-50 border-emerald-200", score: 3 },
  medium: { label: "Medio",  color: "text-amber-700 bg-amber-50 border-amber-200",       score: 2 },
  high:   { label: "Alto",   color: "text-rose-700 bg-rose-50 border-rose-200",           score: 1 },
};
const SCALE_META: Record<string, { label: string }> = {
  high:   { label: "Alta" },
  medium: { label: "Media" },
  low:    { label: "Bassa" },
};

function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors-compare"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors`);
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    staleTime: 300_000,
  });
}

function SectorPicker({
  sectors, value, onChange, label, otherValue,
}: {
  sectors: Sector[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
  otherValue: number | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = sectors.find((s) => s.id === value) ?? null;
  const filtered = sectors.filter(
    (s) => s.id !== otherValue && s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-3 p-4 rounded-2xl border bg-card text-left transition-colors cursor-pointer select-none",
          open ? "border-primary/50 shadow-sm" : "hover:border-primary/30"
        )}
      >
        {selected ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <SectorIcon name={selected.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{t("confronta.pickerChangeHint")}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-muted-foreground">{label}</p>
              <p className="text-xs text-muted-foreground/60">{t("confronta.pickerChoose")}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border rounded-2xl shadow-lg overflow-hidden">
          <div className="p-3 border-b">
            <input
              autoFocus
              placeholder={t("confronta.pickerSearch")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary shrink-0">
                  <SectorIcon name={s.icon} size={16} />
                </div>
                <span className="text-sm font-medium text-foreground">{s.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">{t("confronta.noResults")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WinnerBadge({ side }: { side: "left" | "right" | "tie" }) {
  const { t } = useTranslation();
  if (side === "tie") return <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted">{t("confronta.tie")}</span>;
  return (
    <span className={cn(
      "text-xs font-bold px-2 py-0.5 rounded-full",
      side === "left" ? "bg-primary/15 text-primary" : "bg-violet-100 text-violet-700"
    )}>
      {t("confronta.best")}
    </span>
  );
}

function SalaryBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function Confronta() {
  const { t } = useTranslation();
  usePageMeta({
    title: t("confronta.title"),
    description: t("confronta.subtitle"),
    path: "/confronta",
  });

  const { data: sectors = [], isLoading } = useAllSectors();

  const [leftId, setLeftId] = useState<number | null>(() => {
    const a = new URLSearchParams(window.location.search).get("a");
    return a ? parseInt(a, 10) : null;
  });
  const [rightId, setRightId] = useState<number | null>(() => {
    const b = new URLSearchParams(window.location.search).get("b");
    return b ? parseInt(b, 10) : null;
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (leftId)  params.set("a", String(leftId));
    if (rightId) params.set("b", String(rightId));
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [leftId, rightId]);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const left  = useMemo(() => sectors.find((s) => s.id === leftId)  ?? null, [sectors, leftId]);
  const right = useMemo(() => sectors.find((s) => s.id === rightId) ?? null, [sectors, rightId]);

  const commonSkills = useMemo(() => {
    if (!left || !right) return new Set<string>();
    return new Set(left.skills.filter((sk) => right.skills.includes(sk)));
  }, [left, right]);

  const maxSalary = Math.max(left?.avgSalaryMax ?? 0, right?.avgSalaryMax ?? 0);

  function salaryWinner() {
    if (!left || !right) return "tie";
    if (left.avgSalaryMax > right.avgSalaryMax) return "left";
    if (right.avgSalaryMax > left.avgSalaryMax) return "right";
    return "tie";
  }
  function growthWinner() {
    if (!left || !right) return "tie";
    if (left.growthRate > right.growthRate) return "left";
    if (right.growthRate > left.growthRate) return "right";
    return "tie";
  }
  function riskWinner() {
    if (!left || !right) return "tie";
    const lScore = RISK_META[left.automationRisk]?.score ?? 2;
    const rScore = RISK_META[right.automationRisk]?.score ?? 2;
    if (lScore > rScore) return "left";
    if (rScore > lScore) return "right";
    return "tie";
  }
  function trendWinner() {
    if (!left || !right) return "tie";
    const lScore = TREND_META[left.trend]?.score ?? 2;
    const rScore = TREND_META[right.trend]?.score ?? 2;
    if (lScore > rScore) return "left";
    if (rScore > lScore) return "right";
    return "tie";
  }

  const bothSelected = !!left && !!right;

  return (
    <div className="min-h-screen">

      {/* Header */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-14 md:py-18">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <GitCompare className="w-4 h-4" />
            {t("confronta.badgeLabel")}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("confronta.headline")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("confronta.desc")}
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-10">

        {/* Pickers */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <SectorPicker sectors={sectors} value={leftId} onChange={setLeftId} label={t("confronta.firstSector")} otherValue={rightId} />
            <SectorPicker sectors={sectors} value={rightId} onChange={setRightId} label={t("confronta.secondSector")} otherValue={leftId} />
          </div>
        )}

        {/* Placeholder when not both selected */}
        {!bothSelected && !isLoading && (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
            <GitCompare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="font-serif text-xl font-medium text-foreground mb-2">
              {!leftId && !rightId
                ? t("confronta.chooseBoth")
                : t("confronta.chooseSecond")}
            </p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {t("confronta.placeholderDesc")}
            </p>
          </div>
        )}

        {/* Comparison */}
        {bothSelected && left && right && (
          <div className="space-y-6">

            {/* Share bar */}
            <div className="flex justify-end">
              <button
                onClick={copyLink}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all",
                  copied
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                )}
              >
                {copied
                  ? <><CheckCheck className="w-4 h-4" /> {t("confronta.linkCopied")}</>
                  : <><Link2 className="w-4 h-4" /> {t("confronta.copyLink")}</>
                }
              </button>
            </div>

            {/* Header columns */}
            <div className="grid grid-cols-[1fr_40px_1fr] gap-2 items-center">
              <div className="rounded-2xl border bg-card p-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
                  <SectorIcon name={left.icon} size={28} />
                </div>
                <h2 className="font-serif font-bold text-foreground text-lg leading-snug">{left.name}</h2>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{left.description}</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-muted-foreground font-bold text-lg">VS</span>
              </div>
              <div className="rounded-2xl border bg-card p-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-violet-600 mx-auto mb-3">
                  <SectorIcon name={right.icon} size={28} />
                </div>
                <h2 className="font-serif font-bold text-foreground text-lg leading-snug">{right.name}</h2>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{right.description}</p>
              </div>
            </div>

            {/* ── Stipendio ── */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">{t("confronta.annualSalary")}</h3>
                <WinnerBadge side={salaryWinner()} />
              </div>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { s: left, color: "hsl(var(--primary))", side: "left" as const },
                  { s: right, color: "#7c3aed", side: "right" as const },
                ].map(({ s, color, side }) => (
                  <div key={side}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-bold font-serif text-foreground">
                        €{s.avgSalaryMin / 1000}k
                      </span>
                      <span className="text-sm text-muted-foreground">{t("confronta.upTo", { amount: s.avgSalaryMax / 1000 })}</span>
                    </div>
                    <SalaryBar value={s.avgSalaryMax} max={maxSalary} color={color} />
                    <p className="text-xs text-muted-foreground mt-1">{t("confronta.maximum", { amount: s.avgSalaryMax / 1000 })}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Metriche rapide ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Crescita */}
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">{t("confronta.annualGrowth")}</h3>
                  <WinnerBadge side={growthWinner()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { s: left, color: "text-primary" },
                    { s: right, color: "text-violet-600" },
                  ].map(({ s, color }, i) => (
                    <div key={i} className="text-center p-3 rounded-xl bg-muted/40">
                      <p className={cn("text-2xl font-bold font-serif", color)}>+{s.growthRate}%</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{s.name.split(" ")[0]}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rischio automazione */}
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">{t("confronta.automationRisk")}</h3>
                  <WinnerBadge side={riskWinner()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[left, right].map((s, i) => {
                    const meta = RISK_META[s.automationRisk] ?? RISK_META["medium"];
                    return (
                      <div key={i} className="text-center p-3 rounded-xl bg-muted/40">
                        <span className={cn("text-sm font-bold px-2 py-1 rounded-lg border", meta.color)}>
                          {t(`confronta.risk.${s.automationRisk}`, { defaultValue: meta.label })}
                        </span>
                        <p className="text-xs text-muted-foreground truncate mt-2">{s.name.split(" ")[0]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trend */}
              <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">{t("confronta.marketTrend")}</h3>
                  <WinnerBadge side={trendWinner()} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[left, right].map((s, i) => {
                    const meta = TREND_META[s.trend] ?? TREND_META["stable"];
                    return (
                      <div key={i} className="text-center p-3 rounded-xl bg-muted/40">
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-lg border", meta.color)}>
                          {t(`confronta.trend.${s.trend}`, { defaultValue: meta.label })}
                        </span>
                        <p className="text-xs text-muted-foreground truncate mt-2">{s.name.split(" ")[0]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Dettagli affiancati ── */}
            <div className="grid grid-cols-[1fr_1fr] gap-4">

              {/* Tempo per lavorare autonomamente */}
              <div className="rounded-2xl border bg-card p-5 col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">{t("confronta.timeToAutonomy")}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="font-medium text-foreground">{left.timeToAutonomy}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{left.name}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
                    <p className="font-medium text-foreground">{right.timeToAutonomy}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{right.name}</p>
                  </div>
                </div>
              </div>

              {/* RIASEC */}
              <div className="rounded-2xl border bg-card p-5 col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">{t("confronta.riasecType")}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[left, right].map((s, i) => (
                    <div key={i} className="flex flex-wrap gap-1.5">
                      {s.riasecTypes.map((r) => (
                        <span
                          key={r}
                          title={RIASEC_LABELS[r]?.label}
                          className={cn(
                            "text-xs font-mono font-bold px-2 py-1 rounded-lg border",
                            i === 0
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-violet-100 text-violet-700 border-violet-200"
                          )}
                        >
                          {r} — {RIASEC_LABELS[r]?.label}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Competenze ── */}
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-1">{t("confronta.requiredSkills")}</h3>
              {commonSkills.size > 0 && (
                <p className="text-xs text-muted-foreground mb-4">
                  <span className="font-medium text-primary">{t("confronta.commonSkillsCount", { count: commonSkills.size })}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-6">
                {[
                  { s: left, accentBg: "bg-primary/10", accentText: "text-primary" },
                  { s: right, accentBg: "bg-violet-100", accentText: "text-violet-700" },
                ].map(({ s, accentBg, accentText }) => (
                  <div key={s.id} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{s.name}</p>
                    {s.skills.map((sk) => {
                      const common = commonSkills.has(sk);
                      return (
                        <div
                          key={sk}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-xl text-sm",
                            common ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : `${accentBg} ${accentText}`
                          )}
                        >
                          {common
                            ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            : <Minus className="w-3.5 h-3.5 opacity-40 shrink-0" />
                          }
                          {sk}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Vantaggi / Svantaggi ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { s: left,  accent: "emerald", icon: Plus },
                { s: right, accent: "violet",  icon: Plus },
              ].map(({ s, accent }, i) => (
                <div key={i} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center",
                      i === 0 ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-600"
                    )}>
                      <SectorIcon name={s.icon} size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{s.name}</h3>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">{t("confronta.advantages")}</p>
                    {s.advantages.slice(0, 3).map((adv, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {adv}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">{t("confronta.considerations")}</p>
                    {s.disadvantages.slice(0, 2).map((dis, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Minus className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        {dis}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Opportunità future ── */}
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold text-foreground mb-4">{t("confronta.futureOpportunities")}</h3>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { s: left,  chipCls: "bg-primary/8 text-primary border-primary/15" },
                  { s: right, chipCls: "bg-violet-100 text-violet-700 border-violet-200" },
                ].map(({ s, chipCls }) => (
                  <div key={s.id}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{s.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {s.opportunities.map((opp, i) => (
                        <span key={i} className={cn("text-xs font-medium px-2.5 py-1 rounded-lg border", chipCls)}>
                          {opp}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CTA ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[left, right].map((s, i) => (
                <Link key={s.id} href={`/settore/${s.id}`}>
                  <div className={cn(
                    "rounded-2xl border p-5 text-center hover:shadow-md transition-all cursor-pointer group",
                    i === 0 ? "hover:border-primary/40" : "hover:border-violet-300"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3",
                      i === 0 ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-600"
                    )}>
                      <SectorIcon name={s.icon} size={20} />
                    </div>
                    <p className="font-semibold text-foreground text-sm mb-1">{s.name}</p>
                    <span className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium",
                      i === 0 ? "text-primary" : "text-violet-600"
                    )}>
                      {t("confronta.deepen")} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              ))}
              <Link href="/test">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center hover:shadow-md transition-all cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <p className="font-semibold text-foreground text-sm mb-1">{t("confronta.notSure")}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    {t("confronta.takeFreeTest")} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
