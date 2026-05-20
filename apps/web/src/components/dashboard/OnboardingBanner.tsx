import { Compass, X } from "lucide-react";
import { Link } from "wouter";

export function OnboardingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="py-4 border-b bg-primary/5">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="flex items-start gap-4 p-5 rounded-2xl border border-primary/20 bg-background">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground mb-1">Benvenuto in NorthStar! 🎉</p>
            <p className="text-sm text-muted-foreground mb-3">Tre passi per iniziare il tuo percorso:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              {[
                { num: "1", label: "Fai il test", href: "/test" },
                { num: "2", label: "Esplora i settori", href: "/settori" },
                { num: "3", label: "Crea un obiettivo", href: "/profilo" },
              ].map((step) => (
                <Link key={step.num} href={step.href}>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl border bg-muted/40 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary shrink-0">
                      {step.num}
                    </div>
                    <span className="text-xs font-medium">{step.label}</span>
                  </div>
                </Link>
              ))}
            </div>
            <button
              onClick={onDismiss}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Non mostrare più
            </button>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
