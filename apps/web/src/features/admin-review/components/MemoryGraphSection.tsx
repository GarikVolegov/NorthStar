import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, Network, Play, RefreshCw, XCircle } from "lucide-react";
import type { useMemoryGraph } from "../hooks/useMemoryGraph";

type MemoryGraphSectionProps = {
  memory: ReturnType<typeof useMemoryGraph>;
  fmtShortDate: (value: string) => string;
};

export function MemoryGraphSection({ memory, fmtShortDate }: MemoryGraphSectionProps) {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-serif font-bold flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            Cervello Wendy
          </h3>
          <p className="text-sm text-muted-foreground">
            Governance del memory graph: salute, relazioni candidate, backfill e provenance.
          </p>
          {memory.data?.generatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Snapshot: {fmtShortDate(memory.data.generatedAt)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={memory.load}
          disabled={memory.loading}
          className="min-h-11"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", memory.loading && "animate-spin")} />
          Aggiorna
        </Button>
      </div>

      {memory.loading && !memory.data ? (
        <div className="p-12 text-center text-muted-foreground">
          Caricamento cervello Wendy...
        </div>
      ) : !memory.data ? (
        <div className="p-12 text-center border rounded-xl bg-muted/20">
          <Network className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Memory graph non disponibile</p>
          <p className="text-sm text-muted-foreground mt-1">
            Controlla migration, DB e stato servizi in Status & Setup.
          </p>
          <Button className="mt-4 min-h-11" variant="outline" onClick={memory.load}>
            Riprova
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              ["Nodi", memory.data.health.nodes],
              ["Relazioni", memory.data.health.edges],
              ["Candidate", memory.data.health.candidates],
              ["Low confidence", memory.data.health.lowConfidenceEdges],
              ["Embedding mancanti", memory.data.health.staleEmbeddings],
              ["Nodi orfani", memory.data.health.orphanNodes],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border bg-card p-4">
                <p className="text-2xl font-bold">{String(value)}</p>
                <p className="text-xs text-muted-foreground">{String(label)}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-semibold">Relazioni da governare</h4>
                  <p className="text-xs text-muted-foreground">
                    Wendy e gli agenti propongono, l'admin approva o rifiuta.
                  </p>
                </div>
                <Badge variant="outline">{memory.data.candidateRelations.length}</Badge>
              </div>
              {memory.data.candidateRelations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nessuna relazione candidata. Il grafo non richiede decisioni ora.
                </p>
              ) : (
                <div className="space-y-2">
                  {memory.data.candidateRelations.map((relation) => (
                    <div key={relation.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {relation.source?.title ?? `Nodo ${relation.sourceId}`} → {relation.target?.title ?? `Nodo ${relation.targetId}`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {relation.label ?? relation.relationType} · confidence {Math.round(relation.confidence * 100)}%
                          </p>
                          {relation.reason && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {relation.reason}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">user {relation.userId}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          className="min-h-11"
                          disabled={memory.actionLoading === `approve:${relation.id}`}
                          onClick={() => void memory.reviewRelation(relation.id, "approve")}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Approva
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          disabled={memory.actionLoading === `reject:${relation.id}`}
                          onClick={() => void memory.reviewRelation(relation.id, "reject")}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Rifiuta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <h4 className="font-semibold mb-2">Backfill utente</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Crea/aggiorna nodi da idee, obiettivi, calendario, profilo e memoria Wendy.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={memory.backfillUserId}
                    onChange={(e) => memory.setBackfillUserId(e.target.value)}
                    placeholder="userId"
                    inputMode="numeric"
                    className="min-h-11"
                  />
                  <Button
                    className="min-h-11"
                    disabled={memory.actionLoading === "backfill"}
                    onClick={() => void memory.runBackfill()}
                  >
                    {memory.actionLoading === "backfill" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <h4 className="font-semibold mb-3">Fonti memoria</h4>
                {memory.data.sourceBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna fonte indicizzata.</p>
                ) : (
                  <div className="space-y-2">
                    {memory.data.sourceBreakdown.map((source) => (
                      <div key={source.sourceType} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">{source.sourceType}</span>
                        <Badge variant="outline">{source.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 text-amber-900">
                <h4 className="font-semibold mb-1">Regola di sicurezza</h4>
                <p className="text-xs">
                  Wendy puo proporre memoria e relazioni, ma modifiche globali e relazioni dubbie passano dalla governance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
