/**
 * /bussola/torneo — "Il Torneo": scelta a coppie a preferenze rivelate.
 * L'indeciso costruisce per SOTTRAZIONE: non "quale è giusto", ma "quale ti
 * tira di più?". Ogni scelta è un segnale; il SERVER deriva i dims RIASEC dai
 * due cluster (anti-gaming) e la Bussola si ricalibra.
 */
import {
  fetchTournament,
  chooseTournament,
  type TournamentCluster,
  type CompassProfile,
} from "@/features/compass/useCompass";
import { Swords, Compass, RotateCcw, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const RIASEC_LABEL: Record<string, string> = {
  R: "Pratico", I: "Indagatore", A: "Creativo", S: "Sociale", E: "Intraprendente", C: "Metodico",
};

export default function TorneoPage() {
  const [, setLocation] = useLocation();
  const [pair, setPair] = useState<TournamentCluster[] | null>(null);
  const [comparisons, setComparisons] = useState(0);
  const [target, setTarget] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<CompassProfile | null>(null);
  const shownAt = useRef<number>(Date.now());

  useEffect(() => {
    void fetchTournament().then((t) => {
      if (t) {
        setPair(t.pair);
        setComparisons(t.comparisons);
        setTarget(t.target);
        setDone(t.done);
      }
      setLoading(false);
      shownAt.current = Date.now();
    });
  }, []);

  async function choose(winner: TournamentCluster, loser: TournamentCluster) {
    if (busy) return;
    setBusy(true);
    const reactionMs = Date.now() - shownAt.current;
    const result = await chooseTournament(winner.clusterId, loser.clusterId, reactionMs);
    if (result) {
      setProfile(result.profile);
      setPair(result.pair);
      setComparisons(result.comparisons);
      setTarget(result.target);
      setDone(result.done);
      shownAt.current = Date.now();
    }
    setBusy(false);
  }

  if (loading) {
    return <div className="mx-auto max-w-xl p-6 text-muted-foreground">Preparo il torneo…</div>;
  }

  if (done || !pair || pair.length < 2) {
    const top = profile?.hypotheses?.filter((h) => h.verdict !== "discarded")[0];
    return (
      <div className="mx-auto max-w-xl space-y-5 p-6 text-center">
        <Compass className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">Torneo concluso</h1>
        <p className="text-muted-foreground">
          Non ti ho chiesto cosa è "giusto" — ho guardato verso cosa ti sei spinto, scelta dopo scelta.
        </p>
        {top ? (
          <p className="rounded-lg border bg-card p-4">
            In testa adesso: <span className="font-semibold text-primary">{top.label}</span>{" "}
            ({Math.round(top.confidence * 100)}%)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Servono ancora un po' di scelte perché emerga una direzione netta.</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setLocation(`${BASE}bussola`)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
          >
            Vai alla Bussola <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setLoading(true);
              void fetchTournament().then((t) => {
                if (t) { setPair(t.pair); setComparisons(t.comparisons); setTarget(t.target); setDone(t.done); }
                setLoading(false);
                shownAt.current = Date.now();
              });
            }}
            className="flex items-center gap-2 rounded-lg border px-4 py-2"
          >
            <RotateCcw className="h-4 w-4" /> Ancora
          </button>
        </div>
      </div>
    );
  }

  const [a, b] = pair as [TournamentCluster, TournamentCluster];
  const progress = target > 0 ? Math.min(100, Math.round((comparisons / target) * 100)) : 0;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col p-6">
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Swords className="h-4 w-4" /> Il Torneo</span>
        <span>{comparisons} / {target}</span>
      </div>
      <div className="mb-6 h-1.5 w-full rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      <p className="mb-4 text-center text-lg font-medium">Quale ti tira di più?</p>

      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {[a, b].map((c, i) => (
          <button
            key={c.clusterId}
            disabled={busy}
            onClick={() => choose(c, i === 0 ? b : a)}
            className="group flex flex-col items-start justify-between gap-4 rounded-2xl border bg-card p-6 text-left shadow-sm transition hover:border-primary hover:shadow-md disabled:opacity-50"
          >
            <span className="text-lg font-semibold">{c.label}</span>
            <span className="flex flex-wrap gap-1.5">
              {c.riasec.map((r) => {
                const letter = r.charAt(0).toUpperCase();
                return (
                  <span key={r} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {RIASEC_LABEL[letter] ?? letter}
                  </span>
                );
              })}
            </span>
            <span className="text-xs text-primary opacity-0 transition group-hover:opacity-100">Scelgo questo →</span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Di pancia. Non c'è risposta giusta — c'è la tua.
      </p>
    </div>
  );
}
