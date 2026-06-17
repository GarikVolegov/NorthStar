import { SectorFreshnessBadge } from "@/components/sector/SectorFreshnessBadge";
import { ArrowRight, BarChart3, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export function DashboardMarketInsights() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Analisi mercato</h3>
          <p className="text-xs text-muted-foreground">Aree in crescita e opportunità di investimento</p>
        </div>
        <Link href="/mercato" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Apri <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <Link href="/mercato" className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
        <TrendingUp className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Radar stipendi & domanda</p>
          <p className="text-xs text-muted-foreground">Confronta RAL, crescita e rischio automazione per settore, e scopri i segnali emergenti del mercato IT italiano.</p>
        </div>
      </Link>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground">Stato dati:</span>
        <SectorFreshnessBadge />
      </div>
    </div>
  );
}
