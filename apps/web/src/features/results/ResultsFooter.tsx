import { PostTestWizard } from "@/components/PostTestWizard";
import { Button } from "@/components/ui/button";
import type { TFunction } from "i18next";
import { BarChart3, Brain, Map, Newspaper, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface StatsFooterProps {
  stats?: {
    totalTestsTaken?: number;
    topSectors?: Array<{ name: string }>;
  } | null | undefined;
  t: TFunction;
}

export function StatsFooter({ stats, t }: StatsFooterProps) {
  if (!stats) return null;
  return (
    <div className="mt-20 bg-card border rounded-2xl p-8 text-center animate-in fade-in duration-1000 delay-500">
      <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
      <h3 className="font-serif text-xl font-medium mb-2">{t("results.statsFooterTitle")}</h3>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        {t("results.statsFooterDesc", { count: stats.totalTestsTaken })} {stats.topSectors?.slice(0, 3).map(s => s.name).join(", ")}.
      </p>
    </div>
  );
}

export function PremiumUpgradeCta({ t }: { t: TFunction }) {
  return (
    <div className="mt-10 rounded-3xl overflow-hidden border border-primary/15 bg-gradient-to-br from-primary/5 via-background to-primary/5 animate-in fade-in duration-1000 delay-700">
      <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-primary/10">
        <div className="flex flex-col items-center text-center p-8 gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">{t("premium.features.updates.title")}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("premium.features.updates.desc")}</p>
        </div>
        <div className="flex flex-col items-center text-center p-8 gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">{t("premium.features.wiki.title")}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("premium.features.wiki.desc")}</p>
        </div>
        <div className="flex flex-col items-center text-center p-8 gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground text-sm">{t("premium.features.roadmap.title")}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("premium.features.roadmap.desc")}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-8 py-6 border-t border-primary/10 bg-primary/3">
        <p className="text-sm text-muted-foreground">{t("sector.deepenWithAI")}</p>
        <Button asChild className="rounded-full" size="sm">
          <Link href="/premium"><Sparkles className="h-3.5 w-3.5 mr-1.5" />{t("wiki.upgrade")}</Link>
        </Button>
      </div>
    </div>
  );
}

interface PostTestWizardControlsProps {
  effectiveSession?: { recommendations?: Array<{ sectorName?: string }> | null } | null | undefined;
  id: number;
  onClose: () => void;
  onOpen: () => void;
  showWizard: boolean;
  user?: { id: number } | null | undefined;
}

export function PostTestWizardControls({
  effectiveSession,
  id,
  onClose,
  onOpen,
  showWizard,
  user,
}: PostTestWizardControlsProps) {
  return (
    <>
      {showWizard && user && effectiveSession && (
        <PostTestWizard
          userId={user.id}
          sessionId={id}
          topSectorName={effectiveSession.recommendations?.[0]?.sectorName ?? "il tuo settore"}
          onClose={onClose}
          onComplete={onClose}
        />
      )}

      {!showWizard && user && effectiveSession && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={onOpen}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-2.5 shadow-lg hover:bg-primary/90 transition-all text-sm font-medium"
          >
            <span>target</span> Pianifica obiettivi
          </button>
        </div>
      )}
    </>
  );
}
