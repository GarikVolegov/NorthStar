import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useGetSector } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Bot,
  Download,
  Loader2,
  MessageSquare,
  Network,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
  userAdded?: boolean;
  x?: number;
  y?: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  userAdded?: boolean;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const NODE_CONFIG = {
  role: {
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    label: "Ruolo",
    emoji: "👤",
  },
  skill: {
    color: "hsl(var(--chart-2))",
    bg: "hsl(var(--chart-2) / 0.1)",
    border: "hsl(var(--chart-2) / 0.4)",
    label: "Competenza",
    emoji: "⚡",
  },
  tool: {
    color: "hsl(var(--chart-1))",
    bg: "hsl(var(--chart-1) / 0.1)",
    border: "hsl(var(--chart-1) / 0.4)",
    label: "Strumento",
    emoji: "🔧",
  },
  certification: {
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    label: "Certificazione",
    emoji: "🏅",
  },
};

const TYPE_OPTIONS = [
  { value: "role", label: "Ruolo", emoji: "👤" },
  { value: "skill", label: "Competenza", emoji: "⚡" },
  { value: "tool", label: "Strumento", emoji: "🔧" },
  { value: "certification", label: "Certificazione", emoji: "🏅" },
] as const;

const CX = 500;
const CY = 400;

function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const byType: Record<GraphNode["type"], GraphNode[]> = {
    role: [],
    skill: [],
    tool: [],
    certification: [],
  };
  nodes.forEach((n) => {
    const t: GraphNode["type"] = n.type in byType ? n.type : "skill";
    byType[t].push(n);
  });

  const positioned: GraphNode[] = [];

  const place = (group: GraphNode[], radius: number, offsetAngle = 0) => {
    group.forEach((n, i) => {
      const angle =
        (2 * Math.PI * i) / group.length + offsetAngle - Math.PI / 2;
      positioned.push({
        ...n,
        x: CX + radius * Math.cos(angle),
        y: CY + radius * Math.sin(angle),
      });
    });
  };

  place(byType.role, 140, 0);
  place(
    byType.skill,
    255,
    byType.skill.length > 0 ? Math.PI / byType.skill.length : 0,
  );

  const outer = [
    ...byType.tool.map((n) => ({ ...n })),
    ...byType.certification.map((n) => ({ ...n })),
  ];
  outer.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / outer.length - Math.PI / 2;
    positioned.push({
      ...n,
      x: CX + 360 * Math.cos(angle),
      y: CY + 360 * Math.sin(angle),
    });
  });

  return positioned;
}

