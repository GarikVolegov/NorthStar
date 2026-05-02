import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useGetSector } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
  x?: number;
  y?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_CONFIG = {
  role: { color: "#6366f1", bg: "#eef2ff", border: "#a5b4fc", label: "Ruolo", emoji: "👤" },
  skill: { color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", label: "Competenza", emoji: "⚡" },
  tool: { color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", label: "Strumento", emoji: "🔧" },
  certification: { color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd", label: "Certificazione", emoji: "🏅" },
};

const CX = 500;
const CY = 400;

function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const byType: Record<string, GraphNode[]> = {
    role: [],
    skill: [],
    tool: [],
    certification: [],
  };
  nodes.forEach((n) => {
    const t = n.type in byType ? n.type : "skill";
    byType[t].push(n);
  });

  const positioned: GraphNode[] = [];

  const place = (group: GraphNode[], radius: number, offsetAngle = 0) => {
    group.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / group.length + offsetAngle - Math.PI / 2;
      positioned.push({ ...n, x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) });
    });
  };

  place(byType.role, 140, 0);
  place(byType.skill, 255, Math.PI / byType.skill.length);

  // interleave tool and cert on outer ring
  const outer = [
    ...byType.tool.map((n) => ({ ...n, _outer: "tool" })),
    ...byType.certification.map((n) => ({ ...n, _outer: "cert" })),
  ];
  outer.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / outer.length - Math.PI / 2;
    positioned.push({ ...n, x: CX + 360 * Math.cos(angle), y: CY + 360 * Math.sin(angle) });
  });

  return positioned;
}

function getEdgePoints(
  from: GraphNode,
  to: GraphNode,
  nodeMap: Map<string, GraphNode>
) {
  const f = nodeMap.get(from.id ?? from.from ?? "");
  const t = nodeMap.get(to.id ?? to.to ?? "");
  if (!f || !t) return null;
  return { x1: f.x!, y1: f.y!, x2: t.x!, y2: t.y! };
}

