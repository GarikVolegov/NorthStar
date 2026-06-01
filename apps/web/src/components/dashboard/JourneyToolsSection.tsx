import { ArrowRight, BarChart3, BookOpen, BrainCircuit, Briefcase, Building2, Compass, HeartHandshake, MapPin, Mic2, Network, Newspaper, Rocket, Sparkles, Target, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import type { AdaptiveDashboardPhase } from "./dashboard-adaptive-flow";

type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface ToolItem {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
}

function promoteTool(tools: ToolItem[], promoted: ToolItem): ToolItem[] {
  return [promoted, ...tools.filter((tool) => tool.href !== promoted.href)];
}

/**
 * `readinessBand` (opzionale, valido solo per journeyType="indeciso"):
 *   - "low"  → mostra solo i 3 strumenti più leggeri (mood, diario indizi, coach socratico)
 *   - "mid"  → 5 strumenti rotanti
 *   - "high" → set completo + nudge a cambiare percorso
 *
 * Quando assente, mostra il set storico (4 tool).
 */
export function JourneyToolsSection({
  journeyType,
  sectorId,
  readinessBand,
  adaptivePhase,
}: {
  journeyType: string | null | undefined;
  sectorId?: number;
  readinessBand?: "low" | "mid" | "high";
  adaptivePhase?: AdaptiveDashboardPhase;
}) {
  const base = import.meta.env.BASE_URL || "/";
  const diaryTool: ToolItem = {
    href: "/diario",
    icon: BookOpen,
    title: "Il mio Diario",
    desc: "Riflessioni, idee e crescita personale",
  };
  const choosePathTool: ToolItem = {
    href: "/percorso",
    icon: MapPin,
    title: "Scegli percorso",
    desc: "Trasforma la chiarezza raccolta in una direzione attiva",
    badge: "Step",
  };
  const testTool: ToolItem = {
    href: "/test",
    icon: Zap,
    title: "Test di personalita",
    desc: "Mappa la tua personalita professionale",
    badge: "Gratuito",
  };
  const exploreSectorsTool: ToolItem = {
    href: "/settori",
    icon: Target,
    title: "Esplora settori",
    desc: "28 settori - niente impegno, solo curiosita",
  };

  // Set indeciso bandizzato (Ondata 1 — Discovery Engine adattivo).
  // Ordine: dal meno impegnativo al più impegnativo.
  const INDECISO_FULL: ToolItem[] = [
    { href: "/mood",                  icon: HeartHandshake, title: "Mood check-in",          desc: "60s: dimmi come stai, ti suggerisco UNA cosa da fare", badge: "60s" },
    { href: "/diario?mode=indizi",    icon: Compass,        title: "Diario degli Indizi",    desc: "Annota un momento di energia o curiosità",            badge: "Nuovo" },
    { href: "/coach?mode=socratic",   icon: BrainCircuit,   title: "Sessione Socratica",     desc: "4 step strutturati per fare chiarezza con Wendy",     badge: "AI" },
    { href: "/test",                  icon: Zap,            title: "Test di personalità",    desc: "Mappa la tua personalità professionale",              badge: "Gratuito" },
    { href: "/settori",               icon: Target,         title: "Esplora settori",        desc: "28 settori — niente impegno, solo curiosità" },
    { href: "/news",                  icon: Newspaper,      title: "Notizie lavoro",         desc: "Ultime notizie dal mercato del lavoro" },
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
      { href: sectorId ? `${base}skills-gap/${sectorId}` : "/dashboard", icon: Target,      title: "Competenze da sviluppare", desc: "Identifica cosa ti manca per salire di livello",      badge: "AI" },
      { href: sectorId ? `${base}colloquio/${sectorId}` : "/dashboard",  icon: Mic2,        title: "Simulatore Colloquio",    desc: "Allenati con domande reali del tuo settore",           badge: "AI" },
      { href: "/coach",                         icon: BrainCircuit, title: "Consulente di carriera",  desc: "Piano di crescita personalizzato per la tua carriera", badge: "AI" },
      { href: "/candidature",                   icon: Briefcase,   title: "Le mie candidature",     desc: "Gestisci le tue richieste e traccia i progressi" },
    ],
    autonomo: [
      { href: "/validatore-idea",               icon: Rocket,      title: "Valida la tua idea",     desc: "Score AI + analisi su 12 dimensioni + incubatori",     badge: "AI" },
      { href: "/coach",                         icon: BrainCircuit, title: "Consulente per la tua attività", desc: "Consigli strategici per far crescere la tua attività", badge: "AI" },
      { href: "/settori",                       icon: TrendingUp,  title: "Mercati in crescita",    desc: "Scopri i settori più profittevoli in Italia" },
      { href: "/grafo",                         icon: Network,     title: "Mappa delle conoscenze", desc: "Mappa le connessioni tra settori e competenze" },
    ],
    azienda: [
      { href: "/settori",                       icon: Building2,   title: "Profili personalità",    desc: "Esplora i profili psicologici per ogni settore" },
      { href: "/affiliazione",                  icon: Briefcase,   title: "Pubblica offerta",       desc: "Raggiungi i candidati qualificati sulla piattaforma" },
      { href: "/crescita",                      icon: Sparkles,    title: "Crescita aziendale",     desc: "Articoli su cultura, team building e leadership" },
      { href: "/news",                          icon: Newspaper,   title: "News HR & Lavoro",       desc: "Tendenze del mercato del lavoro italiano" },
    ],
    investitore: [
      { href: "/settori",                       icon: BarChart3,   title: "Aree in crescita",    desc: "Analisi approfondita dei settori più dinamici" },
      { href: "/news",                          icon: Newspaper,   title: "Notizie mercati",        desc: "Ultime notizie economia, finanza e mercati" },
      { href: "/crescita",                      icon: TrendingUp,  title: "Crescita di settore",   desc: "Dati e analisi per decisioni di investimento" },
      { href: "/grafo",                         icon: Network,     title: "Mappa delle conoscenze", desc: "Rete di connessioni tra settori e competenze" },
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tools.map(({ href, icon: Icon, title, desc, badge }) => (
        <Link key={title} href={href}>
          <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all duration-200 cursor-pointer h-full">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              {badge && (
                <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">{badge}</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm leading-snug">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      ))}
    </div>
  );
}
