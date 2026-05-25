import {
  ConfidenceBadge,
  EntityBadge,
  StatusBadge,
  fmtDate,
  fmtShortDate,
  formatValue,
  humanizeKey,
  payloadDiffs,
  payloadEntries,
} from "@/components/admin/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Archive,
  Bot,
  CheckCircle2,
  Eye,
  History,
  X,
  XCircle,
} from "lucide-react";
import type { SuggestionDetail } from "../adminReviewTypes";

type SuggestionDetailPanelProps = {
  detail: SuggestionDetail;
  detailLoading: boolean;
  showTechnicalData: boolean;
  showEditNotes: boolean;
  editNotes: string;
  onClose: () => void;
  onTechnicalDataToggle: (updater: (value: boolean) => boolean) => void;
  onShowEditNotesChange: (value: boolean) => void;
  onEditNotesChange: (value: string) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onArchive: (id: number) => void;
  onApply: (id: number) => void;
};

export function SuggestionDetailPanel({
  detail,
  detailLoading,
  showTechnicalData,
  showEditNotes,
  editNotes,
  onClose,
  onTechnicalDataToggle,
  onShowEditNotesChange,
  onEditNotesChange,
  onApprove,
  onReject,
  onArchive,
  onApply,
}: SuggestionDetailPanelProps) {
  return (
    <div className="w-full lg:w-1/2 overflow-y-auto border-l bg-card">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-10">
        <h3 className="font-semibold truncate flex-1">
          {detail.suggestion.entityName}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {detailLoading ? (
        <div className="p-8 text-center text-muted-foreground">
          Caricamento dettagli...
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={detail.suggestion.status} />
            <EntityBadge type={detail.suggestion.entityType} />
            {detail.suggestion.confidenceScore != null && (
              <span className="text-sm text-muted-foreground">
                Confidence:{" "}
                <ConfidenceBadge score={detail.suggestion.confidenceScore} />
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Creato: {fmtDate(detail.suggestion.createdAt)}</p>
            <p>Aggiornato: {fmtDate(detail.suggestion.updatedAt)}</p>
            {detail.suggestion.reviewedAt && (
              <p>
                Revisionato: {fmtDate(detail.suggestion.reviewedAt)} da{" "}
                {detail.suggestion.reviewedBy}
              </p>
            )}
          </div>

          <Separator />

          <div className="rounded-lg border bg-background p-4">
            <h4 className="text-sm font-semibold mb-3">Proposta</h4>
            {payloadEntries(detail.suggestion.payloadJson).length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {payloadEntries(detail.suggestion.payloadJson).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md bg-muted/40 p-3 min-w-0"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {humanizeKey(key)}
                      </p>
                      <p className="text-sm mt-1 break-words line-clamp-3">
                        {formatValue(value)}
                      </p>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun campo sintetico disponibile. Apri i dati tecnici per
                vedere il payload completo.
              </p>
            )}
          </div>

          {payloadDiffs(detail.suggestion.payloadJson).length > 0 && (
            <div className="rounded-lg border bg-background p-4">
              <h4 className="text-sm font-semibold mb-3">
                Cambiamenti proposti
              </h4>
              <div className="space-y-3">
                {payloadDiffs(detail.suggestion.payloadJson).map((diff) => (
                  <div key={diff.key} className="rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {humanizeKey(diff.key)}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-danger-surface p-2">
                        <p className="text-[10px] font-semibold uppercase text-danger">
                          Prima
                        </p>
                        <p className="text-xs text-danger break-words">
                          {formatValue(diff.before)}
                        </p>
                      </div>
                      <div className="rounded-md bg-success-surface p-2">
                        <p className="text-[10px] font-semibold uppercase text-success">
                          Dopo
                        </p>
                        <p className="text-xs text-success break-words">
                          {formatValue(diff.after)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.agentRun && (
            <div className="bg-muted/30 rounded-xl p-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" /> Agente:{" "}
                {detail.agentRun.agentName}
              </h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Stato: {detail.agentRun.status}</p>
                {detail.agentRun.durationMs && (
                  <p>Durata: {detail.agentRun.durationMs}ms</p>
                )}
                {detail.agentRun.inputSummary && (
                  <p>Input: {detail.agentRun.inputSummary}</p>
                )}
                {detail.agentRun.errorMessage && (
                  <p className="text-danger">
                    Errore: {detail.agentRun.errorMessage}
                  </p>
                )}
              </div>
            </div>
          )}

          {detail.suggestion.payloadJson && (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => onTechnicalDataToggle((value) => !value)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {showTechnicalData
                  ? "Nascondi dati tecnici"
                  : "Mostra dati tecnici"}
              </Button>
              {showTechnicalData && (
                <pre className="mt-3 bg-muted/50 rounded-xl p-4 text-xs overflow-x-auto max-h-80 whitespace-pre-wrap font-mono">
                  {JSON.stringify(detail.suggestion.payloadJson, null, 2)}
                </pre>
              )}
            </div>
          )}

          {detail.suggestion.notes && (
            <div className="bg-warning-surface rounded-xl p-4 border border-warning-muted">
              <h4 className="text-sm font-semibold text-warning mb-1">Note</h4>
              <p className="text-sm text-warning">{detail.suggestion.notes}</p>
            </div>
          )}

          <Separator />

          {detail.suggestion.status === "pending_review" && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Azioni</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-success text-primary-foreground hover:bg-success/90 flex-1"
                  onClick={() => onApprove(detail.suggestion.id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approva
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (showEditNotes) {
                      onReject(detail.suggestion.id);
                    } else {
                      onShowEditNotesChange(true);
                    }
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Rifiuta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onArchive(detail.suggestion.id)}
                >
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
              {showEditNotes && (
                <div className="space-y-2">
                  <Input
                    placeholder="Motivo del rifiuto (opzionale)..."
                    value={editNotes}
                    onChange={(e) => onEditNotesChange(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => onReject(detail.suggestion.id)}
                    >
                      Conferma Rifiuto
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onShowEditNotesChange(false);
                        onEditNotesChange("");
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {detail.suggestion.status === "approved" && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Azioni</h4>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-info text-primary-foreground hover:bg-info/90 flex-1"
                  onClick={() => onApply(detail.suggestion.id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Applica
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onArchive(detail.suggestion.id)}
                >
                  <Archive className="w-4 h-4 mr-1" /> Archivia
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                In questo step Applica chiude il workflow senza modificare i
                dati finali.
              </p>
            </div>
          )}

          {detail.suggestion.status === "applied" && (
            <div className="rounded-lg border border-info-muted bg-info-surface p-4 text-info">
              <p className="text-sm font-semibold">Suggerimento applicato</p>
              <p className="text-xs mt-1">
                Workflow completato. Nessuna modifica automatica ai cataloghi e
                stata eseguita in questo step.
              </p>
            </div>
          )}

          {(detail.suggestion.status === "rejected" ||
            detail.suggestion.status === "archived") && (
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-semibold">
                {detail.suggestion.status === "archived"
                  ? "Suggerimento archiviato"
                  : "Suggerimento rifiutato"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                La decisione resta nello storico audit della proposta.
              </p>
            </div>
          )}

          {detail.auditTrail && detail.auditTrail.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4" /> Audit decisioni
              </h4>
              <div className="space-y-2">
                {detail.auditTrail.slice(0, 5).map((event) => (
                  <div key={event.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">
                        {humanizeKey(
                          event.action.replace("admin_suggestion_", ""),
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground shrink-0">
                        {fmtShortDate(event.createdAt)}
                      </p>
                    </div>
                    {event.metadata?.notes != null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Note: {formatValue(event.metadata.notes)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
