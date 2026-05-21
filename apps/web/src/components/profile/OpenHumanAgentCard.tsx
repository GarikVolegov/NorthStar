import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError, getJson, postJson } from "@/lib/apiClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, ExternalLink, Loader2, Network, RefreshCw, Search, Send } from "lucide-react";
import { useState } from "react";

type OpenHumanState = "disabled" | "connected" | "unreachable" | "error";

interface OpenHumanStatus {
  enabled: boolean;
  state: OpenHumanState;
  configured: boolean;
  coreUrl: string | null;
  version?: string | null;
  message?: string;
  checkedAt: string;
}

interface OpenHumanMessageResponse {
  message: string;
  sources: Array<{
    id: string;
    title: string;
    content: string;
    source: "openhuman";
  }>;
}

interface OpenHumanSyncResponse {
  status: "started" | "running" | "completed" | "unavailable";
  message: string;
}

type GraphifyState = "disabled" | "ready" | "degraded" | "empty";

interface GraphifyStatus {
  enabled: boolean;
  state: GraphifyState;
  graphs: Array<{
    name: string;
    status: "ready" | "missing" | "error";
    nodes: number;
    links: number;
  }>;
  checkedAt: string;
}

interface GraphifyResult {
  id: string;
  graph: string;
  label: string;
  source: "graphify";
  sourceFile: string | null;
  sourceLocation: string | null;
  community: string | null;
  score: number;
  neighbors: Array<{ id: string; label: string; relation: string | null }>;
}

interface GraphifySearchResponse {
  results: GraphifyResult[];
}

function statusCopy(status: OpenHumanStatus | undefined) {
  if (!status) return { label: "Controllo", tone: "text-muted-foreground" };
  if (status.state === "connected") return { label: "Connesso", tone: "text-success" };
  if (status.state === "disabled") return { label: "Disabilitato", tone: "text-muted-foreground" };
  if (!status.configured) return { label: "Da configurare", tone: "text-warning" };
  return { label: "Non raggiungibile", tone: "text-danger" };
}

function errorMessage(err: unknown) {
  if (err instanceof ApiClientError) return err.message;
  return err instanceof Error ? err.message : "OpenHuman non disponibile";
}

function graphifyStatusCopy(status: GraphifyStatus | undefined) {
  if (!status) return { label: "Controllo Graphify", tone: "text-muted-foreground" };
  if (status.state === "ready") return { label: "Graphify pronto", tone: "text-success" };
  if (status.state === "disabled") return { label: "Graphify disabilitato", tone: "text-muted-foreground" };
  return { label: "Graphify degradato", tone: "text-warning" };
}

export function OpenHumanAgentCard() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [graphQuery, setGraphQuery] = useState("");
  const [graphResults, setGraphResults] = useState<GraphifyResult[]>([]);
  const isAdmin = user?.role === "admin";

  const status = useQuery<OpenHumanStatus>({
    queryKey: ["openhuman", "status"],
    queryFn: () => getJson<OpenHumanStatus>("/api/openhuman/status", { okStatuses: [503] }),
    staleTime: 30_000,
    retry: false,
  });

  const sync = useMutation({
    mutationFn: () => postJson<OpenHumanSyncResponse>("/api/openhuman/sync"),
    onSuccess: (data) => setReply(data.message),
  });

  const send = useMutation({
    mutationFn: (value: string) =>
      postJson<OpenHumanMessageResponse>("/api/openhuman/message", {
        message: value,
      }),
    onSuccess: (data) => {
      setReply(data.message);
      setMessage("");
    },
  });

  const graphify = useQuery<GraphifyStatus>({
    queryKey: ["graphify", "status"],
    queryFn: () => getJson<GraphifyStatus>("/api/graphify/status", { okStatuses: [503] }),
    enabled: isAdmin,
    staleTime: 60_000,
    retry: false,
  });

  const graphSearch = useMutation({
    mutationFn: (value: string) =>
      getJson<GraphifySearchResponse>(
        `/api/graphify/search?q=${encodeURIComponent(value)}`,
      ),
    onSuccess: (data) => setGraphResults(data.results),
  });

  const statusView = statusCopy(status.data);
  const graphifyView = graphifyStatusCopy(graphify.data);
  const canChat = status.data?.state === "connected";
  const pending = send.isPending || sync.isPending;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Brain className="h-4 w-4 text-primary" />
          Agente personale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <div>
            <p className={`text-sm font-semibold ${statusView.tone}`}>{statusView.label}</p>
            <p className="text-xs text-muted-foreground">
              {status.data?.message ?? "Memoria personale OpenHuman opzionale."}
            </p>
          </div>
          {status.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void status.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Verifica
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = "openhuman://";
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Apri OpenHuman
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canChat || pending}
            onClick={() => sync.mutate()}
          >
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizza
          </Button>
        </div>

        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = message.trim();
            if (value) send.mutate(value);
          }}
        >
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={!canChat || pending}
            className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary disabled:opacity-60"
            placeholder={canChat ? "Chiedi qualcosa alla tua memoria personale..." : "Configura e avvia OpenHuman per usare la memoria personale."}
          />
          <Button type="submit" size="sm" disabled={!canChat || pending || !message.trim()}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Invia
          </Button>
        </form>

        {(reply || send.error || sync.error) && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            {reply && <p className="text-foreground">{reply}</p>}
            {(send.error || sync.error) && (
              <p className="text-danger">{errorMessage(send.error ?? sync.error)}</p>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Network className="h-4 w-4 text-info" />
                  Grafo progetto
                </p>
                <p className={`text-xs font-medium ${graphifyView.tone}`}>
                  {graphifyView.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(graphify.data?.graphs ?? [])
                    .map((graph) => `${graph.name}: ${graph.nodes} nodi`)
                    .join(" · ") || "Graphify legge artifact locali, senza eseguire estrazioni a runtime."}
                </p>
              </div>
              {graphify.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = graphQuery.trim();
                if (value) graphSearch.mutate(value);
              }}
            >
              <input
                value={graphQuery}
                onChange={(event) => setGraphQuery(event.target.value)}
                className="min-h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                placeholder="Cerca nel knowledge graph del progetto"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!graphQuery.trim() || graphSearch.isPending}
              >
                {graphSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Cerca grafo
              </Button>
            </form>

            {graphSearch.error && (
              <p className="text-xs text-warning">
                {errorMessage(graphSearch.error)}
              </p>
            )}

            {graphResults.length > 0 && (
              <div className="space-y-2">
                {graphResults.slice(0, 4).map((result) => (
                  <div key={`${result.graph}:${result.id}`} className="rounded-lg border border-border bg-card px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{result.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.graph}
                      {result.community ? ` · community ${result.community}` : ""}
                      {result.sourceFile ? ` · ${result.sourceFile}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
