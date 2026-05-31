import { TYPE_META } from "@/components/knowledge-graph/types";
import { KnowledgeEmptyState } from "./KnowledgeEmptyState";
import type { GraphData, KNode, NodeType } from "./knowledgeGraphTypes";

interface KnowledgeGraphMobileListProps {
  data: GraphData;
  filteredNodes: KNode[];
  loadError?: string | null;
  onAddNode: (type?: NodeType) => void;
  onImport: () => void;
  onRetryLoad?: () => void;
  onSelectNode: (id: number) => void;
}

export function KnowledgeGraphMobileList({
  data,
  filteredNodes,
  loadError,
  onAddNode,
  onImport,
  onRetryLoad,
  onSelectNode,
}: KnowledgeGraphMobileListProps) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      <div className="mb-2 flex items-start gap-3 rounded-xl border border-warning-muted bg-warning-surface px-4 py-3 text-sm text-warning">
        <span className="shrink-0 text-lg leading-none">Desktop</span>
        <p>Per l'esperienza completa con drag & drop, apri da desktop.</p>
      </div>
      {loadError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold text-destructive">Archivio non caricato</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          {onRetryLoad && (
            <button
              type="button"
              onClick={onRetryLoad}
              className="mt-3 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium"
            >
              Riprova
            </button>
          )}
        </div>
      ) : data.nodes.length === 0 ? (
        <KnowledgeEmptyState onAdd={onAddNode} onImport={onImport} />
      ) : (
        filteredNodes.map((node) => {
          const meta = TYPE_META[node.type];
          const Icon = meta.Icon;
          const connections = data.edges.filter(
            (edge) => edge.sourceId === node.id || edge.targetId === node.id,
          ).length;
          return (
            <button
              key={node.id}
              type="button"
              className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left"
              onClick={() => onSelectNode(node.id)}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: meta.bg }}
              >
                <Icon className="h-4 w-4" style={{ color: meta.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {node.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                  {node.content}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="block font-medium" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span>{connections} link</span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
