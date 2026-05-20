import { Button } from "@/components/ui/button";
import { ArrowRight, Mic2 } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export function ColloquioWidget({ sectorId }: { sectorId: number }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Mic2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground">Simulatore Colloquio</h2>
          <p className="text-xs text-muted-foreground">Allenati con domande reali del tuo settore</p>
        </div>
        <Link href={`${BASE}colloquio/${sectorId}`} className="ml-auto">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5">
            Simula ora <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          L'AI simula un colloquio HR con domande specifiche per il tuo settore. 
          Ricevi feedback e un punteggio finale per migliorare le tue performance.
        </p>
      </div>
    </section>
  );
}
