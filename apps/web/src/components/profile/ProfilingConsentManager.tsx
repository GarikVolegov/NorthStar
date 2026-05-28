import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { deleteJson, patchJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Download, Loader2, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProfilingDimension, PsychologicalProfileResponse } from "./PsychologicalProfileCard";

const BASE = import.meta.env.BASE_URL || "/";

const DIMENSION_COPY: Record<ProfilingDimension, { label: string; description: string }> = {
  big_five: {
    label: "Big Five",
    description: "Personalità OCEAN dichiarata o inferita con confidenza esplicita.",
  },
  values: {
    label: "Valori",
    description: "Valori Schwartz e priorità che guidano le scelte professionali.",
  },
  motivation: {
    label: "Motivazione",
    description: "Bisogni SDT e McClelland: autonomia, competenza, relazioni e drive.",
  },
  linguistic: {
    label: "Analisi linguistica",
    description: "Metriche aggregate del linguaggio usato con Wendy, senza testo grezzo.",
  },
  behavioral_passive: {
    label: "Segnali comportamentali",
    description: "Pattern aggregati di uso, profondità, stile decisionale e rischio.",
  },
  chronotype: {
    label: "Cronotipo",
    description: "Fasce orarie di attività aggregate per adattare suggerimenti e timing.",
  },
};

function downloadJson(data: PsychologicalProfileResponse) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "northstar-profilo-psicologico.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function ProfilingConsentManager({
  data,
  onRefresh,
}: {
  data: PsychologicalProfileResponse;
  onRefresh: () => Promise<unknown> | unknown;
}) {
  const [pending, setPending] = useState<ProfilingDimension | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byDimension = new Map(data.consents.map((consent) => [consent.dimension, consent]));

  async function grant(dimension: ProfilingDimension) {
    setError(null);
    setPending(dimension);
    try {
      await patchJson(`${BASE}api/profile/psychological-profile`, {
        consents: { [dimension]: true },
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore consenso");
    } finally {
      setPending(null);
    }
  }

  async function revoke(dimension: ProfilingDimension) {
    const label = DIMENSION_COPY[dimension].label;
    if (!window.confirm(`Cancellare la dimensione "${label}" dal tuo profilo?`)) {
      return;
    }
    setError(null);
    setPending(dimension);
    try {
      await deleteJson(`${BASE}api/profile/psychological-profile/${dimension}`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore cancellazione");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Consensi profiling</h2>
            <p className="text-sm text-muted-foreground">Controlla ogni dimensione raccolta da NorthStar.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 rounded-full"
          onClick={() => downloadJson(data)}
        >
          <Download className="h-3.5 w-3.5" />
          Scarica il mio profilo
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="divide-y rounded-xl border">
        {Object.entries(DIMENSION_COPY).map(([dimension, copy]) => {
          const key = dimension as ProfilingDimension;
          const consent = byDimension.get(key);
          const granted = consent?.granted === true;
          const isPending = pending === key;
          return (
            <div key={key} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{copy.label}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      granted ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {granted ? "Attivo" : "Disattivo"}
                  </span>
                </div>
                <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <Switch
                  aria-label={copy.label}
                  checked={granted}
                  disabled={isPending}
                  onCheckedChange={(checked) => {
                    if (checked) void grant(key);
                    else void revoke(key);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isPending}
                  aria-label={`Cancella ${copy.label}`}
                  onClick={() => void revoke(key)}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Cancella
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
