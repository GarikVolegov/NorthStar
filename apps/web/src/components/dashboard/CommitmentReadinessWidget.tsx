/**
 * CommitmentReadinessWidget - UI del Discovery Engine (percorso indeciso).
 *
 * Mostra:
 *   - Score 0-100 con banda
 *   - Componenti del punteggio
 *   - Prossimo nudge verso lo strumento del gap dominante
 *
 * Visibile solo per utenti con journeyType="indeciso".
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Compass, RefreshCw, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { useDynamicTranslation } from "@/lib/dynamic-translation";

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

const COMPONENT_META = [
  { key: "selfKnowledge", sourceLabel: "Conoscenza di se", cap: 25 },
  { key: "exploration", sourceLabel: "Alternative esplorate", cap: 25 },
  { key: "reflection", sourceLabel: "Confronto ragionato", cap: 25 },
  { key: "emotion", sourceLabel: "Allineamento emotivo", cap: 15 },
  { key: "commitment", sourceLabel: "Prossimo passo deciso", cap: 10 },
] as const satisfies ReadonlyArray<{
  key: keyof ReadinessData["components"];
  sourceLabel: string;
  cap: number;
}>;

type ReadinessComponentKey = (typeof COMPONENT_META)[number]["key"];

const COMPONENT_KEYS = new Set<ReadinessComponentKey>(
  COMPONENT_META.map((component) => component.key),
);

const BAND_TONE: Record<ReadinessData["band"], string> = {
  low: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  mid: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
};

export async function fetchReadiness(): Promise<ReadinessData> {
  const res = await apiFetch("/api/discovery/readiness");
  if (!res.ok) throw new Error("Errore caricamento readiness");
  return (await res.json()) as ReadinessData;
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

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage || i18n.language || "it";
}

function isReadinessComponentKey(component: string | undefined): component is ReadinessComponentKey {
  return Boolean(component && COMPONENT_KEYS.has(component as ReadinessComponentKey));
}

function useReadinessCopy({
  band,
  locale,
  nudgeComponent,
  nudgeMessage,
}: {
  band: ReadinessData["band"];
  locale: string;
  nudgeComponent: ReadinessComponentKey;
  nudgeMessage: string;
}) {
  const kicker = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.kicker",
    source: "Prontezza alla scelta",
    context: "Dashboard readiness widget small label.",
  });
  const errorTitle = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.error.title",
    source: "Prontezza non disponibile",
    context: "Dashboard readiness recoverable error title.",
  });
  const errorCopy = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.error.copy",
    source: "Non riesco a calcolare la tua prontezza adesso. Riprova o continua dal prossimo passo del percorso.",
    context: "Dashboard readiness recoverable error copy. Keep it practical and user-facing.",
  });
  const errorRetry = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.error.retry",
    source: "Riprova",
    context: "Dashboard readiness retry button label.",
  });
  const errorContinue = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.error.continue",
    source: "Continua dal prossimo passo",
    context: "Dashboard readiness error fallback link label.",
  });
  const bandHeadline = useDynamicTranslation({
    locale,
    key: `dashboard.readiness.bands.${band}.headline`,
    source: band === "high"
      ? "La scelta e vicina"
      : band === "mid"
        ? "Stai mettendo a fuoco"
        : "Hai bisogno di altri indizi",
    context: "Dashboard readiness band headline.",
  });
  const bandSub = useDynamicTranslation({
    locale,
    key: `dashboard.readiness.bands.${band}.sub`,
    source: band === "high"
      ? "Hai abbastanza segnali per preparare il passaggio successivo."
      : band === "mid"
        ? "Le alternative principali stanno emergendo: ora serve confronto concreto."
        : "Raccogli esempi, vincoli e preferenze prima di stringere la scelta.",
    context: "Dashboard readiness band practical subtext.",
  });
  const componentLabels: Record<ReadinessComponentKey, string> = {
    selfKnowledge: useDynamicTranslation({
      locale,
      key: "dashboard.readiness.components.selfKnowledge.label",
      source: COMPONENT_META[0].sourceLabel,
      context: "Readiness component label for self-knowledge.",
    }),
    exploration: useDynamicTranslation({
      locale,
      key: "dashboard.readiness.components.exploration.label",
      source: COMPONENT_META[1].sourceLabel,
      context: "Readiness component label for sector and role exploration.",
    }),
    reflection: useDynamicTranslation({
      locale,
      key: "dashboard.readiness.components.reflection.label",
      source: COMPONENT_META[2].sourceLabel,
      context: "Readiness component label for reflection and comparison.",
    }),
    emotion: useDynamicTranslation({
      locale,
      key: "dashboard.readiness.components.emotion.label",
      source: COMPONENT_META[3].sourceLabel,
      context: "Readiness component label for emotional fit.",
    }),
    commitment: useDynamicTranslation({
      locale,
      key: "dashboard.readiness.components.commitment.label",
      source: COMPONENT_META[4].sourceLabel,
      context: "Readiness component label for commitment.",
    }),
  };
  const highGuidance = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.highGuidance",
    source: "Hai accumulato molti segnali: valuta se trasformare la scelta in un piano operativo.",
    context: "Dashboard readiness high-band guidance. Keep it practical and addressed to the user.",
  });
  const highGuidanceCta = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.highGuidanceCta",
    source: "Prepara il piano",
    context: "Dashboard readiness high-band CTA label.",
  });
  const emptyNudgeTitle = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.emptyNudge.title",
    source: "Scegli il prossimo controllo",
    context: "Dashboard readiness empty nudge title when no backend nudge is available.",
  });
  const emptyNudgeCopy = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.emptyNudge.copy",
    source: "Riparti dal percorso e scegli un'azione piccola: confronta un settore, salva un ruolo o annota un dubbio.",
    context: "Dashboard readiness empty nudge practical copy.",
  });
  const emptyNudgeCta = useDynamicTranslation({
    locale,
    key: "dashboard.readiness.emptyNudge.cta",
    source: "Apri il percorso",
    context: "Dashboard readiness empty nudge CTA.",
  });
  const nudgeCopy = useDynamicTranslation({
    locale,
    key: `dashboard.readiness.nudges.${nudgeComponent}.message`,
    source: nudgeMessage,
    context: "Dashboard readiness next action nudge. Translate dynamically and keep it user-facing, not app-centric.",
  });

  return {
    bandHeadline,
    bandSub,
    componentLabels,
    emptyNudgeCopy,
    emptyNudgeCta,
    emptyNudgeTitle,
    errorContinue,
    errorCopy,
    errorRetry,
    errorTitle,
    highGuidance,
    highGuidanceCta,
    kicker,
    nudgeCopy,
  };
}

export function CommitmentReadinessWidget() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["discovery-readiness"],
    queryFn: fetchReadiness,
    staleTime: 60 * 1000, // 1 min
  });
  const locale = useDashboardLocale();
  const safeData = isReadinessData(data) ? data : null;
  const nudgeComponent = isReadinessComponentKey(safeData?.nextNudge?.component)
    ? safeData.nextNudge.component
    : "exploration";
  const copy = useReadinessCopy({
    band: safeData?.band ?? "low",
    locale,
    nudgeComponent,
    nudgeMessage: safeData?.nextNudge?.message
      ?? "Scegli un'azione concreta per chiarire il prossimo dubbio.",
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
            <h3 className="text-sm font-semibold text-foreground">{copy.errorTitle}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {copy.errorCopy}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
                {copy.errorRetry}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" asChild>
                <Link href="/dashboard">
                  {copy.errorContinue} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bandTone = BAND_TONE[data.band];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20 mb-2">
            <Compass className="w-3 h-3" />
            {copy.kicker}
          </div>
          <h3 className="text-sm font-semibold leading-tight">{copy.bandHeadline}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{copy.bandSub}</p>
        </div>
        <div className={`text-2xl font-bold tabular-nums px-3 py-1 rounded-xl border ${bandTone}`}>
          {Math.round(data.score)}
          <span className="text-xs font-medium opacity-70">/100</span>
        </div>
      </header>

      <div className="space-y-2">
        {COMPONENT_META.map((meta) => {
          const value = data.components[meta.key] ?? 0;
          const pct = Math.min(100, Math.round((value / meta.cap) * 100));
          return (
            <div key={meta.key}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
                <span>{copy.componentLabels[meta.key]}</span>
                <span className="tabular-nums">{value.toFixed(1)}/{meta.cap}</span>
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

      {data.nextNudge ? (
        <Link
          href={data.nextNudge.toolHref}
          className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 hover:bg-primary/10 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <p className="text-xs leading-relaxed text-foreground flex-1">{copy.nudgeCopy}</p>
          <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-foreground">{copy.emptyNudgeTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.emptyNudgeCopy}</p>
          <Link
            href="/dashboard"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {copy.emptyNudgeCta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {data.band === "high" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">{copy.highGuidance}</p>
          <Link
            href="/profilo"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {copy.highGuidanceCta}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
