import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { ArrowLeft, Battery, Bot, CheckCircle2, HeartHandshake, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type MoodValue = "calmo" | "carico" | "confuso" | "stanco";
type EnergyValue = "bassa" | "media" | "alta";

interface MoodEntry {
  mood: MoodValue;
  energy: EnergyValue;
  note: string;
  savedAt: string;
}

const MOODS: Array<{ value: MoodValue; label: string; detail: string }> = [
  { value: "calmo", label: "Calmo", detail: "Ho spazio mentale" },
  { value: "carico", label: "Carico", detail: "Voglio muovermi" },
  { value: "confuso", label: "Confuso", detail: "Serve chiarezza" },
  { value: "stanco", label: "Stanco", detail: "Mi serve leggerezza" },
];

const ENERGIES: Array<{ value: EnergyValue; label: string }> = [
  { value: "bassa", label: "Bassa" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const STORAGE_KEY = "northstar:mood:last-check-in";

function buildWendyPrompt(entry: MoodEntry): string {
  const note = entry.note.trim() ? ` Nota: ${entry.note.trim()}` : "";
  return `Mood check-in NorthStar: oggi mi sento ${entry.mood}, energia ${entry.energy}.${note} Suggeriscimi una sola azione concreta da fare nei prossimi 20 minuti.`;
}

function formatSavedAt(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MoodPage() {
  usePageMeta({
    title: "Mood check-in | Fondazione NorthStar",
    description: "Un check-in rapido per scegliere il prossimo passo con piu lucidita.",
  });

  const wendy = useOptionalWendy();
  const [mood, setMood] = useState<MoodValue>("calmo");
  const [energy, setEnergy] = useState<EnergyValue>("media");
  const [note, setNote] = useState("");
  const [lastEntry, setLastEntry] = useState<MoodEntry | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      setLastEntry(JSON.parse(raw) as MoodEntry);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const currentEntry = useMemo<MoodEntry>(() => ({
    mood,
    energy,
    note,
    savedAt: new Date().toISOString(),
  }), [energy, mood, note]);

  function handleSave(sendToWendy: boolean) {
    const entry = { ...currentEntry, note: note.trim() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    setLastEntry(entry);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
    if (sendToWendy) wendy?.ask(buildWendyPrompt(entry));
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Link href="/dashboard" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Torna alla dashboard
      </Link>

      <section className="mb-6 border-b pb-6">
        <p className="text-xs font-semibold uppercase text-primary">Check-in 60s</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Mood check-in</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Registra come stai ora e, se vuoi, passa il contesto a Wendy per scegliere una prossima azione piccola.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HeartHandshake className="h-5 w-5 text-primary" />
              Come ti senti?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MOODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMood(item.value)}
                  className={cn(
                    "min-h-20 rounded-lg border p-4 text-left transition-colors",
                    mood === item.value ? "border-primary bg-primary/10 text-foreground" : "bg-background hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                </button>
              ))}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Battery className="h-4 w-4 text-primary" />
                Energia
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ENERGIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEnergy(item.value)}
                    className={cn(
                      "min-h-11 rounded-md border px-3 text-sm font-semibold transition-colors",
                      energy === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-foreground">Nota opzionale</span>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Cosa pesa o cosa ti darebbe sollievo?"
                className="min-h-28"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-10 gap-2" onClick={() => handleSave(true)} disabled={!wendy}>
                <Send className="h-4 w-4" />
                Salva e chiedi a Wendy
              </Button>
              <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={() => handleSave(false)}>
                <CheckCircle2 className="h-4 w-4" />
                Salva check-in
              </Button>
            </div>

            {saved && (
              <p className="text-sm font-medium text-primary" role="status">
                Check-in salvato su questo dispositivo.
              </p>
            )}
          </CardContent>
        </Card>

        <aside className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Ultimo check-in</h2>
          {lastEntry ? (
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                Mood: <span className="font-semibold text-foreground">{lastEntry.mood}</span>
              </p>
              <p>
                Energia: <span className="font-semibold text-foreground">{lastEntry.energy}</span>
              </p>
              <p className="text-xs">Salvato: {formatSavedAt(lastEntry.savedAt)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Nessun check-in salvato su questo dispositivo.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
