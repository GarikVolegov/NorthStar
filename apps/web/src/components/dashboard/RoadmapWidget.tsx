import { Map, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL || "/";

export function RoadmapWidget({ sectorId }: { sectorId: number }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Map className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground">Piano di crescita</h2>
          <p className="text-xs text-muted-foreground">Piano formativo personalizzato</p>
        </div>
        <Link href={`${BASE}roadmap/${sectorId}`} className="ml-auto">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5">
            Vedi piano <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Confronta percorsi universitari, ITS, bootcamp e formazione autonoma. 
          Scopri la strada migliore per la tua carriera con analisi di costi, durata e sbocchi.
        </p>
      </div>
    </section>
  );
}
