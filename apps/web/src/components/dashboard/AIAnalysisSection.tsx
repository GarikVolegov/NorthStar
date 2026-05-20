import { Skeleton } from "@/components/ui/skeleton";
import type { ProfessionResult } from "@/hooks/useAgentAnalysis";
import { ArrowRight, Crown, DollarSign, Loader2, Lock, TrendingUp, Zap } from "lucide-react";
import { Link } from "wouter";

export function AIAnalysisSection({
  agentProfessions,
  agentLoading,
  isPremium,
}: {
  agentProfessions: ProfessionResult[];
  agentLoading: boolean;
  isPremium: boolean;
}) {
  if (!agentLoading && agentProfessions.length === 0) return null;

  return (
    <section className="py-10 bg-primary/3 border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
              <Zap className="w-3.5 h-3.5" /> Analisi AI
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              Professioni consigliate per te
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agentLoading ? "L'AI sta elaborando il tuo profilo…" : `${agentProfessions.length} professioni · Piano ${isPremium ? "Pro" : "gratuito"}`}
            </p>
          </div>
          <Link href="/dashboard">
            <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
              Dashboard completa <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {agentLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary animate-pulse mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Analisi in corso — potrebbe richiedere alcuni secondi…</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-6 w-18 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {agentProfessions.slice(0, 3).map((p, i) => (
              <div key={`${p.title}-${i}`} className="rounded-2xl border bg-card p-5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full mb-1 inline-block">#{i + 1}</span>
                    <h3 className="font-semibold text-foreground leading-snug text-sm">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">{p.sector}</p>
                  </div>
                  {p.growthOutlook && (
                    <span className="shrink-0 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {p.growthOutlook}
                    </span>
                  )}
                </div>
                {p.salaryRange && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="w-3 h-3 shrink-0" />
                    <span className="font-medium text-foreground">{p.salaryRange}</span>
                  </div>
                )}
                {p.skills && p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.skills.slice(0, 3).map((sk) => (
                      <span key={sk} className="text-xs bg-primary/8 text-primary rounded-full px-2 py-0.5 font-medium">{sk}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!isPremium && !agentLoading && agentProfessions.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed p-4 flex items-center gap-4">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              Vuoi 6 professioni + percorsi formativi + modalità lavorativa ottimale?
            </p>
            <Link href="/premium">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
                <Crown className="w-3 h-3" /> Passa a Pro
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
