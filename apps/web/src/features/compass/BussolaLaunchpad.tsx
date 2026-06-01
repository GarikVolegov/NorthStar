/**
 * BussolaLaunchpad — il lancio verso "La Bussola" sul dashboard dell'indeciso.
 *
 * Sostituisce la vecchia griglia di tool sparsi: una sola porta d'ingresso alla
 * casa dell'indeciso. Lo `stage` è l'unica logica; il dettaglio (prossimo passo,
 * i 4 momenti, tutti gli strumenti) vive dentro /bussola.
 */
import { useCompass, type CompassStage } from "@/features/compass/useCompass";
import { Compass, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const STAGE_META: Record<CompassStage, { label: string; sub: string }> = {
  zero_ideas: { label: "Stai esplorando", sub: "Raccogliamo segnali su cosa ti muove" },
  hypotheses: { label: "Stanno emergendo direzioni", sub: "Affiniamole per farne emergere una netta" },
  experimenting: { label: "Hai uno spike in corso", sub: "Un test reversibile di 2 settimane" },
  committed: { label: "Hai trovato una direzione", sub: "Ora trasformala in candidature reali" },
};

const STAGE_ORDER: CompassStage[] = ["zero_ideas", "hypotheses", "experimenting", "committed"];

export function BussolaLaunchpad() {
  const { profile, loading } = useCompass();
  const stage = profile?.stage ?? "zero_ideas";
  const meta = STAGE_META[stage];
  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <Link href={`${BASE}bussola`}>
      <div className="group cursor-pointer rounded-2xl border-2 border-primary/35 bg-primary/5 p-5 transition hover:border-primary hover:shadow-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Compass className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">La tua Bussola</p>
              <p className="text-lg font-bold leading-tight">{loading ? "Calibro la tua bussola…" : meta.label}</p>
              <p className="text-sm text-muted-foreground">{loading ? "" : meta.sub}</p>
            </div>
          </div>
          <span className="hidden items-center gap-1 text-sm font-semibold text-primary sm:flex">
            Continua <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </span>
        </div>

        {/* mini progress per dare il senso di avanzamento */}
        <div className="mt-4 flex items-center gap-1.5">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </Link>
  );
}
