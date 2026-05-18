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
  investitore: { icon: BarChart3,   headline: "Analizza le opportunità",  subline: "Aree, trend e dati di mercato",        color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
};

interface Metrics {
  label: string;
  value: string | number;
}

const PERSONA_METRICS: Record<string, (session: DashboardSession | null) => Metrics[]> = {
  indeciso: (s) => [
    { label: "Test", value: s ? "Completato" : "Da fare" },
    { label: "Aree esplorate", value: s?.recommendations?.length ?? 0 },
    { label: "Piano", value: "Da scegliere" },
  ],
  dipendente: () => [
    { label: "Competenze", value: "0" },
    { label: "Colloqui simulati", value: "0" },
    { label: "Candidature", value: "0" },
  ],
  autonomo: () => [
    { label: "Idee validate", value: "0" },
    { label: "Aree monitorate", value: "0" },
    { label: "Strumenti usati", value: "0" },
  ],
  azienda: () => [
    { label: "Profili esplorati", value: "0" },
    { label: "Aree analizzate", value: "21" },
    { label: "Offerte pubblicate", value: "0" },
  ],
  investitore: () => [
    { label: "Aree monitorate", value: "0" },
    { label: "Report analizzati", value: "0" },
    { label: "Trend attivi", value: "0" },
  ],
};

export function DashboardHero({
  journeyType,
  session,
  isPremium,
  userName,
}: {
  journeyType: string | null | undefined;
  session: DashboardSession | null;
  isPremium: boolean;
  userName?: string | null;
}) {
  const meta = journeyType ? JOURNEY_META[journeyType as JourneyId] : null;
  const Icon = meta?.icon ?? HelpCircle;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const firstName = userName?.split(" ")[0] ?? "";

  return (
    <div className="rounded-2xl border overflow-hidden">
      <div className="hero-navy px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Greeting */}
        <div className="flex-1">
          <p className="text-xs text-white/50 font-medium mb-0.5">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </p>
          {meta ? (
            <div className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", meta.bgColor, meta.borderColor)}>
                <Icon className={cn("w-3.5 h-3.5", meta.color)} />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">{meta.headline}</h2>
                <p className="text-xs text-white/50 leading-tight">{meta.subline}</p>
              </div>
            </div>
          ) : (
            <h2 className="font-bold text-white text-base">Il tuo pannello di controllo</h2>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!journeyType ? (
            <Link href="/percorso">
              <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-semibold text-xs rounded-full px-3 py-1.5 hover:bg-primary/90 transition-all">
                <MapPin className="w-3 h-3" /> Scegli il percorso
              </div>
            </Link>
          ) : (
            <Link href="/percorso">
              <div className="inline-flex items-center gap-1.5 border border-white/20 text-white/60 text-xs rounded-full px-3 py-1.5 hover:border-white/30 hover:text-white/80 transition-all">
                <MapPin className="w-3 h-3" />
                <span className="capitalize">{journeyType}</span>
              </div>
            </Link>
          )}
          {!session && (
            <Link href="/test">
              <div className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-primary text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-primary/30 transition-all">
                Fai il test
              </div>
            </Link>
          )}
          {isPremium && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/15 border border-primary/30 rounded-full px-2.5 py-1">
              <Crown className="w-3 h-3" /> Pro
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
