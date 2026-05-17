/**
 * memoria-wendy.tsx — pagina per visualizzare e gestire la memoria di Wendy.
 *
 * Mostra tutti i coach_memory_facts dell'utente.
 * L'utente può: aggiungere fatti manualmente, cancellare singoli fatti.
 *
 * GDPR: l'utente ha pieno controllo sulla propria memoria.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { Brain, Plus, Trash2, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageMeta } from "@/lib/seo";

interface MemoryFact {
  id:             number;
  key:            string;
  value:          string;
  source:         string;
  confirmedCount: number;
  createdAt:      string;
}

interface MemoryResponse { facts: MemoryFact[] }

// Mappa source → label leggibile
const SOURCE_LABELS: Record<string, string> = {
  onboarding:      "Onboarding",
  onboarding_text: "Nota personale",
  conversation:    "Conversazione",
  user_manual:     "Aggiunto da te",
  system:          "Sistema",
};

async function fetchMemory(): Promise<MemoryResponse> {
  const res = await apiFetch("/api/coach/memory");
  if (!res.ok) return { facts: [] };
  return res.json() as Promise<MemoryResponse>;
}

async function deleteFact(id: number): Promise<void> {
  await apiFetch(`/api/coach/memory/${id}`, { method: "DELETE" });
}

async function addFact(value: string): Promise<void> {
  await apiFetch("/api/coach/memory", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ key: "user_manual", value, source: "user_manual" }),
  });
}

export default function MemoriaWendy() {
  usePageMeta({
    title:       "Memoria di Wendy — NorthStar",
    description: "Visualizza e gestisci i fatti che Wendy ricorda di te.",
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [newFact, setNewFact]   = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery<MemoryResponse>({
    queryKey: ["coach-memory"],
    queryFn:  fetchMemory,
    enabled:  !!user,
  });

  const addMutation = useMutation({
    mutationFn: addFact,
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["coach-memory"] });
      setNewFact("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFact,
    onMutate:   (id) => setDeleting(id),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ["coach-memory"] });
      setDeleting(null);
    },
    onError: () => setDeleting(null),
  });

  const facts = data?.facts ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Memoria di Wendy</h1>
          <p className="text-sm text-muted-foreground">Cosa Wendy ricorda di te — puoi cancellare qualsiasi fatto</p>
        </div>
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Questi fatti vengono inclusi nel contesto di Wendy per personalizzare le risposte.
          <strong className="text-foreground"> Non vengono mai condivisi con altri utenti</strong> e non includono messaggi completi delle conversazioni.
          Puoi cancellare qualsiasi fatto in qualsiasi momento.
        </p>
      </div>

      {/* Add fact */}
      <div className="flex gap-2">
        <Input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value.slice(0, 200))}
          onKeyDown={(e) => { if (e.key === "Enter" && newFact.trim()) addMutation.mutate(newFact.trim()); }}
          placeholder="Aggiunge un fatto manuale (es. «lavoro nel settore finanziario»)…"
          className="text-sm"
        />
        <Button
          onClick={() => { if (newFact.trim()) addMutation.mutate(newFact.trim()); }}
          disabled={!newFact.trim() || addMutation.isPending}
          size="sm"
          className="gap-1.5 shrink-0"
        >
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Aggiungi
        </Button>
      </div>

      {/* Facts list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : facts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Wendy non ha ancora memorizzato nulla.</p>
          <p className="text-xs mt-1">La memoria si popola dopo le conversazioni e l'onboarding.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => (
            <div key={fact.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">{fact.value}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[fact.source] ?? fact.source}
                  </span>
                  {fact.confirmedCount > 1 && (
                    <span className="text-xs text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                      confermato {fact.confirmedCount}×
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(fact.id)}
                disabled={deleting === fact.id}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                aria-label="Cancella fatto"
              >
                {deleting === fact.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GDPR footer */}
      <p className="text-xs text-muted-foreground text-center pt-4">
        Per esportare o cancellare tutti i tuoi dati, vai su{" "}
        <a href="/profilo" className="text-primary hover:underline">Profilo → Privacy</a>.
      </p>
    </div>
  );
}
