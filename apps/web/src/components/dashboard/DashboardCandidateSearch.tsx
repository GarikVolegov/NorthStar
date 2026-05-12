import { Link } from "wouter";
import { Users, ArrowRight, Search } from "lucide-react";

export function DashboardCandidateSearch() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Users className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Ricerca profili</h3>
          <p className="text-xs text-muted-foreground">Trova i candidati ideali per la tua azienda</p>
        </div>
        <Link href="/settori" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Esplora <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
        <Search className="w-8 h-8 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Esplora profili per settore</p>
          <p className="text-xs text-muted-foreground">Filtra per competenze, personalità e settore per trovare il candidato più adatto alle tue esigenze.</p>
        </div>
      </div>
    </div>
  );
}
