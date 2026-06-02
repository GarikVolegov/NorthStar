/**
 * /bussola/specchio — "Lo Specchio": deck di scene a preferenze rivelate.
 * L'utente reagisce a momenti reali di lavoro (mi accende / salvo / mi spegne).
 * Ogni reazione e' un segnale: il SERVER deriva i dims RIASEC dalla scena
 * (anti-gaming) e ricomputa la Bussola. Dopo ogni scelta mostriamo cosa sta
 * emergendo davvero, cosi' l'utente vede la direzione formarsi in diretta.
 */
import {
  fetchScenes,
  useCompass,
  type SceneCard,
  type CompassProfile,
} from "@/features/compass/useCompass";
import { Flame, Snowflake, Bookmark, Compass, RotateCcw, Undo2, SkipForward, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const RIASEC_LABEL: Record<string, string> = {
  R: "Pratico", I: "Indagatore", A: "Creativo", S: "Sociale", E: "Intraprendente", C: "Metodico",
};

/** La dimensione RIASEC piu' forte emersa finora (o null se non c'e' segnale). */
function topRevealedDim(revealed: Record<string, number> | undefined): string | null {
  if (!revealed) return null;
  const entries = Object.entries(revealed).filter(([k]) => RIASEC_LABEL[k] && Number.isFinite(revealed[k]));
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [key, val] = entries[0]!;
  return val > 0 ? (RIASEC_LABEL[key] ?? null) : null;
}

interface Feedback { kind: "warm" | "cold"; dim: string | null; hypothesis: string | null }

export default function SpecchioPage() {
  const { recordSignal, undoLastSignal, profile } = useCompass();
  const [, setLocation] = useLocation();
  const [scenes, setScenes] = useState<SceneCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reacted, setReacted] = useState(0); // quante reazioni in questa sessione (per l'undo)
  const shownAt = useRef<number>(Date.now());

  function loadDeck() {
    setScenes(null);
    void fetchScenes(12).then((s) => {
      setScenes(s);
      setIdx(0);
      setFeedback(null);
      shownAt.current = Date.now();
    });
  }

  useEffect(() => { loadDeck(); }, []);
  useEffect(() => { shownAt.current = Date.now(); }, [idx]);

  if (scenes === null) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-muted" />
        <p className="text-center text-sm text-muted-foreground">Preparo lo specchio…</p>
      </div>
    );
  }

  // Deck vuoto: nessuna scena disponibile (es. tutte gia' viste o seed mancante).
  if (scenes.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-5 p-6 text-center">
        <Compass className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">Hai esaurito lo specchio</h1>
        <p className="text-muted-foreground">
          Hai gia' reagito a tutte le scene disponibili. Le tue reazioni stanno gia' calibrando la Bussola.
        </p>
        <button
          onClick={() => setLocation(`${BASE}bussola`)}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        >
          Vai alla Bussola
        </button>
      </div>
    );
  }

  const current = scenes[idx];
  const done = idx >= scenes.length;

  function buildFeedback(valence: number, next: CompassProfile | null): Feedback {
    const dim = topRevealedDim(next?.revealedRiasec);
    const hyp = next?.hypotheses?.filter((h) => h.verdict !== "discarded")[0]?.label ?? null;
    return { kind: valence > 0 ? "warm" : "cold", dim, hypothesis: hyp };
  }

  async function react(valence: number) {
    if (!current || busy) return;
    setBusy(true);
    const reactionMs = Date.now() - shownAt.current;
    const next = await recordSignal({
      signalType: "scene_swipe",
      refType: "scene",
      refId: current.id,
      valence,
      reactionMs,
    });
    setFeedback(buildFeedback(valence, next));
    setReacted((n) => n + 1);
    setBusy(false);
    setIdx((i) => i + 1);
  }

  function skip() {
    if (busy) return;
    setFeedback(null);
    setIdx((i) => i + 1);
  }

  async function undo() {
    if (busy || reacted === 0 || idx === 0) return;
    setBusy(true);
    await undoLastSignal("scene_swipe");
    setReacted((n) => Math.max(0, n - 1));
    setFeedback(null);
    setIdx((i) => Math.max(0, i - 1));
    setBusy(false);
  }

  if (done) {
    const top = profile?.hypotheses?.filter((h) => h.verdict !== "discarded")[0];
    return (
      <div className="mx-auto max-w-xl space-y-5 p-6 text-center animate-in fade-in-0 duration-300">
        <Compass className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl font-bold">Specchio fatto</h1>
        <p className="text-muted-foreground">
          Ho letto le tue reazioni — non quello che dici di volere, ma verso cosa ti muovi.
        </p>
        {top ? (
          <p className="rounded-lg border bg-card p-4">
            Sta emergendo: <span className="font-semibold text-primary">{top.label}</span>{" "}
            ({Math.round(top.confidence * 100)}%)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Servono ancora un po' di segnali perche' emerga una direzione.</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setLocation(`${BASE}bussola`)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
          >
            Vai alla Bussola
          </button>
          <button
            onClick={loadDeck}
            className="flex items-center gap-2 rounded-lg border px-4 py-2"
          >
            <RotateCcw className="h-4 w-4" /> Ancora
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.round((idx / scenes.length) * 100);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col p-6">
      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Compass className="h-4 w-4" /> Lo Specchio</span>
        <span>{idx + 1} / {scenes.length}</span>
      </div>
      <div className="mb-4 h-1.5 w-full rounded-full bg-muted">
        <div className="h-1.5 rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Micro-feedback: cosa sta emergendo dopo l'ultima reazione */}
      {feedback && (
        <div
          key={`fb-${idx}`}
          className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm animate-in fade-in-0 slide-in-from-top-2 duration-300"
        >
          <span className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              {feedback.kind === "warm" && feedback.dim
                ? <>Sta emergendo il tuo lato <span className="font-semibold text-primary">{feedback.dim}</span>.</>
                : feedback.kind === "cold"
                  ? <>Annotato. Anche un &laquo;no&raquo; e' un'informazione preziosa.</>
                  : <>Reazione registrata. Continua: la direzione si forma cosi'.</>}
              {feedback.hypothesis && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Ipotesi in testa: <span className="font-medium text-foreground">{feedback.hypothesis}</span>
                </span>
              )}
            </span>
          </span>
          <button
            onClick={() => void undo()}
            disabled={busy}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" /> annulla
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center">
        <div
          key={current!.id}
          className="rounded-2xl border bg-card p-8 shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-300"
        >
          <p className="text-lg leading-relaxed">{current!.prompt}</p>
          {current!.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {current!.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-muted-foreground">Come reagisci, di pancia?</p>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4">
        <button
          disabled={busy}
          onClick={() => react(-1)}
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-blue-400 hover:bg-blue-400/5 disabled:opacity-50"
        >
          <Snowflake className="h-6 w-6 text-blue-400" />
          <span className="text-sm">Mi spegne</span>
        </button>
        <button
          disabled={busy}
          onClick={() => react(0.5)}
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-amber-400 hover:bg-amber-400/5 disabled:opacity-50"
        >
          <Bookmark className="h-6 w-6 text-amber-400" />
          <span className="text-sm">Salvo</span>
        </button>
        <button
          disabled={busy}
          onClick={() => react(1)}
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-sm">Mi accende</span>
        </button>
      </div>

      <button
        onClick={skip}
        disabled={busy}
        className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      >
        <SkipForward className="h-3.5 w-3.5" /> Non mi dice niente, salta
      </button>
    </div>
  );
}
