import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useAgentAnalysis, type ProfessionResult } from "@/hooks/useAgentAnalysis";
import { useSectorDetail } from "@/hooks/useSectorDetail";
import { usePersonalizedArticles } from "@/hooks/usePersonalizedArticles";
import { useObjectives } from "@/hooks/useObjectives";
import {
  Trophy, Compass, GitCompare, Map, GitBranch, BookOpen, Briefcase,
  Calendar, Users, User as UserIcon, Crown, ArrowRight
} from "lucide-react";

import { UserHero } from "@/components/dashboard/UserHero";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { ConfirmedSectorCard } from "@/components/dashboard/ConfirmedSectorCard";
import { ToolsGrid, type ToolItem } from "@/components/dashboard/ToolsGrid";
import { ObjectivesSection } from "@/components/dashboard/ObjectivesSection";
import { RecommendationsSection } from "@/components/dashboard/RecommendationsSection";
import { AIAnalysisSection } from "@/components/dashboard/AIAnalysisSection";
import { GrowthSection } from "@/components/dashboard/GrowthSection";
import { ProfileLinkSection } from "@/components/dashboard/ProfileLinkSection";

const BASE = import.meta.env.BASE_URL || "/";

type LatestRec = { sectorId: number; sectorName: string; matchScore: number; matchReason: string };
type LatestResult = { sessionId: number; workPreference: string; recommendations: LatestRec[]; confirmedSectorId: number | null };

interface UserDashboardProps {
  userName: string;
  latestResult: LatestResult | null;
  isPremium?: boolean;
}

