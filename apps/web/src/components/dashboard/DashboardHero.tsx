import { HelpCircle, TrendingUp, Rocket, Building2, BarChart3, Crown, MapPin, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { DashboardSession } from "@/hooks/useDashboardData";

type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface JourneyMeta {
  icon: LucideIcon;
  headline: string;
  subline: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const JOURNEY_META: Record<JourneyId, JourneyMeta> = {
  indeciso:    { icon: HelpCircle,  headline: "Scopri la tua strada",      subline: "Capisci chi sei e cosa vuoi fare",        color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
  dipendente:  { icon: TrendingUp,  headline: "Accelera la tua carriera",  subline: "Skill, colloqui e candidature mirate",   color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30" },
  autonomo:    { icon: Rocket,      headline: "Scala la tua attività",     subline: "Idee, mercati e strategia",              color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
  azienda:     { icon: Building2,   headline: "Trova i profili giusti",    subline: "Esplora, pubblica e assumi",             color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30" },
  investitore: { icon: BarChart3,   headline: "Analizza le opportunità",  subline: "Settori, trend e dati di mercato",        color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
};

interface Metrics {
  label: string;
  value: string | number;
}

const PERSONA_METRICS: Record<string, (session: DashboardSession | null) => Metrics[]> = {
  indeciso: (s) => [
    { label: "Test", value: s ? "Completato" : "Da fare" },
    { label: "Settori esplorati", value: s?.recommendations?.length ?? 0 },
    { label: "Percorso", value: "Da scegliere" },
  ],
  dipendente: () => [
    { label: "Competenze", value: "0" },
    { label: "Colloqui simulati", value: "0" },
    { label: "Candidature", value: "0" },
  ],
  autonomo: () => [
    { label: "Idee validate", value: "0" },
    { label: "Settori monitorati", value: "0" },
    { label: "Strumenti usati", value: "0" },
  ],
  azienda: () => [
    { label: "Profili esplorati", value: "0" },
    { label: "Settori analizzati", value: "21" },
    { label: "Offerte pubblicate", value: "0" },
  ],
  investitore: () => [
    { label: "Settori monitorati", value: "0" },
    { label: "Report analizzati", value: "0" },
    { label: "Trend attivi", value: "0" },
  ],
};

export function DashboardHero({
  journeyType,
  session,
  isPremium,
}: {
  journeyType: string | null | undefined;
  session: DashboardSession | null;
  isPremium: boolean;
}) {
  const meta = journeyType ? JOURNEY_META[journeyType as JourneyId] : null;
  const Icon = meta?.icon ?? HelpCircle;
  const metrics = journeyType
    ? (PERSONA_METRICS[journeyType]?.(session) ?? [])
    : [];

  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="hero-navy px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          {meta ? (
            <>
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", meta.bgColor, meta.borderColor)}>
                <Icon className={cn("w-6 h-6", meta.color)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">Percorso</p>
                <h2 className="font-bold text-white text-lg">{meta.headline}</h2>
                <p className="text-xs text-white/60">{meta.subline}</p>
              </div>
            </>
          ) : (
            <div>
              <h2 className="font-bold text-white text-lg">Il tuo pannello di controllo</h2>
              <p className="text-xs text-white/60">Scegli il tuo percorso per personalizzare gli strumenti</p>
            </div>
          )}
        </div>

        {metrics.length > 0 && (
          <div className="flex gap-4 flex-wrap">
            {metrics.map((m) => (
              <div key={m.label} className="text-center min-w-[70px]">
                <div className="text-lg font-bold text-white">{m.value}</div>
                <div className="text-xs text-white/50">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!journeyType && (
            <Link href="/percorso">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-xs rounded-full px-4 py-2 hover:bg-primary/90 transition-all">
                <MapPin className="w-3.5 h-3.5" /> Scegli il percorso
              </div>
            </Link>
          )}
          {journeyType && (
            <Link href="/percorso">
              <div className="inline-flex items-center gap-1.5 border border-white/20 text-white/70 text-xs rounded-full px-3 py-1.5 hover:border-white/30 hover:text-white transition-all">
                <MapPin className="w-3 h-3" /> Cambia percorso
              </div>
            </Link>
          )}
          {isPremium ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/15 border border-primary/30 rounded-full px-3 py-1.5">
              <Crown className="w-3 h-3" /> Pro
            </span>
          ) : (
            <Link href="/premium">
              <div className="inline-flex items-center gap-1.5 border border-white/15 text-white/60 text-xs rounded-full px-3 py-1.5 hover:border-primary/40 hover:text-primary transition-all">
                <Crown className="w-3 h-3" /> Pro
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
