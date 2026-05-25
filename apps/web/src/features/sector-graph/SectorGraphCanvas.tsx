import { Button } from "@/components/ui/button";
import type { GraphEdge, GraphNode } from "@/pages/grafo-types";
import type { TFunction } from "i18next";
import { Loader2, RefreshCw } from "lucide-react";
import type { RefObject } from "react";
import { GRAPH_CENTER, NODE_CONFIG } from "./sectorGraphConfig";

interface SectorGraphCanvasProps {
  sector?: { name?: string | null; icon?: string | null } | null | undefined;
  positioned: GraphNode[];
  allEdges: GraphEdge[];
  nodeMap: Map<string, GraphNode>;
  hoveredNode: GraphNode | null;
  isLoading: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  onHoverNode: (node: GraphNode | null) => void;
  onGenerate: () => void;
  isConnected: (nodeId: string) => boolean;
  t: TFunction;
}

export function SectorGraphCanvas({
  sector,
  positioned,
  allEdges,
  nodeMap,
  hoveredNode,
  isLoading,
  svgRef,
  onHoverNode,
  onGenerate,
  isConnected,
  t,
}: SectorGraphCanvasProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-24">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary/30" />
        <p className="text-sm text-muted-foreground">{t("grafo.building")}</p>
        <p className="mt-1 text-xs text-muted-foreground/50">{t("grafo.buildingHint")}</p>
      </div>
    );
  }

  if (positioned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border bg-card py-24">
        <div className="mb-4 text-4xl">🕸️</div>
        <p className="mb-4 text-sm text-muted-foreground">{t("grafo.notAvailable")}</p>
        <Button onClick={onGenerate} variant="outline" className="rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("grafo.generateGraph")}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 800"
          className="w-full"
          style={{ maxHeight: "70vh" }}
          onMouseLeave={() => onHoverNode(null)}
        >
          {allEdges.map((edge, index) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const active = hoveredNode ? edge.from === hoveredNode.id || edge.to === hoveredNode.id : false;
            return (
              <line
                key={index}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? "hsl(var(--chart-4))" : edge.userAdded ? "hsl(var(--muted-foreground))" : "hsl(var(--border))"}
                strokeWidth={active ? 1.5 : 1}
                strokeDasharray={active ? undefined : edge.userAdded ? "6 4" : "4 3"}
                opacity={hoveredNode && !active ? 0.15 : 1}
                className="transition-all duration-200"
              />
            );
          })}

          <circle cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r={50} fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth={1.5} />
          <text x={GRAPH_CENTER.x} y={GRAPH_CENTER.y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(var(--muted-foreground))" className="select-none">
            {sector?.icon ?? "🏢"}
          </text>
          <text x={GRAPH_CENTER.x} y={GRAPH_CENTER.y + 10} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" className="select-none">
            {(sector?.name ?? "").split(" ").slice(0, 2).join(" ")}
          </text>

          {positioned.map((node) => {
            const cfg = NODE_CONFIG[node.type] ?? NODE_CONFIG.skill;
            const active = isConnected(node.id);
            const radius = node.type === "role" ? 26 : node.type === "skill" ? 22 : 20;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                className="cursor-pointer"
                onMouseEnter={() => onHoverNode(node)}
              >
                <circle
                  r={radius}
                  fill={active ? cfg.bg : "hsl(var(--background))"}
                  stroke={active ? cfg.border : "hsl(var(--border))"}
                  strokeWidth={hoveredNode?.id === node.id ? 2.5 : 1.5}
                  strokeDasharray={node.userAdded ? "4 2" : undefined}
                  className="transition-all duration-200"
                  opacity={hoveredNode && !active ? 0.4 : 1}
                />
                <text textAnchor="middle" dy="0.35em" fontSize={node.type === "role" ? "14" : "12"} className="select-none" opacity={hoveredNode && !active ? 0.4 : 1}>
                  {cfg.emoji}
                </text>
                {node.userAdded && <circle cx={radius - 5} cy={-(radius - 5)} r={5} fill="hsl(var(--chart-4))" opacity={hoveredNode && !active ? 0.4 : 1} />}
                <text y={radius + 12} textAnchor="middle" fontSize="9" fontWeight={hoveredNode?.id === node.id ? "600" : "400"} fill={active ? cfg.color : "hsl(var(--muted-foreground))"} className="select-none" opacity={hoveredNode && !active ? 0.4 : 1}>
                  {node.label.length > 14 ? `${node.label.slice(0, 13)}...` : node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredNode && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 animate-in rounded-xl border bg-popover p-4 shadow-lg fade-in duration-150 md:bottom-6 md:left-auto md:right-auto md:max-w-xs">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-base">{NODE_CONFIG[hoveredNode.type]?.emoji}</span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: NODE_CONFIG[hoveredNode.type]?.color }}>
              {t(`grafo.nodeTypes.${hoveredNode.type}`)}
            </span>
            {hoveredNode.userAdded && (
              <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {t("grafo.yourNode")}
              </span>
            )}
          </div>
          <p className="mb-1 text-sm font-semibold">{hoveredNode.label}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{hoveredNode.description}</p>
          {allEdges.filter((edge) => edge.from === hoveredNode.id || edge.to === hoveredNode.id).length > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground/50">
              {t("grafo.connections", {
                count: allEdges.filter((edge) => edge.from === hoveredNode.id || edge.to === hoveredNode.id).length,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
