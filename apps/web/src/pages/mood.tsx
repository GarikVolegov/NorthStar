/**
 * /mood — pagina del tool B10 "Mood-to-Action" (percorso indeciso).
 *
 * 5 slider 0-100 → Wendy mappa lo stato in UNA azione consigliata.
 * Anti-overwhelm by design: niente classifica, niente trend complessi,
 * solo "qual è la cosa giusta da fare adesso?".
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Sparkles, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface MoodState {
  energy: number;
  anxiety: number;
  curiosity: number;
  clarity: number;
  motivation: number;
}

interface Suggestion {
  toolHref: string;
  toolLabel: string;
  rationale: string;
}

const SLIDER_META: Array<{ key: keyof MoodState; label: string; low: string; high: string; emoji: string }> = [
  { key: "energy",     label: "Energia",     low: "Spento",      high: "Carico",       emoji: "⚡" },
  { key: "anxiety",    label: "Ansia",       low: "Calmo",        high: "Tesissimo",    emoji: "🌊" },
  { key: "curiosity",  label: "Curiosità",   low: "Spento",       high: "Acceso",       emoji: "🔍" },
  { key: "clarity",    label: "Chiarezza",   low: "Confuso",      high: "Limpido",      emoji: "🧭" },
  { key: "motivation", label: "Motivazione", low: "Vorrei dormire", high: "Voglio fare", emoji: "🚀" },
];

const DEFAULT_MOOD: MoodState = { energy: 50, anxiety: 50, curiosity: 50, clarity: 50, motivation: 50 };

export default function MoodPage() {
  const [mood, setMood] = useState<MoodState>(DEFAULT_MOOD);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: keyof MoodState, value: number) {
    setMood((m) => ({ ...m, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/mood/checkins", {
        method: "POST",
        body: JSON.stringify(mood),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSuggestion(data.suggestion);
      setCheckinId(data.checkin?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'invio");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setMood(DEFAULT_MOOD);
    setSuggestion(null);
    setCheckinId(null);
    setError(null);
  }

  async function markActed() {
    if (!checkinId) return;
    apiFetch(`/api/mood/checkins/${checkinId}/acted`, { method: "POST" }).catch(() => {/* silent */});
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 mb-3">
          <Sparkles className="w-3 h-3" />
          Mood-to-Action · 60 secondi
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Come stai oggi?</h1>
        <p className="text-muted-foreground mt-2">
          Cinque slider. Una sola azione consigliata. Niente classifica, niente pressione.
        </p>
      </header>

      {!suggestion ? (
        <section className="space-y-7 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {SLIDER_META.map((meta) => (
            <div key={meta.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">
                  {meta.emoji} {meta.label}
                </label>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {mood[meta.key]}
                </span>
              </div>
              <Slider
                value={[mood[meta.key]]}
                min={0}
                max={100}
                step={1}
                onValueChange={(v) => update(meta.key, v[0] ?? 50)}
              />
              <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                <span>{meta.low}</span>
                <span>{meta.high}</span>
              </div>
            </div>
          ))}

          <div className="pt-2 flex gap-2 justify-end">
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Reset
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Cerco l'azione giusta…" : "Cosa dovrei fare?"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>
      ) : (
        <section className="rounded-2xl border border-primary/30 bg-card p-6 shadow-md">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3 h-3" />
            Suggerimento
          </div>
          <h2 className="text-2xl font-bold mb-3">{suggestion.toolLabel}</h2>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {suggestion.rationale}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={suggestion.toolHref}>
              <Button onClick={markActed} className="group">
                Vai allo strumento
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Nuovo check-in
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Niente forzature. Se questo suggerimento non risuona, fai un altro check-in fra qualche ora.
          </p>
        </section>
      )}
    </main>
  );
}
