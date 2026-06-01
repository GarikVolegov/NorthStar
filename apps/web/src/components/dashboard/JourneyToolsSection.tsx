import { ArrowRight, BarChart3, BookOpen, BrainCircuit, Briefcase, Building2, Compass, HeartHandshake, MapPin, Mic2, Network, Newspaper, Rocket, Sparkles, Target, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { AdaptiveDashboardPhase, AdaptiveSectionPresentation } from "./dashboard-adaptive-flow";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";

type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface ToolItem {
  id: string;
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
}

function promoteTool(tools: ToolItem[], promoted: ToolItem): ToolItem[] {
  return [promoted, ...tools.filter((tool) => tool.href !== promoted.href)];
}

function badgeTranslationKey(badge: string): string {
  const badgeIds: Record<string, string> = {
    AI: "ai",
    Gratuito: "free",
    "Inizia qui": "startHere",
    Nuovo: "new",
    Step: "step",
    "60s": "sixtySeconds",
  };

  return `dashboard.journeyTools.badges.${badgeIds[badge] ?? badge.toLowerCase().replace(/\W+/g, "")}`;
}

function JourneyToolCard({
  tool,
  index,
  locale,
  presentation,
}: {
  tool: ToolItem;
  index: number;
  locale: string;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  const { href, icon: Icon, title, desc, badge } = tool;
  const translatedTitle = useDynamicTranslation({
    locale,
    source: title,
    key: `dashboard.journeyTools.tools.${tool.id}.title`,
    context: "Dashboard journey tool title",
  });
  const translatedDescription = useDynamicTranslation({
    locale,
    source: desc,
    key: `dashboard.journeyTools.tools.${tool.id}.description`,
    context: "Dashboard journey tool description",
  });
  const translatedBadge = useDynamicTranslation({
    locale,
    source: badge ?? "",
    key: badge ? badgeTranslationKey(badge) : `dashboard.journeyTools.tools.${tool.id}.badge`,
    context: "Dashboard journey tool badge",
  });

  return (
    <Link href={href}>
      <div
        className={cn(
          "group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all duration-200 cursor-pointer h-full",
          presentation?.priority === "primary" && index === 0 && "sm:col-span-2 border-primary/35 bg-primary/5",
          presentation?.priority === "compact" && "p-4",
        )}
      >
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          {badge && (
            <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">{translatedBadge}</span>
          )}
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm leading-snug">{translatedTitle}</p>
          {presentation?.priority !== "compact" && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{translatedDescription}</p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}

/**
 * `readinessBand` (opzionale, valido solo per journeyType="indeciso"):
 *   - "low" mostra solo i 3 strumenti più leggeri (mood, diario indizi, coach socratico)
 *   - "mid" mostra 5 strumenti rotanti
 *   - "high" mostra il set completo + nudge a cambiare percorso
 *
 * Quando assente, mostra il set storico (4 tool).
 */
export function JourneyToolsSection({
  journeyType,
  sectorId,
  readinessBand,
  adaptivePhase,
  presentation,
}: {
  journeyType: string | null | undefined;
  sectorId?: number;
  readinessBand?: "low" | "mid" | "high";
  adaptivePhase?: AdaptiveDashboardPhase;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const base = import.meta.env.BASE_URL || "/";
  const diaryTool: ToolItem = {
    id: "diary",
    href: "/diario",
    icon: BookOpen,
    title: "Il mio Diario",
    desc: "Riflessioni, idee e crescita personale",
  };
  const choosePathTool: ToolItem = {
    id: "choosePath",
    href: "/percorso",
    icon: MapPin,
    title: "Scegli percorso",
    desc: "Trasforma la chiarezza raccolta in una direzione attiva",
    badge: "Step",
  };
  const testTool: ToolItem = {
    id: "personalityTest",
    href: "/test",
    icon: Zap,
    title: "Test di personalità",
    desc: "Mappa la tua personalità professionale",
    badge: "Gratuito",
  };
  const exploreSectorsTool: ToolItem = {
    id: "exploreSectors",
    href: "/settori",
    icon: Target,
    title: "Scegli settore e ruolo",
    desc: "Parti da un'area, poi scegli il ruolo target",
  };

  const INDECISO_FULL: ToolItem[] = [
    { id: "compass", href: "/bussola", icon: Compass, title: "La Bussola", desc: "Il tuo hub: scopri cosa ti muove e avanza verso una direzione", badge: "Inizia qui" },
    { id: "moodCheckIn", href: "/mood", icon: HeartHandshake, title: "Mood check-in", desc: "60s: dimmi come stai, ti suggerisco UNA cosa da fare", badge: "60s" },
    { id: "cluesDiary", href: "/diario?mode=indizi", icon: Sparkles, title: "Diario degli Indizi", desc: "Annota un momento di energia o curiosità", badge: "Nuovo" },
    { id: "socraticSession", href: "/coach?mode=socratic", icon: BrainCircuit, title: "Sessione Socratica", desc: "4 step strutturati per fare chiarezza con Wendy", badge: "AI" },
    { id: "personalityTest", href: "/test", icon: Zap, title: "Test di personalità", desc: "Mappa la tua personalità professionale", badge: "Gratuito" },
    { id: "exploreSectors", href: "/settori", icon: Target, title: "Scegli settore e ruolo", desc: "Parti da un'area, poi scegli il ruolo target" },
    { id: "newsWork", href: "/news", icon: Newspaper, title: "Notizie lavoro", desc: "Ultime notizie dal mercato del lavoro" },
  ];

  const TOOLS_BY_JOURNEY: Record<JourneyId, ToolItem[]> = {
    indeciso:
      readinessBand === "low"
        ? INDECISO_FULL.slice(0, 3)
        : readinessBand === "mid"
          ? INDECISO_FULL.slice(0, 5)
          : readinessBand === "high"
            ? INDECISO_FULL
            : INDECISO_FULL.slice(0, 4),
    dipendente: [
      { id: "skillsGap", href: sectorId ? `${base}skills-gap/${sectorId}` : "/dashboard", icon: Target, title: "Competenze da sviluppare", desc: "Identifica cosa ti manca per salire di livello", badge: "AI" },
      { id: "interviewCoach", href: sectorId ? `${base}colloquio/${sectorId}` : "/dashboard", icon: Mic2, title: "Simulatore Colloquio", desc: "Allenati con domande reali del tuo settore", badge: "AI" },
      { id: "careerCoach", href: "/coach", icon: BrainCircuit, title: "Consulente di carriera", desc: "Piano di crescita personalizzato per la tua carriera", badge: "AI" },
      { id: "applications", href: "/candidature", icon: Briefcase, title: "Le mie candidature", desc: "Gestisci le tue richieste e traccia i progressi" },
    ],
    autonomo: [
      { id: "ideaValidator", href: "/validatore-idea", icon: Rocket, title: "Valida la tua idea", desc: "Score AI + analisi su 12 dimensioni + incubatori", badge: "AI" },
      { id: "businessCoach", href: "/coach", icon: BrainCircuit, title: "Consulente per la tua attività", desc: "Consigli strategici per far crescere la tua attività", badge: "AI" },
      { id: "growthMarkets", href: "/settori", icon: TrendingUp, title: "Mercati in crescita", desc: "Scopri i settori più profittevoli in Italia" },
      { id: "knowledgeMap", href: "/grafo", icon: Network, title: "Mappa delle conoscenze", desc: "Mappa le connessioni tra settori e competenze" },
    ],
    azienda: [
      { id: "personalityProfiles", href: "/settori", icon: Building2, title: "Profili personalità", desc: "Esplora i profili psicologici per ogni settore" },
      { id: "publishOffer", href: "/affiliazione", icon: Briefcase, title: "Pubblica offerta", desc: "Raggiungi i candidati qualificati sulla piattaforma" },
      { id: "companyGrowth", href: "/crescita", icon: Sparkles, title: "Crescita aziendale", desc: "Articoli su cultura, team building e leadership" },
      { id: "hrNews", href: "/news", icon: Newspaper, title: "News HR & Lavoro", desc: "Tendenze del mercato del lavoro italiano" },
    ],
    investitore: [
      { id: "growthAreas", href: "/settori", icon: BarChart3, title: "Aree in crescita", desc: "Analisi approfondita dei settori più dinamici" },
      { id: "marketNews", href: "/news", icon: Newspaper, title: "Notizie mercati", desc: "Ultime notizie economia, finanza e mercati" },
      { id: "sectorGrowth", href: "/crescita", icon: TrendingUp, title: "Crescita di settore", desc: "Dati e analisi per decisioni di investimento" },
      { id: "knowledgeMap", href: "/grafo", icon: Network, title: "Mappa delle conoscenze", desc: "Rete di connessioni tra settori e competenze" },
    ],
  };

  const journeyTools = (journeyType && TOOLS_BY_JOURNEY[journeyType as JourneyId])
    ? TOOLS_BY_JOURNEY[journeyType as JourneyId]
    : TOOLS_BY_JOURNEY.indeciso;
  const baseTools: ToolItem[] = [diaryTool, ...journeyTools];
  const tools: ToolItem[] = journeyType === "indeciso" && adaptivePhase === "choose_path"
    ? promoteTool(baseTools, choosePathTool)
    : journeyType === "indeciso" && adaptivePhase === "start_test"
      ? promoteTool(baseTools, testTool)
      : journeyType === "indeciso" && adaptivePhase === "explore_sectors"
        ? promoteTool(baseTools, exploreSectorsTool)
        : baseTools;
  const visibleTools = presentation?.priority === "compact" ? tools.slice(0, 3) : tools;

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", presentation?.priority === "primary" && "rounded-2xl border border-primary/25 bg-primary/5 p-2")}>
      {visibleTools.map((tool, index) => (
        <JourneyToolCard
          key={`${tool.id}-${tool.href}`}
          tool={tool}
          index={index}
          locale={locale}
          presentation={presentation}
        />
      ))}
    </div>
  );
}
