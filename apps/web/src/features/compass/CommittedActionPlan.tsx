/**
 * CommittedActionPlan — il ponte verso il lavoro vero.
 * Quando una direzione ha retto alla prova (confirmed) o è la più forte, mostra
 * un piano d'azione FONDATO sulla domanda reale di mercato (job_posting_snapshots)
 * e i prossimi passi concreti. È la chiusura: "ora l'app ti aiuta a trovare lavoro".
 */
import { fetchActionPlan, type CompassActionPlan } from "@/features/compass/useCompass";
import { Rocket, TrendingUp, Briefcase, BookOpen, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

function salary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)} €`;
  return `${fmt((min ?? max)!)} €`;
}

export function CommittedActionPlan() {
  const [plan, setPlan] = useState<CompassActionPlan | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => { void fetchActionPlan().then(setPlan); }, []);

  // Mostra il ponte solo quando c'è una direzione confermata o lo stage è committed.
  if (!plan?.ready || !plan.direction) return null;
  if (!plan.direction.confirmed && plan.stage !== "committed") return null;

  const { direction, demand } = plan;
  const pay = demand ? salary(demand.avgSalaryMin, demand.avgSalaryMax) : null;

  return (
    <section className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Rocket className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">La tua direzione ha retto alla prova</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {direction.confirmed
          ? "Non è più un'ipotesi: l'hai testata e ha tenuto."
          : "È la direzione più forte emersa dal tuo percorso."}{" "}
        Ora passiamo all'azione concreta su <span className="font-semibold text-foreground">{direction.label}</span>.
      </p>

      {/* Segnale di domanda REALE dal mercato */}
      {demand ? (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            {demand.count} annunci ({demand.period})
            {demand.growthRate != null && (
              <span className={demand.growthRate >= 0 ? "text-emerald-600" : "text-muted-foreground"}>
                {demand.growthRate >= 0 ? "+" : ""}{Math.round(demand.growthRate)}%
              </span>
            )}
          </span>
          {pay && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5">💶 {pay}</span>
          )}
          {demand.topSkills.slice(0, 3).map((s) => (
            <span key={s} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{s}</span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          (Non ho ancora dati di mercato aggiornati per questo ruolo: esploralo e inizia comunque a muoverti.)
        </p>
      )}

      {/* Prossimi passi concreti */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => setLocation(`${BASE}candidature`)}
          className="group flex items-center justify-between rounded-lg bg-primary px-4 py-2.5 text-left text-sm text-primary-foreground"
        >
          <span className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> Inizia a candidarti</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </button>
        {direction.professionId != null && (
          <button
            onClick={() => setLocation(`${BASE}ruolo/${direction.professionId}`)}
            className="group flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-left text-sm"
          >
            <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Approfondisci il ruolo</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </section>
  );
}