export default function Grafo() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [positioned, setPositioned] = useState<GraphNode[]>([]);
  const [nodeMap, setNodeMap] = useState<Map<string, GraphNode>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number } | null>(null);

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const fetchGraph = useCallback(
    async (force = false) => {
      if (!id) return;
      setIsLoading(true);
      try {
        const url = `${BASE}api/grafo/${id}${force ? "?refresh=1" : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Error");
        const data: GraphData = await res.json();
        setGraph(data);
        const pos = layoutNodes(data.nodes);
        setPositioned(pos);
        const map = new Map<string, GraphNode>();
        pos.forEach((n) => map.set(n.id, n));
        setNodeMap(map);
      } catch {
        // silent
      }
      setIsLoading(false);
    },
    [id]
  );

  useEffect(() => {
    if (user && id) fetchGraph();
  }, [user, id, fetchGraph]);

  const isConnected = (nodeId: string) => {
    if (!hoveredNode) return true;
    if (nodeId === hoveredNode.id) return true;
    return graph?.edges.some(
      (e) => (e.from === hoveredNode.id && e.to === nodeId) || (e.to === hoveredNode.id && e.from === nodeId)
    ) ?? false;
  };

  if (sectorLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-lg text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-3xl">
          🕸️
        </div>
        <h2 className="text-2xl font-serif font-bold mb-3">Accesso richiesto</h2>
        <p className="text-muted-foreground mb-8">
          Registrati gratuitamente per esplorare il grafo della conoscenza.
        </p>
        <Button asChild>
          <Link href="/registra">Registrati gratis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" asChild>
          <Link href={`/settore/${id}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-2xl truncate">Grafo della Conoscenza</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0">
              <Sparkles className="w-2 h-2 mr-1" />Premium
            </Badge>
          </div>
          {sector && (
            <p className="text-sm text-muted-foreground">{sector.name}</p>
          )}
        </div>
        {graph && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl shrink-0"
            onClick={() => fetchGraph(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Rigenera
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
            <span>{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-6 h-px border-t border-dashed border-muted-foreground/40" />
          <span>Connessione</span>
        </div>
      </div>

      {/* Graph area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card border rounded-3xl">
          <Loader2 className="w-10 h-10 animate-spin text-primary/30 mb-4" />
          <p className="text-muted-foreground text-sm">L'AI sta costruendo il grafo…</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Potrebbe richiedere 20-30 secondi</p>
        </div>
      ) : graph && positioned.length > 0 ? (
        <div className="relative">
          <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
            <svg
              viewBox="0 0 1000 800"
              className="w-full"
              style={{ maxHeight: "70vh" }}
              onMouseLeave={() => {
                setHoveredNode(null);
                setHoveredPos(null);
              }}
            >
              {/* Edges */}
              {graph.edges.map((edge, i) => {
                const f = nodeMap.get(edge.from);
                const t = nodeMap.get(edge.to);
                if (!f || !t) return null;
                const active = hoveredNode
                  ? edge.from === hoveredNode.id || edge.to === hoveredNode.id
                  : false;
                return (
                  <line
                    key={i}
                    x1={f.x}
                    y1={f.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={active ? "#6366f1" : "#e2e8f0"}
                    strokeWidth={active ? 1.5 : 1}
                    strokeDasharray={active ? undefined : "4 3"}
                    opacity={hoveredNode && !active ? 0.2 : 1}
                    className="transition-all duration-200"
                  />
                );
              })}

              {/* Center label */}
              <circle cx={CX} cy={CY} r={50} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1.5} />
              <text
                x={CX}
                y={CY - 6}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#64748b"
                className="select-none"
              >
                {sector?.icon ?? "🏢"}
              </text>
              <text
                x={CX}
                y={CY + 10}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
                className="select-none"
              >
                {(sector?.name ?? "").split(" ").slice(0, 2).join(" ")}
              </text>

              {/* Nodes */}
              {positioned.map((node) => {
                const cfg = NODE_CONFIG[node.type] ?? NODE_CONFIG.skill;
                const active = isConnected(node.id);
                const r = node.type === "role" ? 26 : node.type === "skill" ? 22 : 20;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredNode(node);
                      const svg = e.currentTarget.closest("svg")!;
                      const rect = svg.getBoundingClientRect();
                      const scaleX = 1000 / rect.width;
                      const scaleY = 800 / (rect.height);
                      setHoveredPos({ x: node.x! / scaleX, y: node.y! / scaleY });
                    }}
                  >
                    <circle
                      r={r}
                      fill={active ? cfg.bg : "#f8fafc"}
                      stroke={active ? cfg.border : "#e2e8f0"}
                      strokeWidth={hoveredNode?.id === node.id ? 2.5 : 1.5}
                      className="transition-all duration-200"
                      opacity={hoveredNode && !active ? 0.4 : 1}
                    />
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={node.type === "role" ? "14" : "12"}
                      className="select-none"
                      opacity={hoveredNode && !active ? 0.4 : 1}
                    >
                      {cfg.emoji}
                    </text>
                    <text
                      y={r + 12}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={hoveredNode?.id === node.id ? "600" : "400"}
                      fill={active ? cfg.color : "#94a3b8"}
                      className="select-none"
                      opacity={hoveredNode && !active ? 0.4 : 1}
                    >
                      {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Tooltip */}
          {hoveredNode && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-auto md:bottom-6 md:max-w-xs bg-popover border rounded-xl shadow-lg p-4 pointer-events-none z-10 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{NODE_CONFIG[hoveredNode.type]?.emoji}</span>
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: NODE_CONFIG[hoveredNode.type]?.color }}
                >
                  {NODE_CONFIG[hoveredNode.type]?.label}
                </span>
              </div>
              <p className="font-semibold text-sm mb-1">{hoveredNode.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{hoveredNode.description}</p>
              {graph.edges.filter((e) => e.from === hoveredNode.id || e.to === hoveredNode.id).length > 0 && (
                <p className="text-[10px] text-muted-foreground/50 mt-2">
                  {graph.edges.filter((e) => e.from === hoveredNode.id || e.to === hoveredNode.id).length} connessioni
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-card border rounded-3xl">
          <div className="text-4xl mb-4">🕸️</div>
          <p className="text-muted-foreground text-sm mb-4">Il grafo non è ancora disponibile</p>
          <Button onClick={() => fetchGraph()} variant="outline" className="rounded-xl">
            <RefreshCw className="w-4 h-4 mr-2" />
            Genera grafo
          </Button>
        </div>
      )}

      {/* Stats */}
      {graph && (
        <div className="grid grid-cols-4 gap-3 mt-4">
          {(["role", "skill", "tool", "certification"] as const).map((type) => {
            const cfg = NODE_CONFIG[type];
            const count = graph.nodes.filter((n) => n.type === type).length;
            return (
              <div key={type} className="bg-card border rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{cfg.emoji}</div>
                <div className="text-lg font-semibold" style={{ color: cfg.color }}>{count}</div>
                <div className="text-[10px] text-muted-foreground">{cfg.label}i</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
