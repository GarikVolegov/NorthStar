import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rec {
  sectorId: number; sectorName: string; matchScore: number; matchReason: string;
}

export function RecommendationsSection({ recommendations, sessionId, confirmedSectorId }: {
  recommendations: Rec[];
  sessionId: number | null;
  confirmedSectorId: number | null;
}) {
  if (recommendations.length === 0) return null;

  return (
    <section className="py-10 bg-card border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-serif font-bold text-foreground">I tuoi risultati</h2>
          {sessionId && (
            <Link href={`/risultati/${sessionId}`}>
              <div className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                Dettaglio completo <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.slice(0, 3).map((rec, i) => (
            <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
              <div className={cn(
                "group flex items-start gap-3 p-4 rounded-2xl border bg-background hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full",
                rec.sectorId === confirmedSectorId && "border-primary/40 bg-primary/5",
              )}>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-serif font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground leading-tight mb-0.5 group-hover:text-primary transition-colors">
                    {rec.sectorName}
                    {rec.sectorId === confirmedSectorId && (
                      <span className="ml-2 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">✓ Scelto</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rec.matchReason}</p>
                  <div className="mt-1.5 text-xs font-semibold text-primary">{rec.matchScore}% compatibilità</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
