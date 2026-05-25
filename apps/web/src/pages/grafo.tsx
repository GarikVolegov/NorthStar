import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SectorGraphAddPanel, type SectorGraphAddForm } from "@/features/sector-graph/SectorGraphAddPanel";
import { SectorGraphCanvas } from "@/features/sector-graph/SectorGraphCanvas";
import { SectorGraphChatPanel, type SectorGraphChatMessage } from "@/features/sector-graph/SectorGraphChatPanel";
import { SectorGraphHeader } from "@/features/sector-graph/SectorGraphHeader";
import { NODE_CONFIG } from "@/features/sector-graph/sectorGraphConfig";
import { layoutSectorGraphNodes } from "@/features/sector-graph/sectorGraphLayout";
import { getJson, stream } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useGetSector } from "@workspace/api-client-react";
import {
  Loader2,
  MessageSquare,
  Network,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";
import { parseStoredGraph, readChatChunkText } from "./grafo-storage";
import type { GraphData, GraphEdge, GraphNode } from "./grafo-types";

const BASE = import.meta.env.BASE_URL || "/";

function storageKey(sectorId: number, userId: number | undefined) {
  return `grafo_user_${sectorId}_${userId ?? "guest"}`;
}

export default function Grafo() {
  const { t } = useTranslation();
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();

  const [aiGraph, setAiGraph] = useState<GraphData | null>(null);
  const [userNodes, setUserNodes] = useState<GraphNode[]>([]);
  const [userEdges, setUserEdges] = useState<GraphEdge[]>([]);

  const [positioned, setPositioned] = useState<GraphNode[]>([]);
  const [nodeMap, setNodeMap] = useState<Map<string, GraphNode>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addForm, setAddForm] = useState<SectorGraphAddForm>({
    type: "skill",
    label: "",
    description: "",
    connectTo: "",
  });

  const [activeTab, setActiveTab] = useState<"graph" | "chat">("graph");
  const [chatMessages, setChatMessages] = useState<SectorGraphChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: sector, isLoading: sectorLoading } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });

  const allNodes = [...(aiGraph?.nodes ?? []), ...userNodes];
  const allEdges = [...(aiGraph?.edges ?? []), ...userEdges];

  useEffect(() => {
    if (!id || !user) return;
    const raw = localStorage.getItem(storageKey(id, user.id));
    if (raw) {
      try {
        const parsed = parseStoredGraph(raw);
        setUserNodes(parsed.nodes ?? []);
        setUserEdges(parsed.edges ?? []);
      } catch {
        /* ignore */
      }
    }
  }, [id, user]);

  const persistUser = useCallback(
    (nodes: GraphNode[], edges: GraphEdge[]) => {
      if (!user) return;
      localStorage.setItem(
        storageKey(id, user.id),
        JSON.stringify({ nodes, edges }),
      );
    },
    [id, user],
  );

  useEffect(() => {
    const pos = layoutSectorGraphNodes(allNodes);
    setPositioned(pos);
    const map = new Map<string, GraphNode>();
    pos.forEach((n) => map.set(n.id, n));
    setNodeMap(map);
  }, [aiGraph, userNodes]);

  const fetchGraph = useCallback(
    async (force = false) => {
      if (!id) return;
      setIsLoading(true);
      try {
        const url = `${BASE}api/grafo/${id}${force ? "?refresh=1" : ""}`;
        const data = await getJson<GraphData>(url);
        setAiGraph(data);
      } catch {
        /* silent */
      }
      setIsLoading(false);
    },
    [id],
  );

  useEffect(() => {
    if (user && id) fetchGraph();
  }, [user, id, fetchGraph]);

  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    }
  }, [chatMessages, activeTab]);

  const isConnected = (nodeId: string) => {
    if (!hoveredNode) return true;
    if (nodeId === hoveredNode.id) return true;
    return allEdges.some(
      (e) =>
        (e.from === hoveredNode.id && e.to === nodeId) ||
        (e.to === hoveredNode.id && e.from === nodeId),
    );
  };

  const handleAddNode = () => {
    if (!addForm.label.trim()) return;
    const newNode: GraphNode = {
      id: `user_${Date.now()}`,
      label: addForm.label.trim(),
      type: addForm.type,
      description:
        addForm.description.trim() ||
        `${addForm.label.trim()} (aggiunto da te)`,
      userAdded: true,
    };
    const newEdges: GraphEdge[] = [];
    if (addForm.connectTo) {
      newEdges.push({
        from: newNode.id,
        to: addForm.connectTo,
        label: "collegato a",
        userAdded: true,
      });
    }
    const nextNodes = [...userNodes, newNode];
    const nextEdges = [...userEdges, ...newEdges];
    setUserNodes(nextNodes);
    setUserEdges(nextEdges);
    persistUser(nextNodes, nextEdges);
    setAddForm({ type: "skill", label: "", description: "", connectTo: "" });
    setShowAddPanel(false);
  };

  const handleRemoveUserNode = (nodeId: string) => {
    const nextNodes = userNodes.filter((n) => n.id !== nodeId);
    const nextEdges = userEdges.filter(
      (e) => e.from !== nodeId && e.to !== nodeId,
    );
    setUserNodes(nextNodes);
    setUserEdges(nextEdges);
    persistUser(nextNodes, nextEdges);
  };

  const handleExportPNG = useCallback(async () => {
    if (!svgRef.current || positioned.length === 0) return;
    setIsExporting(true);

    try {
      const svgEl = svgRef.current;
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;

      // Remove hover-state classes that don't export well
      cloned
        .querySelectorAll("[class]")
        .forEach((el) => el.removeAttribute("class"));

      // Add white background rect at the start
      const bgRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      bgRect.setAttribute("width", "1000");
      bgRect.setAttribute("height", "800");
      bgRect.setAttribute("fill", "hsl(var(--background))");
      cloned.insertBefore(bgRect, cloned.firstChild);

      // Build legend rows inside SVG at the bottom
      const legendY = 760;
      const legendItems = [
        { color: "hsl(var(--chart-4))", label: "Ruolo" },
        { color: "hsl(var(--chart-2))", label: "Competenza" },
        { color: "hsl(var(--chart-1))", label: "Strumento" },
        { color: "hsl(var(--chart-4))", label: "Certificazione" },
      ];
      const legendG = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g",
      );
      let lx = 30;
      legendItems.forEach(({ color, label }) => {
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        circle.setAttribute("cx", String(lx));
        circle.setAttribute("cy", String(legendY));
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", color);
        legendG.appendChild(circle);

        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", String(lx + 10));
        text.setAttribute("y", String(legendY + 4));
        text.setAttribute("font-size", "10");
        text.setAttribute("fill", "hsl(var(--muted-foreground))");
        text.setAttribute("font-family", "system-ui, sans-serif");
        text.textContent = label;
        legendG.appendChild(text);

        lx += label.length * 7 + 28;
      });

      // Watermark / branding bottom-right
      const brand = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      brand.setAttribute("x", "970");
      brand.setAttribute("y", String(legendY + 4));
      brand.setAttribute("text-anchor", "end");
      brand.setAttribute("font-size", "9");
      brand.setAttribute("fill", "hsl(var(--border))");
      brand.setAttribute("font-family", "system-ui, sans-serif");
      brand.textContent = "NorthStar · Mappa della Conoscenza";
      legendG.appendChild(brand);
      cloned.appendChild(legendG);

      const svgStr = new XMLSerializer().serializeToString(cloned);
      const svgBlob = new Blob([svgStr], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      const scale = 2;
      const W = 1000 * scale;
      const H = 800 * scale;

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "hsl(var(--background))";
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(svgUrl);

          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("blob null"));
              return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const name = (sector?.name ?? "settore")
              .toLowerCase()
              .replace(/[\s&]+/g, "-");
            a.download = `grafo-${name}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            resolve();
          }, "image/png");
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error("img load failed"));
        };
        img.src = svgUrl;
      });
    } catch {
      /* silent */
    }

    setIsExporting(false);
  }, [positioned, sector]);

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const newMessages: SectorGraphChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    const assistantIndex = newMessages.length;
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await stream(`${BASE}api/grafo/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          nodes: allNodes,
          edges: allEdges,
          sectorName: sector?.name ?? "",
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const text = readChatChunkText(payload);
            if (text) {
              accumulated += text;
              setChatMessages((prev) => {
                const updated = [...prev];
                updated[assistantIndex] = {
                  role: "assistant",
                  content: accumulated,
                };
                return updated;
              });
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }
          } catch {
            /* skip */
          }
        }
      }
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[assistantIndex] = {
          role: "assistant",
          content: t("grafo.errorResponse"),
        };
        return updated;
      });
    }

    setChatLoading(false);
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
        <h2 className="text-2xl font-serif font-bold mb-3">
          {t("grafo.accessRequired")}
        </h2>
        <p className="text-muted-foreground mb-8">
          {t("grafo.accessRequiredDesc")}
        </p>
        <Button asChild>
          <Link href="/registra">{t("grafo.registerFree")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
      <SectorGraphHeader
        sectorId={id}
        sectorName={sector?.name}
        hasGraph={Boolean(aiGraph)}
        hasPositionedNodes={positioned.length > 0}
        isExporting={isExporting}
        isLoading={isLoading}
        onExportPng={handleExportPNG}
        onRefresh={() => fetchGraph(true)}
        onToggleAddPanel={() => setShowAddPanel((value) => !value)}
        t={t}
      />

      {showAddPanel && (
        <SectorGraphAddPanel
          addForm={addForm}
          allNodes={allNodes}
          onChange={setAddForm}
          onAdd={handleAddNode}
          onClose={() => setShowAddPanel(false)}
          t={t}
        />
      )}

      {/* User-added nodes list */}
      {userNodes.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {userNodes.map((n) => {
            const cfg = NODE_CONFIG[n.type];
            return (
              <div
                key={n.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium"
                style={{
                  borderColor: cfg.border,
                  backgroundColor: cfg.bg,
                  color: cfg.color,
                }}
              >
                <span>{cfg.emoji}</span>
                <span>{n.label}</span>
                <button
                  onClick={() => handleRemoveUserNode(n.id)}
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <span className="text-xs text-muted-foreground self-center ml-1">
            {t("grafo.yourNodes")}
          </span>
        </div>
      )}

      {/* Tabs */}
      {aiGraph && (
        <div className="flex gap-1 mb-4 bg-muted/50 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("graph")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "graph"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Network className="w-3.5 h-3.5" />
            {t("grafo.tabGraph")}
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "chat"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t("grafo.tabChat")}
            {chatMessages.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                {chatMessages.filter((m) => m.role === "user").length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Legend */}
      {activeTab === "graph" && (
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(NODE_CONFIG).map(([type, cfg]) => (
            <div
              key={type}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <span>{t(`grafo.nodeTypes.${type}`)}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-6 h-px border-t border-dashed border-muted-foreground/40" />
            <span>{t("grafo.connection")}</span>
          </div>
          {userNodes.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-muted-foreground/60" />
              <span>{t("grafo.yourNode")}</span>
            </div>
          )}
        </div>
      )}

      {/* Graph area */}
      {activeTab === "graph" && (
        <SectorGraphCanvas
          sector={sector}
          positioned={positioned}
          allEdges={allEdges}
          nodeMap={nodeMap}
          hoveredNode={hoveredNode}
          isLoading={isLoading}
          svgRef={svgRef}
          onHoverNode={setHoveredNode}
          onGenerate={() => fetchGraph()}
          isConnected={isConnected}
          t={t}
        />
      )}
      {/* Chat tab */}
      {activeTab === "chat" && (
        <SectorGraphChatPanel
          messages={chatMessages}
          input={chatInput}
          loading={chatLoading}
          allNodes={allNodes}
          inputRef={chatInputRef}
          endRef={chatEndRef}
          onInputChange={setChatInput}
          onSend={handleSendChat}
          t={t}
        />
      )}
      {/* Stats */}
      {aiGraph && activeTab === "graph" && (
        <div className="grid grid-cols-4 gap-3 mt-4">
          {(["role", "skill", "tool", "certification"] as const).map((type) => {
            const cfg = NODE_CONFIG[type];
            const aiCount = aiGraph.nodes.filter((n) => n.type === type).length;
            const userCount = userNodes.filter((n) => n.type === type).length;
            return (
              <div
                key={type}
                className="bg-card border rounded-xl p-3 text-center"
              >
                <div className="text-xl mb-1">{cfg.emoji}</div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: cfg.color }}
                >
                  {aiCount + userCount}
                  {userCount > 0 && (
                    <span className="text-xs text-primary ml-1">
                      +{userCount}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t(`grafo.nodeTypes.${type}`)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
