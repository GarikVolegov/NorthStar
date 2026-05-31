import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Maximize2 } from "lucide-react";
import type React from "react";
import { KnowledgeEmptyState } from "./KnowledgeEmptyState";
import { KnowledgeGraphMinimap } from "./KnowledgeGraphMinimap";
import { KnowledgeGraphNode } from "./KnowledgeGraphNode";
import type { GraphData, KEdge, KNode, NodeType } from "./knowledgeGraphTypes";

interface KnowledgeGraphCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  data: GraphData;
  filteredNodes: KNode[];
  visibleEdges: KEdge[];
  loadError?: string | null;
  selectedId: number | null;
  linkMode: { sourceId: number } | null;
  view: { x: number; y: number; k: number };
  fitAnimating: boolean;
  onAddNode: (type?: NodeType) => void;
  onImport: () => void;
  onRetryLoad?: () => void;
  onNodePointerDown: (event: React.PointerEvent, node: KNode) => void;
  onNodePointerUp: (event: React.PointerEvent, node: KNode) => void;
  onNodeContextMenu: (event: React.MouseEvent, node: KNode) => void;
  onSvgPointerDown: (event: React.PointerEvent) => void;
  onSvgPointerMove: (event: React.PointerEvent) => void;
  onSvgPointerUp: () => void;
  onEdgeLabelClick: (event: React.MouseEvent, edge: KEdge, mx: number, my: number) => void;
  onMinimapPan: (x: number, y: number) => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function KnowledgeGraphCanvas({
  svgRef,
  data,
  filteredNodes,
  visibleEdges,
  loadError,
  selectedId,
  linkMode,
  view,
  fitAnimating,
  onAddNode,
  onImport,
  onRetryLoad,
  onNodePointerDown,
  onNodePointerUp,
  onNodeContextMenu,
  onSvgPointerDown,
  onSvgPointerMove,
  onSvgPointerUp,
  onEdgeLabelClick,
  onMinimapPan,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetView,
}: KnowledgeGraphCanvasProps) {
  return (
    <div className="relative flex-1 overflow-hidden bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-size-[24px_24px]">
      {loadError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <KnowledgeLoadError
            message={loadError}
            {...(onRetryLoad ? { onRetry: onRetryLoad } : {})}
          />
        </div>
      ) : data.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <KnowledgeEmptyState onAdd={onAddNode} onImport={onImport} />
        </div>
      ) : null}
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerLeave={onSvgPointerUp}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="hsl(var(--muted-foreground))" />
          </marker>
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(var(--foreground) / 0.08)" />
          </filter>
        </defs>
        <g
          transform={`translate(${view.x},${view.y}) scale(${view.k})`}
          style={
            fitAnimating
              ? { transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)" }
              : undefined
          }
        >
          {visibleEdges.map((edge) => (
            <KnowledgeGraphEdge
              key={edge.id}
              edge={edge}
              nodes={data.nodes}
              selectedId={selectedId}
              onEdgeLabelClick={onEdgeLabelClick}
            />
          ))}
          {filteredNodes.map((node) => (
            <KnowledgeGraphNode
              key={node.id}
              node={node}
              isSelected={selectedId === node.id}
              isLinkSrc={linkMode?.sourceId === node.id}
              isLinkMode={linkMode !== null}
              onPointerDown={onNodePointerDown}
              onPointerUp={onNodePointerUp}
              onContextMenu={onNodeContextMenu}
            />
          ))}
        </g>
      </svg>

      <KnowledgeGraphMinimap nodes={data.nodes} view={view} svgRef={svgRef} onPan={onMinimapPan} />
      <KnowledgeGraphZoomControls
        zoom={view.k}
        onFit={onFit}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetView={onResetView}
      />
      <KnowledgeGraphStats
        selectedId={selectedId}
        nodesCount={filteredNodes.length}
        edgesCount={visibleEdges.length}
      />
    </div>
  );
}

function KnowledgeLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
        !
      </div>
      <h2 className="mb-2 text-lg font-semibold">Archivio non caricato</h2>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border bg-card px-4 py-2 text-sm font-medium hover:border-primary/40"
        >
          Riprova
        </button>
      )}
    </div>
  );
}

function KnowledgeGraphEdge({
  edge,
  nodes,
  selectedId,
  onEdgeLabelClick,
}: {
  edge: KEdge;
  nodes: KNode[];
  selectedId: number | null;
  onEdgeLabelClick: (event: React.MouseEvent, edge: KEdge, mx: number, my: number) => void;
}) {
  const source = nodes.find((node) => node.id === edge.sourceId);
  const target = nodes.find((node) => node.id === edge.targetId);
  if (!source || !target) return null;
  const dimmed = selectedId != null && selectedId !== source.id && selectedId !== target.id;
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2;
  return (
    <g opacity={dimmed ? 0.15 : 0.9}>
      <line
        x1={source.x}
        y1={source.y}
        x2={target.x}
        y2={target.y}
        stroke="hsl(var(--muted-foreground))"
        strokeWidth={1.4}
        markerEnd="url(#arrow)"
        data-source={edge.sourceId}
        data-target={edge.targetId}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <g style={{ cursor: "text" }} onClick={(event) => onEdgeLabelClick(event, edge, mx, my)}>
            <rect
              x={mx - 30}
              y={my - 10}
              width={60}
              height={16}
              fill="transparent"
              data-edge-mid-source={edge.sourceId}
              data-edge-mid-target={edge.targetId}
            />
            <text
              x={mx}
              y={my - 4}
              textAnchor="middle"
              fontSize={edge.label ? 9 : 8}
              fill="hsl(var(--muted-foreground))"
              style={{ pointerEvents: "none" }}
              opacity={edge.label ? 1 : 0.4}
              data-edge-mid-source={edge.sourceId}
              data-edge-mid-target={edge.targetId}
              data-other-x={target.x}
              data-other-y={target.y}
            >
              {edge.label || "+"}
            </text>
          </g>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          {edge.label ? "Clicca per modificare" : "Clicca per aggiungere etichetta"}
        </TooltipContent>
      </Tooltip>
    </g>
  );
}

function KnowledgeGraphZoomControls({
  zoom,
  onFit,
  onZoomIn,
  onZoomOut,
  onResetView,
}: {
  zoom: number;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-center gap-0.5 rounded-xl border bg-card/90 p-1 shadow-sm backdrop-blur">
      <button type="button" onClick={onZoomIn} className="h-7 w-7 rounded-lg text-sm font-bold hover:bg-muted" title="Zoom in">+</button>
      <span className="w-7 text-center text-[9px] font-semibold leading-5 text-muted-foreground tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" onClick={onZoomOut} className="h-7 w-7 rounded-lg text-sm font-bold hover:bg-muted" title="Zoom out">-</button>
      <div className="my-0.5 h-px w-full bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" onClick={onFit} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted" title="Fit to screen">
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Adatta alla schermata</TooltipContent>
      </Tooltip>
      <button type="button" onClick={onResetView} className="h-7 w-7 rounded-lg text-[10px] font-semibold hover:bg-muted" title="Reset vista">0</button>
    </div>
  );
}

function KnowledgeGraphStats({
  selectedId,
  nodesCount,
  edgesCount,
}: {
  selectedId: number | null;
  nodesCount: number;
  edgesCount: number;
}) {
  return (
    <div className="absolute left-3 top-3 flex items-center gap-2">
      <Badge variant="outline" className="bg-card/80 text-[10px] backdrop-blur">{nodesCount} elementi</Badge>
      <Badge variant="outline" className="bg-card/80 text-[10px] backdrop-blur">{edgesCount} collegamenti</Badge>
      {selectedId !== null && (
        <Badge variant="outline" className="bg-card/80 text-[10px] text-muted-foreground backdrop-blur">
          Del = elimina - Esc = chiudi - Ctrl+S = salva
        </Badge>
      )}
    </div>
  );
}