export function UserDashboard({ userName, latestResult, isPremium = false }: UserDashboardProps) {
  const [onboardingDone, setOnboardingDone] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("ns_onboarding_done") === "1",
  );

  const confirmedSectorId = latestResult?.confirmedSectorId ?? null;
  const sessionId = latestResult?.sessionId ?? null;
  const recommendations = latestResult?.recommendations ?? [];

  const { data: sector, isLoading: sectorLoading } = useSectorDetail(confirmedSectorId);
  const { data: articlesData, isLoading: articlesLoading } = usePersonalizedArticles();
  const { data: objectives, isLoading: objectivesLoading } = useObjectives();

  const confirmedRec = recommendations.find((r) => r.sectorId === confirmedSectorId);
  const sectorName = sector?.name ?? confirmedRec?.sectorName ?? "Il tuo settore";

  const hasTestSession = !!sessionId;
  const hasConfirmedSector = !!confirmedSectorId;

  const { data: sessionDetail } = useQuery({
    queryKey: ["session-detail-ud", sessionId],
    enabled: !!sessionId,
    staleTime: 600_000,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/${sessionId}`);
      if (!res.ok) throw new Error("Errore sessione");
      return res.json() as Promise<{ riasecScores: Record<string, number>; primaryTypes: string[]; spiritScores: Record<string, number> }>;
    },
  });

  const topSectorsForAgent = recommendations.map((r) => ({ sectorName: r.sectorName }));
  const { data: agentData, isLoading: agentLoading } = useAgentAnalysis({
    sessionId,
    riasecScores: sessionDetail?.riasecScores,
    primaryTypes: sessionDetail?.primaryTypes,
    spiritScores: sessionDetail?.spiritScores,
    topSectors: topSectorsForAgent,
    enabled: !!sessionDetail,
  });
  const agentProfessions: ProfessionResult[] = agentData?.data?.summary?.professions ?? [];
  const isPremiumAgent = agentData?.plan === "premium";

  const tools: ToolItem[] = [
    {
      href: hasTestSession ? `/risultati/${sessionId}` : "/test",
      icon: <Trophy className="w-5 h-5" />,
      title: hasTestSession ? "I tuoi risultati" : "Fai il test",
      description: hasTestSession
        ? "Rivedi il tuo profilo e i settori raccomandati."
        : "Scopri il tuo profilo e i settori più adatti a te.",
      badge: hasTestSession ? undefined : "Inizia",
      accent: "primary",
    },
    {
      href: "/settori",
      icon: <Compass className="w-5 h-5" />,
      title: "Esplora i settori",
      description: "Sfoglia tutti i settori professionali con dettagli e prospettive.",
      accent: "blue",
    },
    {
      href: "/confronta",
      icon: <GitCompare className="w-5 h-5" />,
      title: "Confronta settori",
      description: "Metti due settori a confronto: stipendi, crescita, rischio.",
      accent: "violet",
    },
    {
      href: hasConfirmedSector ? `/roadmap/${confirmedSectorId}` : "/settori",
      icon: <Map className="w-5 h-5" />,
      title: "Piano di crescita",
      description: hasConfirmedSector
        ? `Step by step verso ${sectorName}.`
        : "Conferma un settore per attivare il tuo piano.",
      accent: "emerald",
    },
    {
      href: "/grafo",
      icon: <GitBranch className="w-5 h-5" />,
      title: "Mappa delle conoscenze",
      description: "Note, competenze e documenti collegati come una mappa personale.",
      accent: "violet",
    },
    {
      href: "/crescita",
      icon: <BookOpen className="w-5 h-5" />,
      title: "Crescita personale",
      description: "Articoli, guide e contenuti formativi per il tuo profilo.",
      accent: "primary",
    },
    {
      href: "/candidature",
      icon: <Briefcase className="w-5 h-5" />,
      title: "Le tue candidature",
      description: "Traccia colloqui, candidature e fasi di ricerca lavoro.",
      accent: "blue",
    },
    {
      href: "/calendario",
      icon: <Calendar className="w-5 h-5" />,
      title: "Calendario",
      description: "Eventi, scadenze e promemoria per non perdere occasioni.",
      accent: "rose",
    },
    {
      href: "/amici",
      icon: <Users className="w-5 h-5" />,
      title: "Amici e rete",
      description: "Connettiti con persone che condividono il tuo percorso.",
      accent: "emerald",
    },
    {
      href: "/profilo",
      icon: <UserIcon className="w-5 h-5" />,
      title: "Profilo e CV",
      description: "Gestisci dati, preferenze, obiettivi e curriculum.",
      accent: "primary",
    },
    ...(isPremium ? [] : [{
      href: "/premium",
      icon: <Crown className="w-5 h-5" />,
      title: "Passa a Pro",
      description: "Sblocca tutti gli strumenti avanzati e le analisi AI.",
      premium: true,
      accent: "amber",
    } as ToolItem]),
  ];

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-500">

      {/* Hero */}
      <UserHero
        userName={userName}
        isPremium={isPremiumAgent}
        hasTestSession={hasTestSession}
        hasConfirmedSector={hasConfirmedSector}
      />

      {/* Onboarding */}
      {!onboardingDone && !sessionId && (
        <OnboardingBanner onDismiss={() => {
          localStorage.setItem("ns_onboarding_done", "1");
          setOnboardingDone(true);
        }} />
      )}

      {/* Confirmed sector */}
      <ConfirmedSectorCard
        hasConfirmedSector={hasConfirmedSector}
        hasTestSession={hasTestSession}
        sector={sector}
        sectorLoading={sectorLoading}
        sectorName={sectorName}
        confirmedRec={confirmedRec}
        confirmedSectorId={confirmedSectorId}
        sessionId={sessionId}
      />

      {/* Tools */}
      <ToolsGrid tools={tools} />

      {/* Objectives */}
      <ObjectivesSection objectives={objectives} objectivesLoading={objectivesLoading} />

      {/* Recommendations */}
      <RecommendationsSection
        recommendations={recommendations}
        sessionId={sessionId}
        confirmedSectorId={confirmedSectorId}
      />

      {/* AI Analysis */}
      <AIAnalysisSection
        agentProfessions={agentProfessions}
        agentLoading={agentLoading}
        isPremium={isPremiumAgent}
      />

      {/* Growth articles */}
      <GrowthSection articles={articlesData?.articles} articlesLoading={articlesLoading} />

      {/* Profile link */}
      <ProfileLinkSection />
    </div>
  );
}
