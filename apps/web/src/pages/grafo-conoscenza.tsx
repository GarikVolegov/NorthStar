import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { KnowledgeChatPanel as ChatPanel } from "@/features/knowledge-graph/KnowledgeChatPanel";
import { KnowledgeGraphCanvas } from "@/features/knowledge-graph/KnowledgeGraphCanvas";
import { KnowledgeGraphEdgeLabelEditor } from "@/features/knowledge-graph/KnowledgeGraphEdgeLabelEditor";
import { KnowledgeGraphMobileList } from "@/features/knowledge-graph/KnowledgeGraphMobileList";
import { KnowledgeGraphOverlays } from "@/features/knowledge-graph/KnowledgeGraphOverlays";
import { KnowledgeGraphToolbar } from "@/features/knowledge-graph/KnowledgeGraphToolbar";
import { KnowledgeNodeEditor as NodeEditor } from "@/features/knowledge-graph/KnowledgeNodeEditor";
import { useKnowledgeGraphData } from "@/features/knowledge-graph/useKnowledgeGraphData";
import { useKnowledgeGraphInteraction } from "@/features/knowledge-graph/useKnowledgeGraphInteraction";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

export default function Archivio() {
  const { user, authReady } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onSaveRef = useRef<(() => void) | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [fitAnimating, setFitAnimating] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const graph = useKnowledgeGraphData({
    toast,
    svgRef,
    viewRef,
    setView,
    setFitAnimating,
  });

  const interaction = useKnowledgeGraphInteraction({
    svgRef,
    viewRef,
    setView,
    selectedId: graph.selectedId,
    setSelectedId: graph.setSelectedId,
    linkMode: graph.linkMode,
    setLinkMode: graph.setLinkMode,
    chatOpen: graph.chatOpen,
    setChatOpen: graph.setChatOpen,
    contextMenu: graph.contextMenu,
    setContextMenu: graph.setContextMenu,
    edgeLabelEdit: graph.edgeLabelEdit,
    setEdgeLabelEdit: graph.setEdgeLabelEdit,
    setPendingEdge: graph.setPendingEdge,
    setEdgeLabelDraft: graph.setEdgeLabelDraft,
    setData: graph.setData,
    queuePosition: graph.queuePosition,
    handleDeleteNode: graph.handleDeleteNode,
    onSaveRef,
  });

  const ctxNode = graph.contextMenu
    ? (graph.data.nodes.find((node) => node.id === graph.contextMenu?.nodeId) ?? null)
    : null;

  const setViewAndRef = (next: { x: number; y: number; k: number }) => {
    viewRef.current = next;
    setView(next);
  };

  if (!authReady || (user && graph.loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
          Lib
        </div>
        <h2 className="mb-3 text-2xl font-bold font-serif">Accesso richiesto</h2>
        <p className="mb-8 text-muted-foreground">
          Registrati per costruire il tuo Archivio personale.
        </p>
        <Button asChild>
          <Link href="/registra">Registrati gratis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void graph.handleFileImport(file);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {graph.edgeLabelEdit && (
        <KnowledgeGraphEdgeLabelEditor
          edgeLabelEdit={graph.edgeLabelEdit}
          onChange={graph.setEdgeLabelEdit}
          onSave={graph.handleUpdateEdgeLabel}
        />
      )}

      <KnowledgeGraphToolbar
        search={graph.search}
        onSearchChange={graph.setSearch}
        typeFilter={graph.typeFilter}
        onTypeFilterChange={graph.setTypeFilter}
        chatOpen={graph.chatOpen}
        onToggleChat={() => {
          graph.setChatOpen(!graph.chatOpen);
          if (!graph.chatOpen) graph.setSelectedId(null);
        }}
        autoLinkingAll={graph.autoLinkingAll}
        nodesCount={graph.data.nodes.length}
        importing={graph.importing}
        onAutoLinkAll={graph.handleAutoLinkAll}
        onAddNode={graph.handleAddNode}
        onImportClick={() => fileInputRef.current?.click()}
      />

      <KnowledgeGraphOverlays
        linkMode={graph.linkMode}
        onCancelLinkMode={() => graph.setLinkMode(null)}
        nodes={graph.data.nodes}
        autoLinkSuggestions={graph.autoLinkSuggestions}
        autoLinkSourceId={graph.autoLinkSourceId}
        onCreateEdge={graph.handleCreateEdge}
        onSetAutoLinkSuggestions={graph.setAutoLinkSuggestions}
        onSetAutoLinkSourceId={graph.setAutoLinkSourceId}
        pendingEdge={graph.pendingEdge}
        edgeLabelDraft={graph.edgeLabelDraft}
        onSetPendingEdge={graph.setPendingEdge}
        onSetEdgeLabelDraft={graph.setEdgeLabelDraft}
        contextMenu={graph.contextMenu}
        ctxNode={ctxNode}
        onSelectNode={graph.setSelectedId}
        onSetContextMenu={graph.setContextMenu}
        onStartLink={(nodeId) => graph.setLinkMode({ sourceId: nodeId })}
        onDuplicateNode={graph.handleDuplicateNode}
        onDeleteNode={graph.handleDeleteNode}
      />

      <div className="flex flex-1 overflow-hidden">
        {isMobile ? (
          <KnowledgeGraphMobileList
            data={graph.data}
            filteredNodes={graph.filteredNodes}
            loadError={graph.loadError}
            onAddNode={graph.handleAddNode}
            onImport={() => fileInputRef.current?.click()}
            onRetryLoad={graph.loadGraph}
            onSelectNode={graph.setSelectedId}
          />
        ) : (
          <KnowledgeGraphCanvas
            svgRef={svgRef}
            data={graph.data}
            filteredNodes={graph.filteredNodes}
            visibleEdges={graph.visibleEdges}
            loadError={graph.loadError}
            selectedId={graph.selectedId}
            linkMode={graph.linkMode}
            view={view}
            fitAnimating={fitAnimating}
            onAddNode={graph.handleAddNode}
            onImport={() => fileInputRef.current?.click()}
            onRetryLoad={graph.loadGraph}
            onMinimapPan={(x, y) => setViewAndRef({ x, y, k: viewRef.current.k })}
            onFit={graph.handleFit}
            onZoomIn={() => setViewAndRef({ ...viewRef.current, k: Math.min(2.5, viewRef.current.k * 1.2) })}
            onZoomOut={() => setViewAndRef({ ...viewRef.current, k: Math.max(0.3, viewRef.current.k / 1.2) })}
            onResetView={() => setViewAndRef({ x: 0, y: 0, k: 1 })}
            {...interaction}
          />
        )}

        {graph.selected && !graph.chatOpen && (
          <NodeEditor
            key={graph.selected.id}
            node={graph.selected}
            edges={graph.data.edges.filter(
              (edge) => edge.sourceId === graph.selected?.id || edge.targetId === graph.selected?.id,
            )}
            allNodes={graph.data.nodes}
            onClose={() => graph.setSelectedId(null)}
            onSave={(patch) => graph.handleUpdateNode(graph.selected!.id, patch)}
            onDelete={() => graph.handleDeleteNode(graph.selected!.id)}
            onStartLink={() => graph.setLinkMode({ sourceId: graph.selected!.id })}
            onDeleteEdge={graph.handleDeleteEdge}
            onSaveRef={onSaveRef}
          />
        )}

        {graph.chatOpen && (
          <ChatPanel
            nodes={graph.data.nodes}
            onClose={() => graph.setChatOpen(false)}
            onFocusNode={(id) => {
              graph.setChatOpen(false);
              graph.setSelectedId(id);
            }}
          />
        )}
      </div>
    </div>
  );
}
