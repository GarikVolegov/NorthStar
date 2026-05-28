import { WendyAskButton } from "@/components/diary/WendyEntryContext";
import type { DiaryMood, DiaryRecapPayload } from "@/components/diary/diaryTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, CheckCircle2, Lightbulb, NotebookText, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const MOOD_LABELS: Record<DiaryMood, string> = {
  ottimo: "Ottimo",
  bene: "Bene",
  neutro: "Neutro",
  difficile: "Difficile",
  critico: "Critico",
};

export function DiaryRecap() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data, isLoading } = useQuery<DiaryRecapPayload>({
    queryKey: ["diary", "recap", period],
    queryFn: () => getJson(`${BASE}api/diary/recap?period=${period}`),
  });

  const recapPrompt = useMemo(() => {
    if (!data) return "";
    return JSON.stringify(
      {
        periodo: data.period,
        riflessioni: data.entriesCount,
        idee: data.ideasCount,
        ideeCompletate: data.completedIdeasCount,
        analisi: data.analysesCount,
        mood: data.moodCounts,
        tag: data.topTags,
        ultimeRiflessioni: data.latestEntries.map((entry) => ({
          content: entry.content,
          mood: entry.mood,
          tags: entry.tags,
        })),
      },
      null,
      2,
    );
  }, [data]);

  if (isLoading) return <Skeleton className="h-56 rounded-lg" />;
  if (!data) return null;

  const moodTotal = Object.values(data.moodCounts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Recap del diario</h2>
          <p className="mt-1 text-sm text-muted-foreground">Una vista sintetica di riflessioni, idee e pattern.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={cn(
                "min-h-9 rounded-md border px-3 text-xs font-semibold",
                period === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {item === "week" ? "Settimana" : "Mese"}
            </button>
          ))}
          <WendyAskButton kind="recap" content={recapPrompt} journeyType={user?.journeyType} label="Chiedi un recap" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard icon={NotebookText} label="Riflessioni" value={data.entriesCount} />
        <StatCard icon={Lightbulb} label="Idee" value={data.ideasCount} />
        <StatCard icon={CheckCircle2} label="Idee completate" value={data.completedIdeasCount} />
        {user?.journeyType === "investitore" && <StatCard icon={BarChart2} label="Analisi" value={data.analysesCount} />}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Distribuzione mood</h3>
          <div className="mt-4 space-y-3">
            {(Object.keys(MOOD_LABELS) as DiaryMood[]).map((mood) => {
              const count = data.moodCounts[mood] ?? 0;
              const percent = moodTotal > 0 ? Math.round((count / moodTotal) * 100) : 0;
              return (
                <div key={mood}>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{MOOD_LABELS[mood]}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Top tag</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.topTags.length === 0 && <p className="text-sm text-muted-foreground">Ancora nessun tag nel periodo.</p>}
            {data.topTags.map((item) => (
              <span key={item.tag} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                #{item.tag} {item.count}
              </span>
            ))}
          </div>
        </div>
      </section>

      {data.latestEntries.length > 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Ultime riflessioni incluse</h3>
          <div className="mt-4 space-y-3">
            {data.latestEntries.map((entry) => (
              <p key={entry.id} className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {entry.content.length > 180 ? `${entry.content.slice(0, 180)}...` : entry.content}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
