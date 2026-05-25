import { Button } from "@/components/ui/button";
import type { WorkModeResult } from "@/hooks/useAgentAnalysis";
import { cn } from "@/lib/utils";
import { Briefcase, Crown } from "lucide-react";
import { Link } from "wouter";

export function WorkModePanel({ wm, isPremium }: { wm: WorkModeResult; isPremium: boolean }) {
  const colorMap: Record<string, string> = {
    dipendente: "text-chart-3 bg-chart-3/10 border-chart-3/20",
    autonomo:   "text-chart-4 bg-chart-4/10 border-chart-4/20",
    ibrido:     "text-growth bg-growth/10 border-growth/20",
  };
  const labelMap: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo:   "Autonomo / Freelance",
    ibrido:     "Ibrido",
  };
  const color = colorMap[wm.recommended] ?? "text-primary bg-primary/10 border-primary/20";
  const label = wm.recommendedLabel ?? labelMap[wm.recommended] ?? wm.recommended;

  return (
    <div className="rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Briefcase className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Modalità lavorativa consigliata</h3>
          {!isPremium && (
            <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 mt-0.5">
              <Crown className="w-3 h-3" /> Premium
            </span>
          )}
        </div>
        <span className={cn("ml-auto text-sm font-semibold border rounded-full px-3 py-1", color)}>
          {label}
        </span>
      </div>
      {wm.riasecFit && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{wm.riasecFit}</p>
      )}
      {wm.contextualAdvice && (
        <div className="bg-muted rounded-xl p-4">
          <p className="text-sm text-foreground">{wm.contextualAdvice}</p>
        </div>
      )}
      {!isPremium && (
        <div className="mt-4">
          <Button asChild size="sm" variant="outline" className="rounded-full border-primary/30 text-primary hover:bg-primary/5">
            <Link href="/premium"><Crown className="w-3.5 h-3.5 mr-1.5" />Sblocca analisi completa</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
