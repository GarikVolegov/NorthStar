/**
 * CommitmentReadinessWidget — UI del Discovery Engine (percorso indeciso).
 *
 * Mostra:
 *   - Score 0-100 con banda (esplorazione / messa a fuoco / scelta vicina)
 *   - Componenti del punteggio (mini progress bar per ognuno)
 *   - Prossimo nudge: 1 CTA verso lo strumento del gap dominante
 *
 * Visibile solo per utenti con journeyType="indeciso".
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Compass, RefreshCw, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";

export interface ReadinessData {
  score: number;
  band: "low" | "mid" | "high";
  components: {
    selfKnowledge: number;
    exploration: number;
    reflection: number;
    emotion: number;
    commitment: number;
  };
  nextNudge: { component: string; toolHref: string; message: string } | null;
}

const COMPONENT_LABELS: Record<keyof ReadinessData["components"], { label: string; cap: number }> = {
  selfKnowledge: { label: "Conoscenza di sé",       cap: 25 },
  exploration:   { label: "Esplorazione",            cap: 25 },
  reflection:    { label: "Riflessione",             cap: 25 },
  emotion:       { label: "Ascolto emotivo",         cap: 15 },
  commitment:    { label: "Pronto alla scelta",      cap: 10 },
};

const BAND_LABEL: Record<ReadinessData["band"], { headline: string; sub: string; tone: string }> = {
  low:  { headline: "Sei in esplorazione",   sub: "Niente fretta — raccogli indizi.",        tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" },
  mid:  { headline: "Stai mettendo a fuoco", sub: "I segnali si stanno chiarendo.",          tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  high: { headline: "La scelta è vicina",    sub: "Potresti essere pronto per la fase attiva.", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
};

export async function fetchReadiness(): Promise<ReadinessData> {
  const res = await apiFetch("/api/discovery/readiness");
  if (!res.ok) throw new Error("Errore caricamento readiness");
  return res.json();
}

export function isReadinessData(data: unknown): data is ReadinessData {
  const candidate = data as Partial<ReadinessData> | undefined;
  return Boolean(
    candidate
      && typeof candidate.score === "number"
      && (candidate.band === "low" || candidate.band === "mid" || candidate.band === "high")
      && candidate.components
      && typeof candidate.components.selfKnowledge === "number"
      && typeof candidate.components.exploration === "number"
      && typeof candidate.components.reflection === "number"
      && typeof candidate.components.emotion === "number"
      && typeof candidate.components.commitment === "number",
  );
}

export function CommitmentReadinessWidget() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["discovery-readiness"],
    queryFn: fetchReadiness,
    staleTime: 60 * 1000, // 1 min
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-8 w-20 bg-muted rounded mb-4" />
        <div className="h-2 w-full bg-muted rounded" />
      </div>
    );
  }
  if (isError || !isReadinessData(data)) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Discovery Engine non disponibile</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Non riesco a caricare il tuo indice di readiness. Puoi riprovare o continuare dagli strumenti del percorso.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Riprova
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" asChild>
                <Link href="/dashboard">
                  Apri strumenti <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const band = BAND_LABEL[data.band];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20 mb-2">
            <Compass className="w-3 h-3" />
            Discovery Engine
          </div>
          <h3 className="text-sm font-semibold leading-tight">{band.headline}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{band.sub}</p>
        </div>
        <div className={`text-2xl font-bold tabular-nums px-3 py-1 rounded-xl border ${band.tone}`}>
          {Math.round(data.score)}
          <span className="text-xs font-medium opacity-70">/100</span>
        </div>
      </header>

      {/* Componenti */}
      <div className="space-y-2">
        {(Object.keys(COMPONENT_LABELS) as Array<keyof ReadinessData["components"]>).map((k) => {
          const meta = COMPONENT_LABELS[k];
          const v = data.components[k] ?? 0;
          const pct = Math.min(100, Math.round((v / meta.cap) * 100));
          return (
            <div key={k}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                <span>{meta.label}</span>
                <span className="tabular-nums">{v.toFixed(1)}/{meta.cap}</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/70 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Next nudge */}
      {data.nextNudge && (
        <Link href={data.nextNudge.toolHref}>
          <div className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 cursor-pointer hover:bg-primary/10 transition-colors">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs leading-relaxed text-foreground flex-1">{data.nextNudge.message}</p>
            <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
          </div>
        </Link>
      )}

      {data.band === "high" && (
        <p className="text-[11px] text-muted-foreground italic">
          Hai accumulato molti segnali. Quando ti senti pronto, considera di passare al percorso{" "}
          <Link href="/profilo"><span className="underline cursor-pointer">Dipendente o Autonomo</span></Link>.
        </p>
      )}
    </div>
  );
}
