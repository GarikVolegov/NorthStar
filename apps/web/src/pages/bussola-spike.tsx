/**
 * /bussola/spike — "Career Spike": il commit reversibile.
 * Da un'ipotesi si crea un micro-esperimento di 2 settimane con kill-criterion
 * deciso PRIMA. Alla review: continua (→ committed) o stop (un "no informato",
 * non un fallimento). Riusa objectives + calendar lato server.
 */
import {
  useCompass,
  fetchSpikes,
  proposeSpikeFor,
  createSpike,
  resolveSpike,
  type CareerSpike,
  type SpikeSuggestion,
  type CompassHypothesis,
} from "@/features/compass/useCompass";
import { FlaskConical, Compass, Target, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

function reviewInDays(reviewDate: string): number {
  return Math.ceil((new Date(reviewDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function SpikePage() {
  const { profile, reload } = useCompass();
  const [, setLocation] = useLocation();
  const [spikes, setSpikes] = useState<CareerSpike[]>([]);

  // creazione
  const [hyp, setHyp] = useState<CompassHypothesis | null>(null);
  const [suggestions, setSuggestions] = useState<SpikeSuggestion[]>([]);
  const [action, setAction] = useState("");
  const [killCriterion, setKillCriterion] = useState("");
  const [busy, setBusy] = useState(false);

  // review
  const [reviewing, setReviewing] = useState<CareerSpike | null>(null);
  const [energy, setEnergy] = useState(0.5);
  const [learned, setLearned] = useState("");

  useEffect(() => { void fetchSpikes().then(setSpikes); }, []);

  const openHyps = (profile?.hypotheses ?? []).filter((h) => h.verdict !== "discarded");
  const active = spikes.filter((s) => s.status === "active");
  const past = spikes.filter((s) => s.status !== "active");

  async function startCreate(h: CompassHypothesis) {
    setHyp(h);
    setAction("");
    setKillCriterion("");
    const sugg = await proposeSpikeFor(h.label, h.clusterId);
    setSuggestions(sugg);
    if (sugg[0]) { setAction(sugg[0].action); setKillCriterion(sugg[0].killCriterion); }
  }

  async function submitCreate() {
    if (!hyp || !action.trim() || !killCriterion.trim() || busy) return;
    setBusy(true);
    const created = await createSpike({
      hypothesisLabel: hyp.label,
      refType: hyp.clusterId.split(":")[0] ?? null,
      refId: hyp.clusterId,
      action: action.trim(),
      killCriterion: killCriterion.trim(),
    });
    if (created) {
      setSpikes((s) => [created, ...s]);
      setHyp(null);
      await reload();
    }
    setBusy(false);
  }

  async function submitReview(decision: "continue" | "kill") {
    if (!reviewing || busy) return;
    setBusy(true);
    const result = await resolveSpike(reviewing.id, decision, energy, learned.trim() || undefined);
    if (result) {
      setSpikes((s) => s.map((x) => (x.id === reviewing.id ? result.spike : x)));
      setReviewing(null);
      setLearned("");
      setEnergy(0.5);
      await reload();
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <FlaskConical className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">I tuoi Spike</h1>
          <p className="text-sm text-muted-foreground">Un test di 2 settimane, non un matrimonio. Decidi il criterio di stop prima.</p>
        </div>
      </header>

      {/* Creazione da ipotesi */}
      {!hyp && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Metti alla prova un'ipotesi</h2>
          {openHyps.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Non hai ancora ipotesi da testare. Passa dallo Specchio o dal Torneo: emergeranno dal tuo comportamento.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {openHyps.slice(0, 4).map((h) => (
                <button
                  key={h.clusterId}
                  onClick={() => void startCreate(h)}
                  className="flex items-center justify-between rounded-xl border bg-card p-4 text-left transition hover:border-primary/50"
                >
                  <span>
                    <span className="block font-medium">{h.label}</span>
                    <span className="block text-xs text-muted-foreground">{Math.round(h.confidence * 100)}% · mettila alla prova</span>
                  </span>
                  <Target className="h-5 w-5 text-primary" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Form creazione */}
      {hyp && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Spike: <span className="text-primary">{hyp.label}</span></h2>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Azioni suggerite (piccole, ~2 settimane)</p>
              <div className="flex flex-col gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setAction(s.action); setKillCriterion(s.killCriterion); }}
                    className={`rounded-lg border p-3 text-left text-sm transition hover:border-primary/50 ${action === s.action ? "border-primary bg-primary/5" : ""}`}
                  >
                    {s.action}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-medium">La tua azione</span>
            <textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background p-2 text-sm"
              placeholder="Es. Completa il primo modulo di un corso + intervista 1 persona del ruolo"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Criterio di stop <span className="text-primary">(obbligatorio)</span></span>
            <textarea
              value={killCriterion}
              onChange={(e) => setKillCriterion(e.target.value)}
              rows={2}
              className="w-full rounded-lg border bg-background p-2 text-sm"
              placeholder="Es. Se dopo 2h mi annoia più di quanto mi incuriosisce, mi fermo."
            />
            <span className="text-xs text-muted-foreground">Deciderlo prima ti protegge dall'auto-inganno.</span>
          </label>

          <p className="text-xs text-muted-foreground">Review automatica tra 14 giorni (te la metto in calendario e tra gli obiettivi).</p>

          <div className="flex gap-3">
            <button
              disabled={!action.trim() || !killCriterion.trim() || busy}
              onClick={() => void submitCreate()}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Avvia lo spike
            </button>
            <button onClick={() => setHyp(null)} className="rounded-lg border px-4 py-2 text-sm">Annulla</button>
          </div>
        </section>
      )}

      {/* Spike attivi */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">In corso</h2>
          {active.map((s) => {
            const days = reviewInDays(s.reviewDate);
            return (
              <div key={s.id} className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.hypothesisLabel}</span>
                  <span className="text-xs text-muted-foreground">{days > 0 ? `review tra ${days}g` : "review pronta"}</span>
                </div>
                <p className="text-sm">{s.action}</p>
                <p className="text-xs text-muted-foreground">Stop se: {s.killCriterion}</p>
                <button
                  onClick={() => { setReviewing(s); setEnergy(0.5); setLearned(""); }}
                  className="mt-1 rounded-lg border px-3 py-1.5 text-sm transition hover:border-primary/50"
                >
                  Rivedi ora
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* Modal review */}
      {reviewing && (
        <section className="space-y-4 rounded-xl border-2 border-primary/40 bg-card p-5">
          <h2 className="text-lg font-semibold">Com'è andato: {reviewing.hypothesisLabel}?</h2>
          <div className="space-y-1">
            <span className="text-sm font-medium">Quanta energia ti ha dato?</span>
            <input
              type="range" min={-1} max={1} step={0.1} value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground"><span>Mi ha scaricato</span><span>Mi ha acceso</span></div>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Cosa hai imparato?</span>
            <textarea value={learned} onChange={(e) => setLearned(e.target.value)} rows={2} className="w-full rounded-lg border bg-background p-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} onClick={() => void submitReview("continue")} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Continuo su questa strada
            </button>
            <button disabled={busy} onClick={() => void submitReview("kill")} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">
              <XCircle className="h-4 w-4" /> Stop — non fa per me
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fermarti non è un fallimento: hai scoperto che non fa per te in 2 settimane invece che in 2 anni. È una vittoria.
          </p>
        </section>
      )}

      {/* Storico */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Testati</h2>
          {past.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card/50 p-3 text-sm">
              <span>{s.hypothesisLabel}</span>
              <span className={`flex items-center gap-1.5 text-xs ${s.status === "completed_continue" ? "text-primary" : "text-muted-foreground"}`}>
                {s.status === "completed_continue"
                  ? <><Sparkles className="h-3.5 w-3.5" /> confermata</>
                  : <>testata e scartata — progresso</>}
              </span>
            </div>
          ))}
        </section>
      )}

      <button onClick={() => setLocation(`${BASE}bussola`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Compass className="h-4 w-4" /> Torna alla Bussola
      </button>
    </div>
  );
}
