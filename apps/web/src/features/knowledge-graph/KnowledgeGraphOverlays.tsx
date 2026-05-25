import { TYPE_META } from "@/components/knowledge-graph/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, FileText, Link2, Trash2, Wand2, X } from "lucide-react";
import type {
  AutoLinkSuggestion,
  ContextMenu,
  KNode,
} from "./knowledgeGraphTypes";

interface PendingEdge {
  sourceId: number;
  targetId: number;
}

interface KnowledgeGraphOverlaysProps {
  linkMode: { sourceId: number } | null;
  onCancelLinkMode: () => void;
  nodes: KNode[];
  autoLinkSuggestions: AutoLinkSuggestion[];
  autoLinkSourceId: number | null;
  onCreateEdge: (
    sourceId: number,
    targetId: number,
    label?: string,
  ) => Promise<void> | void;
  onSetAutoLinkSuggestions: (
    updater: (prev: AutoLinkSuggestion[]) => AutoLinkSuggestion[],
  ) => void;
  onSetAutoLinkSourceId: (id: number | null) => void;
  pendingEdge: PendingEdge | null;
  edgeLabelDraft: string;
  onSetPendingEdge: (edge: PendingEdge | null) => void;
  onSetEdgeLabelDraft: (value: string) => void;
  contextMenu: ContextMenu | null;
  ctxNode: KNode | null;
  onSelectNode: (id: number | null) => void;
  onSetContextMenu: (menu: ContextMenu | null) => void;
  onStartLink: (nodeId: number) => void;
  onDuplicateNode: (id: number) => Promise<void> | void;
  onDeleteNode: (id: number) => Promise<void> | void;
}

export function KnowledgeGraphOverlays({
  linkMode,
  onCancelLinkMode,
  nodes,
  autoLinkSuggestions,
  autoLinkSourceId,
  onCreateEdge,
  onSetAutoLinkSuggestions,
  onSetAutoLinkSourceId,
  pendingEdge,
  edgeLabelDraft,
  onSetPendingEdge,
  onSetEdgeLabelDraft,
  contextMenu,
  ctxNode,
  onSelectNode,
  onSetContextMenu,
  onStartLink,
  onDuplicateNode,
  onDeleteNode,
}: KnowledgeGraphOverlaysProps) {
  return (
    <>
      {linkMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <span>
            <Link2 className="w-3.5 h-3.5 inline mr-1" />
            Modalita collegamento: clicca un altro elemento per collegarlo a "
            {nodes.find((n) => n.id === linkMode.sourceId)?.title}"
            <span className="ml-2 opacity-60">(Esc per annullare)</span>
          </span>
          <button
            onClick={onCancelLinkMode}
            className="text-amber-900 hover:opacity-70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {autoLinkSuggestions.length > 0 && autoLinkSourceId !== null && (
        <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-3 flex-wrap">
          <Wand2 className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-xs font-medium text-violet-900">
            {autoLinkSuggestions.length} collegament
            {autoLinkSuggestions.length === 1 ? "o suggerito" : "i suggeriti"}{" "}
            automaticamente:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {autoLinkSuggestions.map((s) => {
              const meta = TYPE_META[s.type] ?? TYPE_META.note;
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      await onCreateEdge(autoLinkSourceId, s.id);
                      onSetAutoLinkSuggestions((prev) =>
                        prev.filter((x) => x.id !== s.id),
                      );
                      if (autoLinkSuggestions.length === 1)
                        onSetAutoLinkSourceId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: meta.bg,
                      color: meta.color,
                      borderColor: meta.border,
                    }}
                    title={`Affinita ${Math.round(s.score * 100)}%`}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {s.title}
                    <span className="opacity-60">
                      {Math.round(s.score * 100)}%
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      onSetAutoLinkSuggestions((prev) =>
                        prev.filter((x) => x.id !== s.id),
                      );
                      if (autoLinkSuggestions.length === 1)
                        onSetAutoLinkSourceId(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="ml-auto text-xs text-violet-600 hover:text-violet-900"
            onClick={() => {
              onSetAutoLinkSuggestions(() => []);
              onSetAutoLinkSourceId(null);
            }}
          >
            Ignora tutti
          </button>
        </div>
      )}

      {pendingEdge && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => onSetPendingEdge(null)}
        >
          <div
            className="bg-card rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Etichetta collegamento</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {nodes.find((n) => n.id === pendingEdge.sourceId)?.title} {"->"}{" "}
              {nodes.find((n) => n.id === pendingEdge.targetId)?.title}
            </p>
            <Input
              autoFocus
              placeholder="es. richiede, usa, simile a..."
              value={edgeLabelDraft}
              onChange={(e) => onSetEdgeLabelDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await onCreateEdge(
                    pendingEdge.sourceId,
                    pendingEdge.targetId,
                    edgeLabelDraft,
                  );
                  onSetPendingEdge(null);
                  onSetEdgeLabelDraft("");
                }
                if (e.key === "Escape") {
                  onSetPendingEdge(null);
                  onSetEdgeLabelDraft("");
                }
              }}
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSetPendingEdge(null)}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await onCreateEdge(
                    pendingEdge.sourceId,
                    pendingEdge.targetId,
                    edgeLabelDraft,
                  );
                  onSetPendingEdge(null);
                  onSetEdgeLabelDraft("");
                }}
              >
                Collega
              </Button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && ctxNode && (
        <div
          className="fixed z-60 bg-card border rounded-xl shadow-lg py-1 min-w-42.5 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b mb-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {TYPE_META[ctxNode.type]?.label}
            </p>
            <p className="font-semibold text-xs truncate max-w-37.5">
              {ctxNode.title}
            </p>
          </div>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-xs"
            onClick={() => {
              onSelectNode(contextMenu.nodeId);
              onSetContextMenu(null);
            }}
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Apri
            dettaglio
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-xs"
            onClick={() => {
              onStartLink(contextMenu.nodeId);
              onSetContextMenu(null);
              onSelectNode(null);
            }}
          >
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Collega...
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-xs"
            onClick={() => {
              void onDuplicateNode(contextMenu.nodeId);
              onSetContextMenu(null);
            }}
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Duplica
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 flex items-center gap-2 text-xs text-destructive"
            onClick={() => {
              void onDeleteNode(contextMenu.nodeId);
              onSetContextMenu(null);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Elimina
          </button>
        </div>
      )}
    </>
  );
}
