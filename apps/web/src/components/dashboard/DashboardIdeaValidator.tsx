import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { Link } from "wouter";

export function DashboardIdeaValidator({ userId: _userId }: { userId?: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Validazione idea</h3>
          <p className="text-xs text-muted-foreground">Analizza e valida la tua idea di business</p>
        </div>
        <Link href="/validatore-idea" className="text-xs text-primary font-semibold hover:underline shrink-0">
          Valida ora <ArrowRight className="w-3 h-3 inline ml-0.5" />
        </Link>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
        <Sparkles className="w-8 h-8 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Hai un'idea?</p>
          <p className="text-xs text-muted-foreground">L'intelligenza artificiale la analizza su 12 dimensioni e ti mostra punti di forza, rischi e opportunità di mercato.</p>
        </div>
      </div>
    </div>
  );
}
