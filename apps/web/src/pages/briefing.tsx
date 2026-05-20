/**
 * briefing.tsx — pagina dei briefing di Wendy.
 *
 * Mostra la lista dei briefing ricevuti, con anteprima e opzione
 * di generare un briefing on-demand (1 ogni 6 ore per tutti i piani).
 */
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { API_ENDPOINTS, withParams } from "@/lib/constants";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Calendar, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

interface Briefing {
  id:        number;
  type:      string;
  period:    string;
  content:   string;
  readAt:    string | null;
  createdAt: string;
}

async function fetchBriefings(): Promise<{ briefings: Briefing[] }> {
  const res = await apiFetch(API_ENDPOINTS.briefings.list);
  if (!res.ok) return { briefings: [] };
  return res.json();
}

async function generateBriefing(): Promise<{ content: string; briefingId: number }> {
  const res = await apiFetch(API_ENDPOINTS.briefings.generate, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Generazione fallita");
  }
  return res.json();
}

async function markRead(id: number) {
  await apiFetch(withParams(API_ENDPOINTS.briefings.markRead, { id }), { method: "PATCH" });
}

const TYPE_LABELS: Record<string, string> = {
  weekly: "Briefing settimanale",
  daily:  "Briefing giornaliero",
  manual: "Briefing on-demand",
};

export default function BriefingPage() {
  usePageMeta({ title: "Briefing Wendy — NorthStar", description: "I tuoi briefing personalizzati di Wendy" });

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [genError, setGenError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["briefings"],
    queryFn:  fetchBriefings,
    enabled:  !!user,
  });

  const genMutation = useMutation({
    mutationFn: generateBriefing,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
      setGenError("");
    },
    onError: (e: Error) => setGenError(e.message),
  });

  const briefings = data?.briefings ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Briefing di Wendy</h1>
            <p className="text-sm text-muted-foreground">Aggiornamenti personalizzati dal mercato del lavoro</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => genMutation.mutate()}
          disabled={genMutation.isPending}
          className="gap-2"
        >
          {genMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Genera ora
        </Button>
      </div>

      {genError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {genError}
        </div>
      )}

      {/* Lista briefing */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : briefings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="font-semibold text-foreground">Nessun briefing ancora</p>
          <p className="text-sm text-muted-foreground">
            Genera il tuo primo briefing personalizzato — Wendy analizzerà il tuo profilo e i trend del mercato.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => {
            const isOpen   = expanded === b.id;
            const isUnread = !b.readAt;
            const date     = new Date(b.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long" });

            return (
              <div
                key={b.id}
                className={cn(
                  "rounded-xl border transition-all cursor-pointer",
                  isUnread ? "border-primary/30 bg-primary/5" : "border-border bg-card",
                  "hover:border-primary/20",
                )}
                onClick={async () => {
                  setExpanded(isOpen ? null : b.id);
                  if (isUnread && !isOpen) await markRead(b.id).catch(() => {});
                }}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isUnread ? "bg-primary" : "bg-transparent")} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{TYPE_LABELS[b.type] ?? b.type}</p>
                      {isUnread && (
                        <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">Nuovo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {date} · {b.period}
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {b.content.replace(/\*\*/g, "").slice(0, 120)}…
                      </p>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-border/50">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground text-sm leading-relaxed whitespace-pre-wrap mt-3">
                      {b.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