function renderMarkdown(text: string): React.ReactNode {
  return <SafeMarkdown content={text} className="space-y-1" />;
}

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
  const [addForm, setAddForm] = useState<{
    type: "role" | "skill" | "tool" | "certification";
    label: string;
    description: string;
    connectTo: string;
  }>({ type: "skill", label: "", description: "", connectTo: "" });

  const [activeTab, setActiveTab] = useState<"graph" | "chat">("graph");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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
        const parsed = JSON.parse(raw);
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
    const pos = layoutNodes(allNodes);
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
        const res = await apiFetch(url);
        if (!res.ok) throw new Error("Error");
        const data: GraphData = await res.json();
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

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    const assistantIndex = newMessages.length;
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await apiFetch(`${BASE}api/grafo/${id}/chat`, {
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
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-9 w-9 shrink-0"
          asChild
        >
          <Link href={`/settore/${id}`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-serif font-bold text-2xl truncate">
              {t("grafo.title")}
            </h1>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-primary/20 text-primary bg-primary/5 shrink-0"
            >
              <Sparkles className="w-2 h-2 mr-1" />
              Premium
            </Badge>
          </div>
          {sector && (
            <p className="text-sm text-muted-foreground">{sector.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {aiGraph && positioned.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={handleExportPNG}
              disabled={isExporting}
              title={t("grafo.downloadPng")}
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isExporting ? t("grafo.exporting") : "PNG"}
            </Button>
          )}
          {aiGraph && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => fetchGraph(true)}
              disabled={isLoading}
            >
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5 mr-1.5",
                  isLoading && "animate-spin",
                )}
              />
              {t("grafo.regenerate")}
            </Button>
          )}
          {aiGraph && (
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => setShowAddPanel((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t("grafo.addNode")}
            </Button>
          )}
        </div>
      </div>

      {/* Add node panel */}
      {showAddPanel && (
        <div className="mb-5 bg-card border rounded-2xl p-5 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">{t("grafo.addNodeTitle")}</h3>
            <button
              onClick={() => setShowAddPanel(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                {t("grafo.nodeTypeLabel")}
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setAddForm((f) => ({ ...f, type: opt.value }))
                    }
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                      addForm.type === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {opt.emoji} {t(`grafo.nodeTypes.${opt.value}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                {t("grafo.connectTo")}
              </label>
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={addForm.connectTo}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, connectTo: e.target.value }))
                }
              >
                <option value="">{t("grafo.noConnection")}</option>
                {allNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {NODE_CONFIG[n.type]?.emoji} {n.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                {t("grafo.nodeName")}
              </label>
              <input
                type="text"
                placeholder={`es. "${addForm.type === "role" ? "Product Manager" : addForm.type === "skill" ? "Agile Scrum" : addForm.type === "tool" ? "Jira" : "PMP"}"`}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={addForm.label}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, label: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                {t("grafo.nodeDescription")}
              </label>
              <input
                type="text"
                placeholder={t("grafo.nodeDescPlaceholder")}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={addForm.description}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, description: e.target.value }))
                }
                onKeyDown={(e) => e.key === "Enter" && handleAddNode()}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => setShowAddPanel(false)}
            >
              {t("grafo.cancel")}
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={handleAddNode}
              disabled={!addForm.label.trim()}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {t("grafo.addNode")}
            </Button>
          </div>
        </div>
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
      {activeTab === "graph" &&
        (isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-card border rounded-3xl">
            <Loader2 className="w-10 h-10 animate-spin text-primary/30 mb-4" />
            <p className="text-muted-foreground text-sm">
              {t("grafo.building")}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {t("grafo.buildingHint")}
            </p>
          </div>
        ) : positioned.length > 0 ? (
          <div className="relative">
            <div className="bg-card border rounded-3xl overflow-hidden shadow-sm">
              <svg
                ref={svgRef}
                viewBox="0 0 1000 800"
                className="w-full"
                style={{ maxHeight: "70vh" }}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Edges */}
                {allEdges.map((edge, i) => {
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
                      stroke={
                        active
                          ? "hsl(var(--chart-4))"
                          : edge.userAdded
                            ? "hsl(var(--muted-foreground))"
                            : "hsl(var(--border))"
                      }
                      strokeWidth={active ? 1.5 : 1}
                      strokeDasharray={
                        active ? undefined : edge.userAdded ? "6 4" : "4 3"
                      }
                      opacity={hoveredNode && !active ? 0.15 : 1}
                      className="transition-all duration-200"
                    />
                  );
                })}

                {/* Center */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={50}
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1.5}
                />
                <text
                  x={CX}
                  y={CY - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="hsl(var(--muted-foreground))"
                  className="select-none"
                >
                  {sector?.icon ?? "🏢"}
                </text>
                <text
                  x={CX}
                  y={CY + 10}
                  textAnchor="middle"
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                  className="select-none"
                >
                  {(sector?.name ?? "").split(" ").slice(0, 2).join(" ")}
                </text>

                {/* Nodes */}
                {positioned.map((node) => {
                  const cfg = NODE_CONFIG[node.type] ?? NODE_CONFIG.skill;
                  const active = isConnected(node.id);
                  const r =
                    node.type === "role" ? 26 : node.type === "skill" ? 22 : 20;
                  const isUser = node.userAdded;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredNode(node)}
                    >
                      <circle
                        r={r}
                        fill={active ? cfg.bg : "hsl(var(--background))"}
                        stroke={active ? cfg.border : "hsl(var(--border))"}
                        strokeWidth={hoveredNode?.id === node.id ? 2.5 : 1.5}
                        strokeDasharray={isUser ? "4 2" : undefined}
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
                      {isUser && (
                        <circle
                          cx={r - 5}
                          cy={-(r - 5)}
                          r={5}
                          fill="hsl(var(--chart-4))"
                          opacity={hoveredNode && !active ? 0.4 : 1}
                        />
                      )}
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight={hoveredNode?.id === node.id ? "600" : "400"}
                        fill={
                          active ? cfg.color : "hsl(var(--muted-foreground))"
                        }
                        className="select-none"
                        opacity={hoveredNode && !active ? 0.4 : 1}
                      >
                        {node.label.length > 14
                          ? node.label.slice(0, 13) + "…"
                          : node.label}
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
                  <span className="text-base">
                    {NODE_CONFIG[hoveredNode.type]?.emoji}
                  </span>
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: NODE_CONFIG[hoveredNode.type]?.color }}
                  >
                    {t(`grafo.nodeTypes.${hoveredNode.type}`)}
                  </span>
                  {hoveredNode.userAdded && (
                    <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {t("grafo.yourNode")}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-sm mb-1">
                  {hoveredNode.label}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {hoveredNode.description}
                </p>
                {allEdges.filter(
                  (e) => e.from === hoveredNode.id || e.to === hoveredNode.id,
                ).length > 0 && (
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    {t("grafo.connections", {
                      count: allEdges.filter(
                        (e) =>
                          e.from === hoveredNode.id || e.to === hoveredNode.id,
                      ).length,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-card border rounded-3xl">
            <div className="text-4xl mb-4">🕸️</div>
            <p className="text-muted-foreground text-sm mb-4">
              {t("grafo.notAvailable")}
            </p>
            <Button
              onClick={() => fetchGraph()}
              variant="outline"
              className="rounded-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("grafo.generateGraph")}
            </Button>
          </div>
        ))}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <div
          className="bg-card border rounded-3xl overflow-hidden flex flex-col"
          style={{ height: "65vh" }}
        >
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-2xl">
                  🕸️
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("grafo.tabChat")}
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  {t("grafo.chatDesc")}
                </p>
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  {[
                    t("grafo.chatQuestion1"),
                    t("grafo.chatQuestion2"),
                    t("grafo.chatQuestion3"),
                  ].map((q: string) => (
                    <button
                      key={q}
                      onClick={() => {
                        setChatInput(q);
                        chatInputRef.current?.focus();
                      }}
                      className="text-left text-xs px-4 py-2.5 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="space-y-1">
                      {msg.content === "" && chatLoading ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Elaborazione…</span>
                        </div>
                      ) : (
                        renderMarkdown(msg.content)
                      )}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t p-4">
            {allNodes.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                {t("grafo.generateFirst")}
              </p>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={t("grafo.chatPlaceholder")}
                className="resize-none rounded-xl text-sm min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={chatLoading || allNodes.length === 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
              />
              <Button
                size="icon"
                className="rounded-xl h-11 w-11 shrink-0"
                onClick={handleSendChat}
                disabled={
                  !chatInput.trim() || chatLoading || allNodes.length === 0
                }
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
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
