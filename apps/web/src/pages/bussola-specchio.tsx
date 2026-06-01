/**
 * /bussola/specchio — "Lo Specchio": deck di scene a preferenze rivelate.
 * L'utente reagisce a momenti reali di lavoro (mi accende / salvo / mi spegne).
 * Ogni reazione è un segnale: il SERVER deriva i dims RIASEC dalla scena.
 */
import { fetchScenes, useCompass, type SceneCard } from "@/features/compass/useCompass";
import { Flame, Snowflake, Bookmark, Compass, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export default function SpecchioPage() {
  const { recordSignal, profile } = useCompass();
  const [, setLocation] = useLocation();
  const [scenes, setScenes] = useState<SceneCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef<number>(Date.now());

  useEffect(() => {
    void fetchScenes(12).then(setScenes);
  }, []);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [idx]);

  if (scenes === null) {
    return <div className="mx-auto max-w-xl p-6 text-muted-foreground">Preparo lo specchio…</div>;
  }

  const current = scenes[idx];
  const done = idx >= scenes.length;

  async function react(valence: number) {
    if (!current || busy) return;
    setBusy(true);
    const reactionMs = Date.now() - shownAt.current;
    await recordSignal({
      signalType: "scene_swipe",
      refType: "scene",
      refId: current.id,
      valence,
      reactionMs,
    });
    setBusy(false);
    setIdx((i) => i + 1);
  }

  if (done) {
    const top = profile?.hypotheses?.filter((h) => h.verdict !== "discarded")[0];
    return (
      <div className="mx-auto max-w-xl space-y-5 p-6 text-center">
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
          <p className="text-sm text-muted-foreground">Servono ancora un po' di segnali perché emerga una direzione.</p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setLocation(`${BASE}bussola`)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
          >
            Vai alla Bussola
          </button>
          <button
            onClick={() => { setIdx(0); void fetchScenes(12).then(setScenes); }}
            className="flex items-center gap-2 rounded-lg border px-4 py-2"
          >
            <RotateCcw className="h-4 w-4" /> Ancora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col p-6">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>Lo Specchio</span>
        <span>{idx + 1} / {scenes.length}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
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
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-blue-400 disabled:opacity-50"
        >
          <Snowflake className="h-6 w-6 text-blue-400" />
          <span className="text-sm">Mi spegne</span>
        </button>
        <button
          disabled={busy}
          onClick={() => react(0.5)}
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-amber-400 disabled:opacity-50"
        >
          <Bookmark className="h-6 w-6 text-amber-400" />
          <span className="text-sm">Salvo</span>
        </button>
        <button
          disabled={busy}
          onClick={() => react(1)}
          className="flex flex-col items-center gap-1 rounded-xl border p-4 transition hover:border-primary disabled:opacity-50"
        >
          <Flame className="h-6 w-6 text-primary" />
          <span className="text-sm">Mi accende</span>
        </button>
      </div>
    </div>
  );
}
