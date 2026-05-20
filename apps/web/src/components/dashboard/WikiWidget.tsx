import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export function WikiWidget({ sectorId }: { sectorId: number }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground">Guida AI</h2>
          <p className="text-xs text-muted-foreground">Chiedi tutto sul tuo settore</p>
        </div>
        <Link href={`${BASE}wiki/${sectorId}`} className="ml-auto">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5">
            Fai una domanda <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Poni domande sul tuo settore e ricevi risposte approfondite dall'intelligenza artificiale. 
          Scopri趋势, competenze richieste e opportunità di carriera.
        </p>
      </div>
    </section>
  );
}
