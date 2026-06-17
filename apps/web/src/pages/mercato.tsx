import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/apiClient";
import { useSubscription } from "@/hooks/useSubscription";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Lock,
  Radar,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

type AutomationRisk = "low" | "medium" | "high";
type SectorTrend = "declining" | "stable" | "growing" | "booming";

interface SectorRow {
  id: number;
  name: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  growthRate: number;
  automationRisk: AutomationRisk;
  trend: SectorTrend;
  icon: string;
  color: string;
}
interface Overview {
  sectors: SectorRow[];
  signalsTeaser: { total: number; preview: string[] };
  generatedAt: string;
}
interface Signal {
  id: number;
  signalType: string;
  title: string;
  description: string;
  strength: number;
  status: string;
  linkedSkills: string[];
  geographies: string[];
  firstSeenAt: string;
}
interface EmergingSkill {
  skill: string;
  coSkill: string;
  frequency: number;
  frequencyRate: number;
}
interface SignalsResp {
  signals: Signal[];
  emergingSkills: EmergingSkill[];
  generatedAt: string;
}

const RISK_STYLE: Record<AutomationRisk, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};
const RISK_LABEL: Record<AutomationRisk, string> = {
  low: "Rischio automazione basso",
  medium: "Rischio automazione medio",
  high: "Rischio automazione alto",
};
const TREND_STYLE: Record<SectorTrend, string> = {
  booming: "bg-emerald-100 text-emerald-800",
  growing: "bg-emerald-50 text-emerald-700",
  stable: "bg-muted text-muted-foreground",
  declining: "bg-rose-50 text-rose-700",
};
const TREND_LABEL: Record<SectorTrend, string> = {
  booming: "In forte crescita",
  growing: "In crescita",
  stable: "Stabile",
  declining: "In calo",
};

function eurK(n: number): string {
  return `€${Math.round(n / 1000)}k`;
}

export default function Mercato() {
  const { canAccess } = useSubscription();
  const canSignals = canAccess("weak_signals");

  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ["market-overview"],
    queryFn: () => getJson<Overview>(`${BASE}api/market/overview`),
    staleTime: 10 * 60 * 1000,
  });

  const { data: signals } = useQuery<SignalsResp>({
    queryKey: ["market-signals"],
    queryFn: () => getJson<SignalsResp>(`${BASE}api/market/signals`),
    enabled: canSignals,
    staleTime: 10 * 60 * 1000,
  });

  const sectors = overview?.sectors ?? [];
  const maxSalary = Math.max(1, ...sectors.map((s) => s.avgSalaryMax));
  const teaser = overview?.signalsTeaser ?? { total: 0, preview: [] };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Radar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-2xl">Intelligence di Mercato</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stipendi, domanda e segnali emergenti del mercato IT italiano
          </p>
        </div>
      </div>

      {/* ── Radar stipendi & domanda (FREE) ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Radar stipendi & domanda</h2>
          <Badge variant="outline" className="text-[10px]">Gratis</Badge>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : sectors.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
            Dati di mercato non disponibili al momento.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {sectors.map((s) => (
              <Card key={s.id} className="rounded-2xl">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link
                      href={`/settore/${s.id}`}
                      className="font-semibold text-sm hover:text-primary transition-colors truncate"
                    >
                      {s.name}
                    </Link>
                    <span
                      className={`text-xs font-bold shrink-0 ${
                        s.growthRate > 0
                          ? "text-emerald-600"
                          : s.growthRate < 0
                            ? "text-rose-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.growthRate > 0 ? "+" : ""}
                      {s.growthRate}%
                    </span>
                  </div>

                  {/* Salary range bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">RAL media</span>
                      <span className="font-semibold">
                        {eurK(s.avgSalaryMin)}–{eurK(s.avgSalaryMax)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{
                          marginLeft: `${(s.avgSalaryMin / maxSalary) * 100}%`,
                          width: `${((s.avgSalaryMax - s.avgSalaryMin) / maxSalary) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className={`text-[10px] ${TREND_STYLE[s.trend]}`}>
                      {TREND_LABEL[s.trend]}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${RISK_STYLE[s.automationRisk]}`}>
                      {RISK_LABEL[s.automationRisk]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Segnali emergenti (PRO) ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Segnali emergenti</h2>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Pro</Badge>
        </div>

        {!canSignals ? (
          // Teaser bloccato → upgrade
          <Card className="border-2 border-primary/20">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">
                    {teaser.total > 0
                      ? `${teaser.total} segnali emergenti rilevati`
                      : "Segnali emergenti del mercato"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ruoli e skill in ascesa, prima che diventino mainstream
                  </p>
                </div>
              </div>

              {teaser.preview.length > 0 && (
                <div className="space-y-2 mb-5">
                  {teaser.preview.map((title, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium blur-[3px] select-none">{title}</span>
                      <Lock className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              <Button asChild className="rounded-full">
                <Link href="/premium">
                  <Sparkles className="w-4 h-4 mr-2" /> Sblocca con Pro
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (signals?.signals.length ?? 0) === 0 &&
          (signals?.emergingSkills.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground bg-muted/40 rounded-xl p-4">
            Stiamo aggiornando i segnali di mercato. Torna a breve per le ultime tendenze.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Weak signals */}
            {(signals?.signals.length ?? 0) > 0 && (
              <div className="space-y-3">
                {signals!.signals.map((sig) => (
                  <Card key={sig.id} className="rounded-2xl">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-semibold text-sm">{sig.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {Math.round(sig.strength * 100)}% forza
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {sig.description}
                      </p>
                      {sig.linkedSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {sig.linkedSkills.slice(0, 6).map((sk) => (
                            <span
                              key={sk}
                              className="text-[10px] bg-muted px-2 py-0.5 rounded-full"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Emerging skills (co-occurrence) */}
            {(signals?.emergingSkills.length ?? 0) > 0 && (
              <Card className="rounded-2xl">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-semibold">Skill che crescono insieme</span>
                  </div>
                  <div className="space-y-2">
                    {signals!.emergingSkills.map((sk, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="truncate mr-3">
                          <span className="font-medium">{sk.skill}</span>
                          <span className="text-muted-foreground"> + {sk.coSkill}</span>
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 shrink-0">
                          {sk.frequencyRate}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
