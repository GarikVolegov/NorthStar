/**
 * admin-rag.tsx — pannello admin per gestione RAG e segnali deboli.
 *
 * Richiede utente loggato con role='admin'.
 * Mostra fonti RAG, chunk, segnali deboli e permette di triggerare ingestione.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  Database, RefreshCw, CheckCircle, XCircle, Clock,
  TrendingUp, FileText, Rss, Plus, ChevronDown, ChevronUp,
  AlertTriangle, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RagSourceStats {
  id:               number;
  name:             string;
  source_type:      string;
  trust_score:      number;
  last_ingested_at: string | null;
  chunk_count:      number;
}

interface WeakSignal {
  id:          number;
  signalType:  string;
  title:       string;
  description: string;
  strength:    number;
  status:      string;
  geographies: string[];
  firstSeenAt: string;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchSourceStats(): Promise<{ sources: RagSourceStats[] }> {
  const res = await apiFetch("/api/admin/rag-sources/stats");
  if (!res.ok) throw new Error("Errore nel recupero delle fonti");
  return res.json();
}

async function fetchWeakSignals(status: string): Promise<{ signals: WeakSignal[] }> {
  const res = await apiFetch(`/api/admin/weak-signals?status=${status}&limit=30`);
  if (!res.ok) throw new Error("Errore nel recupero dei segnali");
  return res.json();
}

// ── Source type badge ─────────────────────────────────────────────────────────

function SourceTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    report:  { label: "Report", color: "bg-blue-100 text-blue-700 border-blue-200" },
    news:    { label: "News",   color: "bg-green-100 text-green-700 border-green-200" },
    job_agg: { label: "Job",    color: "bg-amber-100 text-amber-700 border-amber-200" },
    community:{ label: "Community", color: "bg-purple-100 text-purple-700 border-purple-200" },
  };
  const m = map[type] ?? { label: type, color: "bg-muted text-muted-foreground" };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", m.color)}>{m.label}</span>;
}

// ── Signal status badge ───────────────────────────────────────────────────────

function SignalStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    emerging:  "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-green-100 text-green-700 border-green-200",
    mainstream:"bg-blue-100 text-blue-700 border-blue-200",
    faded:     "bg-gray-100 text-gray-500 border-gray-200",
  };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[status] ?? "bg-muted")}>{status}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminRag() {
  const { user, authReady } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [signalFilter, setSignalFilter] = useState<"emerging" | "confirmed" | "all">("emerging");
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "", sourceType: "news", format: "rss", trustScore: "0.70", geography: "IT" });

  // Redirect se non admin
  useEffect(() => {
    if (authReady && (!user || user.role !== "admin")) navigate("/");
  }, [user, authReady, navigate]);

  const { data: sourcesData, isLoading: sourcesLoading, refetch: refetchSources } =
    useQuery({ queryKey: ["admin-rag-sources"], queryFn: fetchSourceStats });

  const { data: signalsData, isLoading: signalsLoading } =
    useQuery({ queryKey: ["admin-weak-signals", signalFilter], queryFn: () => fetchWeakSignals(signalFilter) });

  // RSS ingest mutation
  const ingestRss = useMutation({
    mutationFn: async (sourceId: number) => {
      const res = await apiFetch(`/api/admin/rag-sources/${sourceId}/ingest-rss`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ maxAgeDays: 30, maxItems: 20 }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rag-sources"] });
      refetchSources();
    },
  });

  // Approve/dismiss signal mutations
  const approveSignal = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/weak-signals/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-weak-signals"] }),
  });

  const dismissSignal = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/admin/weak-signals/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-weak-signals"] }),
  });

  // Add source mutation
  const addSource = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/admin/rag-sources", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:       newSource.name,
          url:        newSource.url || undefined,
          sourceType: newSource.sourceType,
          format:     newSource.format,
          trustScore: parseFloat(newSource.trustScore),
          geography:  [newSource.geography],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rag-sources"] });
      setShowAddSource(false);
      setNewSource({ name: "", url: "", sourceType: "news", format: "rss", trustScore: "0.70", geography: "IT" });
    },
  });

  if (!authReady || !user || user.role !== "admin") return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">RAG & Intelligence Admin</h1>
            <p className="text-sm text-muted-foreground">Gestione knowledge base, ingestione fonti e segnali deboli</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchSources()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Aggiorna
        </Button>
      </div>

      {/* ── RAG Sources ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Fonti RAG ({sourcesData?.sources.length ?? 0})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddSource(!showAddSource)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Aggiungi fonte
            {showAddSource ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Form aggiungi fonte */}
        {showAddSource && (
          <div className="rounded-xl border border-dashed p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Nome fonte" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} />
              <Input placeholder="URL (opzionale)" value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} />
              <select className="rounded-md border text-sm px-3 py-2 bg-background" value={newSource.sourceType} onChange={(e) => setNewSource({ ...newSource, sourceType: e.target.value })}>
                <option value="report">Report</option>
                <option value="news">News</option>
                <option value="job_agg">Job aggregati</option>
                <option value="community">Community</option>
              </select>
              <select className="rounded-md border text-sm px-3 py-2 bg-background" value={newSource.format} onChange={(e) => setNewSource({ ...newSource, format: e.target.value })}>
                <option value="rss">RSS</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
                <option value="html">HTML</option>
              </select>
              <Input placeholder="Trust score (0.0–1.0)" value={newSource.trustScore} onChange={(e) => setNewSource({ ...newSource, trustScore: e.target.value })} />
              <Input placeholder="Geography (IT, EU, US...)" value={newSource.geography} onChange={(e) => setNewSource({ ...newSource, geography: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addSource.mutate()} disabled={!newSource.name || addSource.isPending}>
                {addSource.isPending ? "Salvataggio..." : "Salva fonte"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddSource(false)}>Annulla</Button>
            </div>
            {addSource.isError && <p className="text-xs text-destructive">{String(addSource.error)}</p>}
          </div>
        )}

        {/* Lista fonti */}
        <div className="space-y-2">
          {sourcesLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {sourcesData?.sources.map((src) => (
            <div key={src.id} className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{src.name}</span>
                  <SourceTypeBadge type={src.source_type} />
                  <span className="text-xs text-muted-foreground">trust {src.trust_score.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {src.chunk_count} chunk
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {src.last_ingested_at ? new Date(src.last_ingested_at).toLocaleDateString("it-IT") : "Mai ingestito"}
                  </span>
                </div>
              </div>
              {src.source_type === "news" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs shrink-0"
                  onClick={() => ingestRss.mutate(src.id)}
                  disabled={ingestRss.isPending}
                >
                  <Rss className="h-3.5 w-3.5" />
                  {ingestRss.isPending ? "..." : "Ingesta RSS"}
                </Button>
              )}
            </div>
          ))}
          {sourcesData?.sources.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              Nessuna fonte RAG. Aggiungi la prima fonte e poi esegui il seed:rag script.
            </div>
          )}
        </div>
      </section>

      {/* ── Segnali Deboli ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-500" />
            Segnali deboli
          </h2>
          <div className="flex gap-1.5">
            {(["emerging", "confirmed", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSignalFilter(s)}
                className={cn(
                  "text-xs px-3 py-1 rounded-full border transition-colors",
                  signalFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {signalsLoading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
          {signalsData?.signals.map((signal) => (
            <div key={signal.id} className="flex items-start gap-3 rounded-xl border p-3 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{signal.title}</span>
                  <SignalStatusBadge status={signal.status} />
                  <span className="text-xs text-muted-foreground">strength {signal.strength.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{signal.geographies.join(", ")}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{signal.description}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {signal.status === "emerging" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => approveSignal.mutate(signal.id)}
                    disabled={approveSignal.isPending}
                  >
                    <CheckCircle className="h-3 w-3" />
                    Conferma
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                  onClick={() => dismissSignal.mutate(signal.id)}
                  disabled={dismissSignal.isPending}
                >
                  <XCircle className="h-3 w-3" />
                  Ignora
                </Button>
              </div>
            </div>
          ))}
          {signalsData?.signals.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nessun segnale trovato. Esegui prima:
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block w-fit mx-auto">
                pnpm --filter @workspace/scripts run seed:rag
              </code>
              <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block w-fit mx-auto">
                pnpm --filter @workspace/scripts run rag:weak-signals
              </code>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
