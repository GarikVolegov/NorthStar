/**
 * memoria-wendy.tsx — pagina per visualizzare e gestire la memoria di Wendy.
 *
 * Mostra tutti i coach_memory_facts dell'utente.
 * L'utente può: aggiungere fatti manualmente, cancellare singoli fatti.
 *
 * GDPR: l'utente ha pieno controllo sulla propria memoria.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { deleteJson, getJson, postJson } from "@/lib/apiClient";
import { API_ENDPOINTS, withParams } from "@/lib/constants";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { usePageMeta } from "@/lib/seo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Loader2, Plus, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface MemoryFact {
  id:             number;
  key:            string;
  value:          string;
  source:         string;
  confirmedCount: number;
  createdAt:      string;
}

interface MemoryResponse { facts: MemoryFact[] }
interface AddMemoryResponse { fact: MemoryFact }

// Mappa source → label leggibile
const SOURCE_LABELS: Record<string, { key: string; source: string }> = {
  onboarding:      { key: "wendy.memory.source.onboarding", source: "Onboarding" },
  onboarding_text: { key: "wendy.memory.source.onboardingText", source: "Nota personale" },
  conversation:    { key: "wendy.memory.source.conversation", source: "Conversazione" },
  user_manual:     { key: "wendy.memory.source.userManual", source: "Aggiunto da te" },
  system:          { key: "wendy.memory.source.system", source: "Sistema" },
};

async function fetchMemory(): Promise<MemoryResponse> {
  return getJson<MemoryResponse>(API_ENDPOINTS.coachMemory.list, { okStatuses: [404] })
    .catch(() => ({ facts: [] }));
}

async function deleteFact(id: number): Promise<void> {
  await deleteJson(withParams(API_ENDPOINTS.coachMemory.remove, { id }));
}

async function addFact(value: string): Promise<void> {
  await postJson<AddMemoryResponse>(API_ENDPOINTS.coachMemory.add, {
    key: "user_manual",
    value,
    source: "user_manual",
  });
}

function useWendyMemoryText(key: string, source: string, locale: string, context = "Wendy memory management page UI copy"): string {
  return useDynamicTranslation({ locale, key, source, context });
}

interface MemoryFactRowProps {
  fact: MemoryFact;
  deleting: number | null;
  locale: string;
  deleteLabel: string;
  onDelete: (id: number) => void;
}

function MemoryFactRow({ fact, deleting, locale, deleteLabel, onDelete }: MemoryFactRowProps) {
  const sourceCopy = SOURCE_LABELS[fact.source];
  const translatedSource = useDynamicTranslation({
    locale,
    source: sourceCopy?.source ?? "",
    context: "Wendy memory fact source label",
    ...(sourceCopy ? { key: sourceCopy.key } : {}),
  });
  const confirmedCountLabel = useDynamicTranslation({
    locale,
    key: "wendy.memory.confirmedCount",
    source: `confermato ${fact.confirmedCount}x`,
    context: "Wendy memory confirmation count label. Preserve the numeric count.",
  });

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground font-medium">{fact.value}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {sourceCopy ? translatedSource : fact.source}
          </span>
          {fact.confirmedCount > 1 && (
            <span className="text-xs text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
              {confirmedCountLabel}
            </span>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onDelete(fact.id)}
        disabled={deleting === fact.id}
        className="min-h-11 min-w-11 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/50"
        aria-label={deleteLabel}
      >
        {deleting === fact.id
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export default function MemoriaWendy() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "it";
  const pageTitle = useWendyMemoryText("wendy.memory.title", "Memoria di Wendy", locale);
  const pageDescription = useWendyMemoryText(
    "wendy.memory.subtitle",
    "Cosa Wendy ricorda di te - puoi cancellare qualsiasi fatto",
    locale,
  );
  const privacyNotePrefix = useWendyMemoryText(
    "wendy.memory.privacyNotePrefix",
    "Questi fatti vengono inclusi nel contesto di Wendy per personalizzare le risposte.",
    locale,
  );
  const privacyNoteStrong = useWendyMemoryText(
    "wendy.memory.privacyNoteStrong",
    "Non vengono mai condivisi con altri utenti",
    locale,
  );
  const privacyNoteSuffix = useWendyMemoryText(
    "wendy.memory.privacyNoteSuffix",
    "e non includono messaggi completi delle conversazioni. Puoi cancellare qualsiasi fatto in qualsiasi momento.",
    locale,
  );
  const addPlaceholder = useWendyMemoryText(
    "wendy.memory.addPlaceholder",
    "Aggiunge un fatto manuale (es. «lavoro nel settore finanziario»)...",
    locale,
  );
  const addButton = useWendyMemoryText("wendy.memory.addButton", "Aggiungi", locale);
  const addButtonLoading = useWendyMemoryText("wendy.memory.addButtonLoading", "Aggiungo", locale);
  const emptyTitle = useWendyMemoryText("wendy.memory.emptyTitle", "Wendy non ha ancora memorizzato nulla.", locale);
  const emptyDescription = useWendyMemoryText(
    "wendy.memory.emptyDescription",
    "La memoria si popola dopo le conversazioni e l'onboarding.",
    locale,
  );
  const deleteFactLabel = useWendyMemoryText("wendy.memory.deleteFact", "Cancella fatto", locale);
  const addError = useWendyMemoryText(
    "wendy.memory.addError",
    "Non sono riuscita ad aggiungere questo ricordo. Riprova tra poco.",
    locale,
  );
  const deleteError = useWendyMemoryText(
    "wendy.memory.deleteError",
    "Non sono riuscita a cancellare questo ricordo. Riprova tra poco.",
    locale,
  );
  const gdprPrefix = useWendyMemoryText(
    "wendy.memory.gdprPrefix",
    "Per esportare o cancellare tutti i tuoi dati, vai su",
    locale,
  );
  const gdprLink = useWendyMemoryText("wendy.memory.gdprLink", "Profilo -> Privacy", locale);
  const gdprSuffix = useWendyMemoryText("wendy.memory.gdprSuffix", ".", locale);

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
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDescription}</p>
        </div>
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span>{privacyNotePrefix}</span>
          <strong className="text-foreground"> {privacyNoteStrong}</strong>{" "}
          <span>{privacyNoteSuffix}</span>
        </p>
      </div>

      {/* Add fact */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newFact}
          onChange={(e) => setNewFact(e.target.value.slice(0, 200))}
          onKeyDown={(e) => { if (e.key === "Enter" && newFact.trim()) addMutation.mutate(newFact.trim()); }}
          placeholder={addPlaceholder}
          className="min-h-11 text-sm"
        />
        <Button
          onClick={() => { if (newFact.trim()) addMutation.mutate(newFact.trim()); }}
          disabled={!newFact.trim() || addMutation.isPending}
          size="sm"
          className="min-h-11 w-full gap-1.5 shrink-0 sm:w-auto"
        >
          {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {addMutation.isPending ? addButtonLoading : addButton}
        </Button>
      </div>
      {addMutation.isError && (
        <p role="alert" className="text-xs text-destructive">{addError}</p>
      )}
      {deleteMutation.isError && (
        <p role="alert" className="text-xs text-destructive">{deleteError}</p>
      )}

      {/* Facts list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : facts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">{emptyTitle}</p>
          <p className="text-xs mt-1">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => (
            <MemoryFactRow
              key={fact.id}
              fact={fact}
              deleting={deleting}
              locale={locale}
              deleteLabel={deleteFactLabel}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* GDPR footer */}
      <p className="text-xs text-muted-foreground text-center pt-4">
        <span>{gdprPrefix}</span>{" "}
        <a href="/profilo" className="text-primary hover:underline">{gdprLink}</a>
        <span>{gdprSuffix}</span>
      </p>
    </div>
  );
}
