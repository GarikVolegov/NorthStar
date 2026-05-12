import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SectorIcon } from "@/lib/sector-icon";
import { CheckCircle2, TrendingUp, Map, GitBranch, Compass, ArrowRight } from "lucide-react";
import type { SectorDetail } from "@/hooks/useSectorDetail";

export function ConfirmedSectorCard({
  hasConfirmedSector,
  hasTestSession,
  sector,
  sectorLoading,
  sectorName,
  confirmedRec,
  confirmedSectorId,
  sessionId,
}: {
  hasConfirmedSector: boolean;
  hasTestSession: boolean;
  sector: SectorDetail | undefined;
  sectorLoading: boolean;
  sectorName: string;
  confirmedRec: { matchScore: number } | undefined;
  confirmedSectorId: number | null;
  sessionId: number | null;
}) {
  return (
    <section className="py-10 bg-background border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <h2 className="text-xl font-serif font-bold text-foreground mb-5">
          {hasConfirmedSector ? "Il tuo percorso confermato" : "Il prossimo passo"}
        </h2>

        {hasConfirmedSector ? (
          sectorLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                  <SectorIcon name={sector?.icon} size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Confermato</span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-foreground leading-tight">{sectorName}</h3>
                  {sector?.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-md">{sector.description}</p>
                  )}
                  {confirmedRec && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1">
                      <TrendingUp className="w-3 h-3" /> {confirmedRec.matchScore}% di compatibilità
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                <Link href={`/roadmap/${confirmedSectorId}`}>
                  <Button className="w-full rounded-xl gap-2">
                    <Map className="w-4 h-4" /> Piano di crescita
                  </Button>
                </Link>
                <Link href="/grafo">
                  <Button variant="outline" className="w-full rounded-xl gap-2">
                    <GitBranch className="w-4 h-4" /> Mappa delle conoscenze
                  </Button>
                </Link>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Compass className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-serif font-bold text-foreground leading-tight mb-1">
                  {hasTestSession ? "Conferma il tuo settore" : "Fai il test"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {hasTestSession
                    ? "Hai i risultati ma non hai ancora scelto un settore. Conferma il preferito per attivare gli strumenti personali."
                    : "Bastano 10 minuti per scoprire i settori più allineati al tuo profilo."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <Link href={hasTestSession ? `/risultati/${sessionId}` : "/test"}>
                <Button className="w-full rounded-xl gap-2">
                  {hasTestSession ? <>Vedi i risultati <ArrowRight className="w-4 h-4" /></> : <>Inizia il test <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </Link>
              <Link href="/settori">
                <Button variant="outline" className="w-full rounded-xl gap-2">
                  <Compass className="w-4 h-4" /> Esplora i settori
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
