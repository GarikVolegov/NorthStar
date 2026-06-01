/**
 * /bussola — hub de "La Bussola" per l'utente indeciso.
 * Mostra lo stage del percorso, la confidenza direzionale, le ipotesi emerse
 * (fuse da test RIASEC + try-a-day + diario indizi) e i prossimi passi.
 */
import { useCompass, type CompassStage, type CompassBlockType } from "@/features/compass/useCompass";
import { CommittedActionPlan } from "@/features/compass/CommittedActionPlan";
import { Compass, Sparkles, Target, Zap, ArrowRight, HelpCircle, Swords, FlaskConical } from "lucide-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const STAGES: { id: CompassStage; label: string; hint: string }[] = [
  { id: "zero_ideas", label: "Zero idee", hint: "Esploriamo" },
  { id: "hypotheses", label: "Ipotesi", hint: "Stanno emergendo direzioni" },
  { id: "experimenting", label: "In prova", hint: "Spike attivo" },
  { id: "committed", label: "Direzione", hint: "Confermata dall'esperienza" },
];

const BLOCK_LABEL: Record<CompassBlockType, string> = {
  too_many_interests: "Troppi interessi",
  no_interests: "Niente mi accende",
  fear_economic: "Paura economica",
  external_pressure: "Pressione esterna",
  fear_mediocrity: "Paura di essere mediocre",
  unknown: "Da capire",
};

export default function BussolaPage() {
  const { profile, loading, error } = useCompass();
  const [, setLocation] = useLocation();

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6 text-muted-foreground">Calibro la tua bussola…</div>;
  }
  if (error || !profile) {
    return <div className="mx-auto max-w-3xl p-6 text-destructive">Non riesco a leggere la bussola. {error}</div>;
  }

  const stageIdx = STAGES.findIndex((s) => s.id === profile.stage);
  const openHyp = profile.hypotheses.filter((h) => h.verdict !== "discarded");
  const energizers = profile.energyProfile?.energizers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Compass className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">La tua Bussola</h1>
          <p className="text-sm text-muted-foreground">
            Non una mappa, una direzione che si calibra mentre esplori.
          </p>
        </div>
      </header>

      {/* Il ponte verso il lavoro vero (solo se direzione confermata / committed) */}
      <CommittedActionPlan />

      {/* Stage progress */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Il tuo punto del viaggio</span>
          <span className="text-xs text-muted-foreground">
            confidenza direzione {Math.round(profile.directionConfidence * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-2 w-full rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`}
              />
              <span className={`text-[11px] ${i === stageIdx ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {STAGES[stageIdx >= 0 ? stageIdx : 0]?.hint} · {profile.signalCount} segnali raccolti
          {profile.blockType !== "unknown" && ` · blocco: ${BLOCK_LABEL[profile.blockType]}`}
        </p>
      </section>

      {/* Ipotesi */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Ipotesi che stanno emergendo</h2>
        </div>
        {openHyp.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ancora nessuna direzione. Fai qualche swipe nello Specchio: emergeranno dal tuo comportamento, non da un quiz.
          </p>
        ) : (
          <ul className="space-y-2">
            {openHyp.map((h) => (
              <li key={h.clusterId} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.label}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(h.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(h.confidence * 100)}%` }} />
                </div>
                {h.source.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">da: {h.source.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Energia */}
      {energizers.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Cosa ti accende</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {energizers.map((e) => (
              <span key={e} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{e}</span>
            ))}
          </div>
        </section>
      )}

      {/* Prossimi passi */}
      <section className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setLocation(`${BASE}bussola/specchio`)}
          className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>
              <span className="block font-medium">Lo Specchio</span>
              <span className="block text-xs text-muted-foreground">Scopri cosa ti muove, per davvero</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => setLocation(`${BASE}bussola/blocco`)}
          className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span>
              <span className="block font-medium">Cosa ti blocca</span>
              <span className="block text-xs text-muted-foreground">Diamo un nome all'indecisione</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => setLocation(`${BASE}bussola/torneo`)}
          className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
        >
          <span className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <span>
              <span className="block font-medium">Il Torneo</span>
              <span className="block text-xs text-muted-foreground">Scegli per sottrazione: quale ti tira di più?</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
        </button>
        <button
          onClick={() => setLocation(`${BASE}bussola/spike`)}
          className="group flex items-center justify-between rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
        >
          <span className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span>
              <span className="block font-medium">Mettila alla prova</span>
              <span className="block text-xs text-muted-foreground">Uno spike di 2 settimane, reversibile</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1" />
        </button>
      </section>
    </div>
  );
}
