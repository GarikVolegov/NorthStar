import { Badge } from "@/components/ui/badge";
import { ArrowRight, Brain, MapPin, MessageSquare, Network, Sparkles, Target } from "lucide-react";
import type { TFunction } from "i18next";
import { Link } from "wouter";

type SectorPremiumToolsProps = {
  sectorId: number;
  t: TFunction;
  onOpenWendy: () => void;
};

export function SectorPremiumTools({ sectorId, t, onOpenWendy }: SectorPremiumToolsProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 text-xs">
          <Sparkles className="w-3 h-3 mr-1" /> {t("sector.premiumTools")}
        </Badge>
        <span className="text-sm text-muted-foreground">{t("sector.deepenWithAI")}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={onOpenWendy} className="block w-full text-left">
          <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            <h4 className="font-semibold mb-1.5 text-sm">{t("sector.wikiAI")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{t("sector.wikiDesc")}</p>
            <div className="flex items-center text-indigo-600 text-xs font-medium">
              {t("sector.openChat")} <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </button>

        <Link href={`/roadmap/${sectorId}`} className="block">
          <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-semibold mb-1.5 text-sm">{t("sector.roadmap")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{t("sector.roadmapDesc")}</p>
            <div className="flex items-center text-emerald-600 text-xs font-medium">
              {t("sector.generatePlan")} <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        <Link href={`/grafo/${sectorId}`} className="block">
          <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
              <Network className="w-5 h-5 text-violet-600" />
            </div>
            <h4 className="font-semibold mb-1.5 text-sm">{t("sector.knowledgeGraph")}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{t("sector.graphDesc")}</p>
            <div className="flex items-center text-violet-600 text-xs font-medium">
              {t("sector.exploreGraph")} <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>

        <button onClick={onOpenWendy} className="block w-full text-left">
          <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-semibold mb-1.5 text-sm">Simulatore Colloquio</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">Preparati al colloquio con AI nel tuo settore</p>
            <div className="flex items-center text-orange-600 text-xs font-medium">
              Inizia colloquio <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </button>

        <Link href={`/skills-gap/${sectorId}`} className="block">
          <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 group-hover:bg-rose-100 transition-colors">
              <Target className="w-5 h-5 text-rose-600" />
            </div>
            <h4 className="font-semibold mb-1.5 text-sm">Skills Gap Analysis</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">Scopri cosa ti manca per entrare nel settore</p>
            <div className="flex items-center text-rose-600 text-xs font-medium">
              Analizza gap <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
