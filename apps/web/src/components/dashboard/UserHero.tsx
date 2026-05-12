import { Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserHero({ userName, isPremium, hasTestSession, hasConfirmedSector }: {
  userName: string;
  isPremium: boolean;
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
}) {
  return (
    <section className="relative py-12 md:py-16 overflow-hidden border-b bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl translate-y-1/2 -translate-x-1/4" />
      </div>
      <div className="container mx-auto px-5 md:px-6 max-w-5xl relative z-10">
        <div className={cn("flex items-center gap-2 mb-4 flex-wrap")}>
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Il tuo percorso
          </div>
          {isPremium && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-sm font-semibold">
              <Crown className="w-3.5 h-3.5" /> Pro
            </div>
          )}
        </div>
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-2 leading-tight">
          Bentornato, <span className="text-primary italic">{userName}</span> ✦
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl">
          {hasConfirmedSector
            ? "Ecco il riepilogo del tuo percorso e i prossimi passi consigliati."
            : hasTestSession
              ? "Hai completato il test. Conferma un settore per personalizzare ancora di più la tua esperienza."
              : "Inizia il tuo viaggio: il test è il primo passo per costruire un percorso su misura."}
        </p>
      </div>
    </section>
  );
}
