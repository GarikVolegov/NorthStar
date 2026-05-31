import { WendyAskButton } from "@/components/diary/WendyEntryContext";
import type { DiaryIdea, DiaryImportance } from "@/components/diary/diaryTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Circle, Lightbulb, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const EMOJI_OPTIONS = ["💡", "🎯", "🚀", "📌", "🧭", "📚", "⚙️", "⭐", "🌱"];
const IMPORTANCE_OPTIONS: Array<{ value: DiaryImportance; label: string; className: string }> = [
  { value: "bassa", label: "Bassa", className: "border-slate-400/30 bg-slate-500/10 text-slate-600" },
  { value: "media", label: "Media", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  { value: "alta", label: "Alta", className: "border-red-500/30 bg-red-500/10 text-red-700" },
];
const DEFAULT_IMPORTANCE_META = IMPORTANCE_OPTIONS[1]!;

function daysUntil(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return "Scaduta";
  if (days === 0) return "Scade oggi";
  if (days === 1) return "Scade domani";
  return `Scade tra ${days} giorni`;
}

export function DiaryIdeas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<DiaryImportance>("media");
  const [dueDate, setDueDate] = useState("");
  const [emoji, setEmoji] = useState("💡");

  const { data, isLoading } = useQuery<{ ideas: DiaryIdea[] }>({
    queryKey: ["diary", "ideas"],
    queryFn: () => getJson(`${BASE}api/diary/ideas`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["diary"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      postJson(`${BASE}api/diary/ideas`, {
        content,
        importance,
        dueDate: dueDate || null,
        emoji,
      }),
    onSuccess: () => {
      setContent("");
      setDueDate("");
      setImportance("media");
      setEmoji("💡");
      invalidate();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (idea: DiaryIdea) => patchJson(`${BASE}api/diary/ideas/${idea.id}`, { completed: !idea.completed }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`${BASE}api/diary/ideas/${id}`),
    onSuccess: invalidate,
  });

  const ideas = data?.ideas ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Nuova idea</h2>
            <p className="text-sm text-muted-foreground">Cattura intuizioni, esperimenti e obiettivi potenziali.</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length > 0) createMutation.mutate();
          }}
        >
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-24" placeholder="Una cosa che potrei provare..." />
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
            <div className="flex flex-wrap gap-2">
              {IMPORTANCE_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setImportance(item.value)}
                  className={cn(
                    "min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors",
                    importance === item.value ? item.className : "border-border text-muted-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Button type="submit" disabled={createMutation.isPending || content.trim().length === 0}>
              <Plus className="h-4 w-4" />
              Aggiungi
            </Button>
          </div>
          <div className="grid grid-cols-9 gap-2 sm:w-max">
            {EMOJI_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEmoji(item)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border text-base",
                  emoji === item ? "border-primary bg-primary/10" : "border-border bg-background",
                )}
                aria-label={`Emoji ${item}`}
              >
                {item}
              </button>
            ))}
          </div>
        </form>
      </section>

      {isLoading && <Skeleton className="h-36 rounded-lg" />}

      {!isLoading && ideas.length === 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Nessuna idea salvata</h3>
          <p className="mt-1 text-sm text-muted-foreground">Aggiungi una scintilla e lasciala maturare.</p>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {ideas.map((idea) => {
          const importanceMeta = IMPORTANCE_OPTIONS.find((item) => item.value === idea.importance) ?? DEFAULT_IMPORTANCE_META;
          return (
            <article key={idea.id} className={cn("rounded-lg border bg-card p-5", idea.completed && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-lg">{idea.emoji}</span>
                  <div className="min-w-0">
                    <p className={cn("whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground", idea.completed && "line-through")}>
                      {idea.content}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-1 text-[11px] font-semibold", importanceMeta.className)}>
                        {importanceMeta.label}
                      </span>
                      {idea.dueDate && (
                        <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {daysUntil(idea.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate(idea)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
                  aria-label={idea.completed ? "Riapri idea" : "Completa idea"}
                >
                  {idea.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <WendyAskButton kind="idea" content={idea.content} journeyType={user?.journeyType} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Eliminare questa idea?")) deleteMutation.mutate(idea.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
