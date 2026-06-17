import { DiaryIdeas } from "@/components/diary/DiaryIdeas";
import { DiaryObjectives } from "@/components/diary/DiaryObjectives";
import { DiaryRecap } from "@/components/diary/DiaryRecap";
import { DiaryReflections } from "@/components/diary/DiaryReflections";
import { InvestorAnalysis } from "@/components/diary/InvestorAnalysis";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, BookOpen, Lightbulb, Repeat2, Target, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type DiaryTab = "reflections" | "ideas" | "objectives" | "analysis" | "recap";

const TAB_META: Record<DiaryTab, { label: string; icon: LucideIcon }> = {
  reflections: { label: "Riflessioni", icon: BookOpen },
  ideas: { label: "Idee", icon: Lightbulb },
  objectives: { label: "Obiettivi", icon: Target },
  analysis: { label: "Analisi", icon: BarChart3 },
  recap: { label: "Recap", icon: Repeat2 },
};

function getTabFromLocation(location: string): DiaryTab | null {
  const query = location.split("?")[1];
  if (!query) return null;
  const tab = new URLSearchParams(query).get("tab");
  if (
    tab === "reflections" ||
    tab === "ideas" ||
    tab === "objectives" ||
    tab === "analysis" ||
    tab === "recap"
  ) {
    return tab;
  }
  return null;
}

function getTabHref(tab: DiaryTab) {
  return tab === "reflections" ? "/diario" : `/diario?tab=${tab}`;
}

export default function DiaryPage() {
  usePageMeta({
    title: "Diario | Fondazione NorthStar",
    description: "Riflessioni, idee, analisi e recap personali per il tuo percorso di crescita.",
  });

  const { user, authReady } = useAuth();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<DiaryTab>(() => getTabFromLocation(location) ?? "reflections");
  const isInvestor = user?.journeyType === "investitore";

  useWendyPageContext({
    page: "diario",
    title: "Diario personale",
    journeyType: user?.journeyType ?? undefined,
    capabilities: ["reflect", "summarize_diary", "create_objective", "navigate"],
    fields: ["diary.entry.content", "diary.idea.content", "diary.analysis.sector", "diary.mood", "diary.tags"],
    actions: ["Analizza riflessione", "Recap periodo", "Promuovi idea a obiettivo"],
  });
  usePageModule({ pageId: "diary" });

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [authReady, user, navigate]);

  useEffect(() => {
    const nextTab = getTabFromLocation(location);
    if (nextTab) setActiveTab(nextTab);
  }, [location]);

  useEffect(() => {
    if (!isInvestor && activeTab === "analysis") setActiveTab("reflections");
  }, [activeTab, isInvestor]);

  const tabs = useMemo(() => {
    const base: DiaryTab[] = ["reflections", "ideas", "objectives"];
    if (isInvestor) base.push("analysis");
    base.push("recap");
    return base;
  }, [isInvestor]);

  const handleTabChange = (tab: DiaryTab) => {
    setActiveTab(tab);
    navigate(getTabHref(tab));
  };

  if (!authReady || !user) {
    return <main className="mx-auto max-w-6xl px-4 py-10" />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <Link href="/dashboard" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Torna alla dashboard
      </Link>

      <section className="mb-6 border-b pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Ecosistema di crescita</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Diario personale</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Uno spazio privato per riflettere, salvare idee, rileggere pattern e coinvolgere Wendy quando vuoi uno sguardo esterno.
            </p>
          </div>
          <Button asChild variant="outline" className="min-h-10 rounded-md">
            <Link href="/coach">Apri Wendy</Link>
          </Button>
        </div>
      </section>

      <nav className="mb-6 flex gap-2 overflow-x-auto border-b pb-2" aria-label="Sezioni diario">
        {tabs.map((tab) => {
          const Icon = TAB_META[tab].icon;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {TAB_META[tab].label}
            </button>
          );
        })}
      </nav>

      {activeTab === "reflections" && <DiaryReflections />}
      {activeTab === "ideas" && <DiaryIdeas />}
      {activeTab === "objectives" && <DiaryObjectives />}
      {activeTab === "analysis" && isInvestor && <InvestorAnalysis />}
      {activeTab === "recap" && <DiaryRecap />}
    </main>
  );
}
