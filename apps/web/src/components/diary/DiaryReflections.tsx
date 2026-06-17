import { WendyAskButton } from "@/components/diary/WendyEntryContext";
import type { DiaryEntry, DiaryMood } from "@/components/diary/diaryTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Save, Smile, Trash2 } from "lucide-react";
import { useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

const MOODS: Array<{ value: DiaryMood; label: string }> = [
  { value: "ottimo", label: "Ottimo" },
  { value: "bene", label: "Bene" },
  { value: "neutro", label: "Neutro" },
  { value: "difficile", label: "Difficile" },
  { value: "critico", label: "Critico" },
];

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DiaryReflections() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<DiaryMood | "">("");
  const [tagsText, setTagsText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTagsText, setEditTagsText] = useState("");

  const { data, isLoading } = useQuery<{ entries: DiaryEntry[] }>({
    queryKey: ["diary", "entries"],
    queryFn: () => getJson(`${BASE}api/diary/entries?limit=40`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["diary"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      postJson(`${BASE}api/diary/entries`, {
        content,
        mood: mood || null,
        tags: splitTags(tagsText),
      }),
    onSuccess: () => {
      setContent("");
      setMood("");
      setTagsText("");
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (entry: DiaryEntry) =>
      patchJson(`${BASE}api/diary/entries/${entry.id}`, {
        content: editContent,
        tags: splitTags(editTagsText),
      }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`${BASE}api/diary/entries/${id}`),
    onSuccess: invalidate,
  });

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Smile className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Nuova riflessione</h2>
            <p className="text-sm text-muted-foreground">Scrivi cosa stai notando, imparando o attraversando.</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (content.trim().length > 0) createMutation.mutate();
          }}
        >
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-28 resize-y"
            placeholder="Oggi mi sono accorto che..."
          />
          <div className="grid gap-3 lg:grid-cols-[1fr_280px_auto]">
            <div className="flex flex-wrap gap-2">
              {MOODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMood(item.value)}
                  className={cn(
                    "min-h-9 rounded-md border px-3 text-xs font-semibold text-muted-foreground transition-colors",
                    mood === item.value && "border-primary bg-primary/10 text-primary",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="tag separati da virgola"
            />
            <Button type="submit" disabled={createMutation.isPending || content.trim().length === 0}>
              <Save className="h-4 w-4" />
              Salva
            </Button>
          </div>
        </form>
      </section>

      {isLoading && <Skeleton className="h-40 rounded-lg" />}

      {!isLoading && entries.length === 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Il diario e pronto</h3>
          <p className="mt-1 text-sm text-muted-foreground">La prima nota sara il tuo punto di partenza.</p>
        </section>
      )}

      {entries.map((entry) => {
        const isEditing = editingId === entry.id;
        return (
          <article key={entry.id} className="rounded-lg border bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{formatDate(entry.createdAt)}</p>
                {entry.mood && (
                  <span className="mt-2 inline-flex rounded-full border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    Mood: {MOODS.find((item) => item.value === entry.mood)?.label ?? entry.mood}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <WendyAskButton kind="entry" content={entry.content} journeyType={user?.journeyType} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(entry.id);
                    setEditContent(entry.content);
                    setEditTagsText(entry.tags.join(", "));
                  }}
                >
                  <Edit3 className="h-4 w-4" />
                  Modifica
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Eliminare questa riflessione?")) deleteMutation.mutate(entry.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              </div>
            </div>

            {isEditing ? (
              <div className="mt-4 space-y-3">
                <Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} className="min-h-24" />
                <Input value={editTagsText} onChange={(event) => setEditTagsText(event.target.value)} />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => updateMutation.mutate(entry)}>
                    <Check className="h-4 w-4" />
                    Salva modifica
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                    Annulla
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{entry.content}</p>
                {entry.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
