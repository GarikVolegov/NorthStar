import { Button } from "@/components/ui/button";
import { ArrowRight, Network } from "lucide-react";
import { Link } from "wouter";

export function MappaWidget({ userId: _userId }: { userId: number }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Network className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-bold text-xl text-foreground">Mappa delle conoscenze</h2>
          <p className="text-xs text-muted-foreground">Organizza note, competenze e risorse</p>
        </div>
        <Link href="/archivio" className="ml-auto">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5">
            Apri grafo <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Crea e collega note, skills, strumenti e certificazioni in un grafo interattivo. 
          Visualizza le connessioni tra le tue conoscenze e scopri nuovi collegamenti.
        </p>
      </div>
    </section>
  );
}
