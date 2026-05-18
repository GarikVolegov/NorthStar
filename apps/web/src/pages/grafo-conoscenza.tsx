import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
  useTransition,
} from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Link2,
  X,
  Search,
  Sparkles,
  Loader2,
  FileText,
  Network,
  MessageCircleQuestion,
  Send,
  ChevronRight,
  Upload,
  Wand2,
  Check,
  ChevronDown,
  Maximize2,
  Copy,
  Map,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useSSEStream } from "@/hooks/useSSEStream";
import { TYPE_META, ALL_TYPES } from "@/components/knowledge-graph/types";

const BASE = import.meta.env.BASE_URL || "/";

type NodeType =
  | "note"
  | "skill"
  | "document"
  | "sector"
  | "role"
  | "tool"
  | "certification"
  | "concept"
  | "link";

interface KNode {
  id: number;
  userId: number;
  type: NodeType;
  title: string;
  content: string;
  color: string | null;
  url: string | null;
  sectorId: number | null;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

interface KEdge {
  id: number;
  userId: number;
  sourceId: number;
  targetId: number;
  label: string | null;
  createdAt: string;
}

interface GraphData {
  nodes: KNode[];
  edges: KEdge[];
}

interface AutoLinkSuggestion {
  id: number;
  title: string;
  type: NodeType;
  score: number;
}

interface AutoLinkAllResponse {
  created: number;
  skipped: number;
  edges: KEdge[];
}

interface ContextMenu {
  nodeId: number;
  x: number;
  y: number;
}

interface EdgeLabelEdit {
  edgeId: number;
  draft: string;
  screenX: number;
  screenY: number;
}

function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch(`${BASE}api/knowledge${path}`, init).then(async (r) => {
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

function nodeRadius(title: string) {
  return Math.max(28, Math.min(52, 10 + title.length * 3.2));
}

function splitTitle(title: string): [string, string | null] {
  if (title.length <= 12) return [title, null];
  const words = title.split(" ");
  if (words.length === 1) return [title.slice(0, 11) + "\u2026", null];
  let line1 = "";
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= 12) {
    line1 += (line1 ? " " : "") + words[i];
    i++;
  }
  if (!line1) line1 = words[0].slice(0, 11) + "\u2026";
  const rest = words.slice(i).join(" ");
  const line2 = rest.length > 11 ? rest.slice(0, 10) + "\u2026" : rest;
  return [line1, line2 || null];
}

function computeFitView(
  nodes: KNode[],
  svgW: number,
  svgH: number,
  padding = 60,
): { x: number; y: number; k: number } {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const k = Math.max(0.3, Math.min(2, Math.min(svgW / bw, svgH / bh)));
  const x = svgW / 2 - ((minX + maxX) / 2) * k;
  const y = svgH / 2 - ((minY + maxY) / 2) * k;
  return { x, y, k };
}

// ── Minimap ──────────────────────────────────────────────────────────────
const MINI_W = 160;
const MINI_H = 100;

interface MinimapProps {
  nodes: KNode[];
  view: { x: number; y: number; k: number };
  svgRef: React.RefObject<SVGSVGElement | null>;
  onPan: (x: number, y: number) => void;
}

const Minimap = memo(
  function Minimap({ nodes, view, svgRef, onPan }: MinimapProps) {
    const [collapsed, setCollapsed] = useState(false);

    const { scale, offsetX, offsetY, vpRect } = useMemo(() => {
      if (nodes.length === 0)
        return { scale: 1, offsetX: 0, offsetY: 0, vpRect: null };
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const pad = 40;
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const s = Math.min(MINI_W / bw, MINI_H / bh);
      const ox = (MINI_W - bw * s) / 2 - minX * s;
      const oy = (MINI_H - bh * s) / 2 - minY * s;
      const svg = svgRef.current;
      const svgW = svg?.clientWidth ?? 800;
      const svgH = svg?.clientHeight ?? 500;
      const wx0 = -view.x / view.k;
      const wy0 = -view.y / view.k;
      const wx1 = (svgW - view.x) / view.k;
      const wy1 = (svgH - view.y) / view.k;
      const vx = wx0 * s + ox;
      const vy = wy0 * s + oy;
      const vw = (wx1 - wx0) * s;
      const vh = (wy1 - wy0) * s;
      return {
        scale: s,
        offsetX: ox,
        offsetY: oy,
        vpRect: { x: vx, y: vy, w: vw, h: vh },
      };
    }, [nodes, view, svgRef]);

    const handleMinimapClick = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = (mx - offsetX) / scale;
        const wy = (my - offsetY) / scale;
        const svgW = svgRef.current.clientWidth;
        const svgH = svgRef.current.clientHeight;
        onPan(svgW / 2 - wx * view.k, svgH / 2 - wy * view.k);
      },
      [svgRef, offsetX, offsetY, scale, view.k, onPan],
    );

    if (nodes.length === 0) return null;

    return (
      <div className="absolute bottom-4 left-4 z-10">
        <div
          className={cn(
            "bg-card/95 backdrop-blur border rounded-xl shadow-sm overflow-hidden transition-all duration-200",
            collapsed ? "w-8 h-8" : "",
          )}
        >
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 hover:bg-muted transition-colors w-full",
              collapsed ? "justify-center h-8" : "border-b",
            )}
            title={collapsed ? "Espandi minimap" : "Comprimi minimap"}
          >
            <Map className="w-3 h-3 text-muted-foreground shrink-0" />
            {!collapsed && (
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                Mappa
              </span>
            )}
          </button>
          {!collapsed && (
            <svg
              width={MINI_W}
              height={MINI_H}
              className="block cursor-crosshair"
              onClick={handleMinimapClick}
            >
              <rect width={MINI_W} height={MINI_H} fill="transparent" />
              {nodes.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.note;
                const mx = n.x * scale + offsetX;
                const my = n.y * scale + offsetY;
                return (
                  <circle
                    key={n.id}
                    cx={mx}
                    cy={my}
                    r={3.5}
                    fill={meta.color}
                    opacity={0.8}
                  />
                );
              })}
              {vpRect && (
                <rect
                  x={vpRect.x}
                  y={vpRect.y}
                  width={Math.max(4, vpRect.w)}
                  height={Math.max(4, vpRect.h)}
                  fill="none"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  rx={2}
                  opacity={0.7}
                />
              )}
            </svg>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.nodes === next.nodes &&
    prev.view.x === next.view.x &&
    prev.view.y === next.view.y &&
    prev.view.k === next.view.k &&
    prev.onPan === next.onPan,
);

// ── GraphNode (estratto e memoizzato — regola 7.2) ───────────────────────
interface GraphNodeProps {
  node: KNode;
  isSelected: boolean;
  isLinkSrc: boolean;
  isLinkMode: boolean;
  onPointerDown: (e: React.PointerEvent, n: KNode) => void;
  onPointerUp: (e: React.PointerEvent, n: KNode) => void;
  onContextMenu: (e: React.MouseEvent, n: KNode) => void;
}

const GraphNode = memo(
  function GraphNode({
    node,
    isSelected,
    isLinkSrc,
    isLinkMode,
    onPointerDown,
    onPointerUp,
    onContextMenu,
  }: GraphNodeProps) {
    const meta = TYPE_META[node.type] ?? TYPE_META.note;
    const r = nodeRadius(node.title);
    const [line1, line2] = splitTitle(node.title);
    const labelW = Math.min(80, 16 + meta.label.length * 5.5);
    const textY = line2 ? -3 : 4;
    return (
      <g
        transform={`translate(${node.x},${node.y})`}
        style={{ cursor: isLinkMode ? "crosshair" : "grab" }}
        onPointerDown={(e) => onPointerDown(e, node)}
        onPointerUp={(e) => onPointerUp(e, node)}
        onContextMenu={(e) => onContextMenu(e, node)}
        data-node-id={node.id}
        data-x={node.x}
        data-y={node.y}
      >
        <circle
          r={r}
          fill={node.color || meta.bg}
          stroke={isSelected || isLinkSrc ? meta.color : meta.border}
          strokeWidth={isSelected || isLinkSrc ? 2.5 : 1.5}
          filter="url(#node-shadow)"
        />
        <text
          textAnchor="middle"
          y={textY}
          fontSize={10}
          fontWeight={600}
          fill={meta.color}
          style={{ pointerEvents: "none" }}
        >
          <tspan x="0" dy="0">
            {line1}
          </tspan>
          {line2 && (
            <tspan x="0" dy="12">
              {line2}
            </tspan>
          )}
        </text>
        <rect
          x={-labelW / 2}
          y={r + 5}
          width={labelW}
          height={14}
          rx={7}
          fill={meta.bg}
          stroke={meta.border}
          strokeWidth={1}
        />
        <text
          textAnchor="middle"
          y={r + 15}
          fontSize={8}
          fontWeight={500}
          fill={meta.color}
          style={{ pointerEvents: "none" }}
        >
          {meta.label}
        </text>
      </g>
    );
  },
  (prev, next) =>
    prev.node.x === next.node.x &&
    prev.node.y === next.node.y &&
    prev.node.title === next.node.title &&
    prev.node.type === next.node.type &&
    prev.node.color === next.node.color &&
    prev.isSelected === next.isSelected &&
    prev.isLinkSrc === next.isLinkSrc &&
    prev.isLinkMode === next.isLinkMode,
);

export default function Archivio() {
  const { user, authReady } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [linkMode, setLinkMode] = useState<{ sourceId: number } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<NodeType | "all">("all");
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");
  const [pendingEdge, setPendingEdge] = useState<{
    sourceId: number;
    targetId: number;
  } | null>(null);
  const [creatingType, setCreatingType] = useState<NodeType>("note");
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoLinkSuggestions, setAutoLinkSuggestions] = useState<
    AutoLinkSuggestion[]
  >([]);
  const [autoLinkSourceId, setAutoLinkSourceId] = useState<number | null>(null);
  const [autoLinkingAll, setAutoLinkingAll] = useState(false);
  const onSaveRef = useRef<(() => void) | null>(null);
  const [fitAnimating, setFitAnimating] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [edgeLabelEdit, setEdgeLabelEdit] = useState<EdgeLabelEdit | null>(
    null,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);

  // ── Drag via ref — zero re-render durante mousemove (regola 7.1) ─────
  const dragState = useRef<{
    id: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    x: number;
    y: number;
    el: SVGGElement | null;
  } | null>(null);

  const rafId = useRef<number | null>(null);
  const pendingPositions = useRef<Map<number, { x: number; y: number }>>(
    new globalThis.Map(),
  );
  const flushTimer = useRef<number | null>(null);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const panState = useRef<{
    startX: number;
    startY: number;
    vx: number;
    vy: number;
  } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const v = viewRef.current;
      const newK = Math.max(0.3, Math.min(2.5, v.k * (1 + delta)));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ratio = newK / v.k;
      const next = {
        x: mx - (mx - v.x) * ratio,
        y: my - (my - v.y) * ratio,
        k: newK,
      };
      viewRef.current = next;
      setView(next);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape") {
        if (edgeLabelEdit) {
          setEdgeLabelEdit(null);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (linkMode) {
          setLinkMode(null);
          return;
        }
        if (chatOpen) {
          setChatOpen(false);
          return;
        }
        if (selectedId !== null) {
          setSelectedId(null);
          return;
        }
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditing &&
        selectedId !== null
      ) {
        e.preventDefault();
        void handleDeleteNode(selectedId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && selectedId !== null) {
        e.preventDefault();
        onSaveRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, linkMode, chatOpen, contextMenu, edgeLabelEdit]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close, { capture: true });
    window.addEventListener("scroll", close, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", close, { capture: true });
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [contextMenu]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api<GraphData>("/graph");
      setData(g);
      if (g.nodes.length > 0 && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const fv = computeFitView(
          g.nodes,
          rect.width || window.innerWidth,
          rect.height || window.innerHeight - 64,
        );
        setFitAnimating(true);
        setView(fv);
        viewRef.current = fv;
        setTimeout(() => setFitAnimating(false), 400);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fv = computeFitView(data.nodes, rect.width, rect.height);
    setFitAnimating(true);
    setView(fv);
    viewRef.current = fv;
    setTimeout(() => setFitAnimating(false), 400);
  }, [data.nodes]);

  const handleMinimapPan = useCallback((nx: number, ny: number) => {
    const next = { x: nx, y: ny, k: viewRef.current.k };
    setView(next);
    viewRef.current = next;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadGraph();
  }, [authReady, user, loadGraph]);

  const flushPositions = useCallback(() => {
    const map = pendingPositions.current;
    if (map.size === 0) return;
    const positions = Array.from(map.entries()).map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
    }));
    pendingPositions.current = new globalThis.Map();
    void apiFetch(`${BASE}api/knowledge/nodes/positions`, {
      method: "POST",
      body: JSON.stringify({ positions }),
    });
  }, []);

  const queuePosition = useCallback(
    (id: number, x: number, y: number) => {
      pendingPositions.current.set(id, { x, y });
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flushPositions, 600);
    },
    [flushPositions],
  );

  useEffect(() => () => flushPositions(), [flushPositions]);

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.nodes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (q && !`${n.title} ${n.content}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [data.nodes, search, typeFilter]);

  const visibleIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );
  const visibleEdges = useMemo(
    () =>
      data.edges.filter(
        (e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId),
      ),
    [data.edges, visibleIds],
  );

  const selected = useMemo(
    () =>
      selectedId == null
        ? null
        : (data.nodes.find((n) => n.id === selectedId) ?? null),
    [data.nodes, selectedId],
  );

  const fetchAutoLinks = useCallback(async (nodeId: number) => {
    try {
      const suggestions = await api<AutoLinkSuggestion[]>(
        `/nodes/${nodeId}/auto-link`,
        { method: "POST" },
      );
      if (suggestions.length > 0) {
        setAutoLinkSuggestions(suggestions);
        setAutoLinkSourceId(nodeId);
      }
    } catch {
      /* silent */
    }
  }, []);

  const handleAutoLinkAll = useCallback(async () => {
    if (data.nodes.length < 2 || autoLinkingAll) return;
    setAutoLinkingAll(true);
    try {
      const result = await api<AutoLinkAllResponse>("/auto-link-all", {
        method: "POST",
        body: JSON.stringify({ limit: 24, perNode: 3 }),
      });

      if (result.edges.length > 0) {
        setData((d) => {
          const existing = new Set(d.edges.map((e) => e.id));
          return {
            ...d,
            edges: [
              ...d.edges,
              ...result.edges.filter((edge) => !existing.has(edge.id)),
            ],
          };
        });
      }

      toast({
        title:
          result.created > 0
            ? `${result.created} collegamenti creati`
            : "Nessun nuovo collegamento",
        description:
          result.created > 0
            ? "Wendy ha analizzato i nodi e collegato le relazioni piu rilevanti."
            : "Il grafo e gia allineato oppure servono contenuti piu ricchi.",
      });
    } catch (err) {
      toast({
        title: "Collegamento automatico fallito",
        description: err instanceof Error ? err.message : "Errore di rete.",
        variant: "destructive",
      });
    } finally {
      setAutoLinkingAll(false);
    }
  }, [autoLinkingAll, data.nodes.length, toast]);

  const handleFileImport = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(`${BASE}api/knowledge/import`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        const created = (await res.json()) as KNode;
        setData((d) => ({ ...d, nodes: [...d.nodes, created] }));
        setSelectedId(created.id);
        void fetchAutoLinks(created.id);
      } catch (err) {
        toast({
          title: "Importazione fallita",
          description: err instanceof Error ? err.message : "Errore di rete.",
          variant: "destructive",
        });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [fetchAutoLinks, toast],
  );

  const handleAddNode = useCallback(
    async (type: NodeType = creatingType) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const v = viewRef.current;
      const cx = (rect.width / 2 - v.x) / v.k;
      const cy = (rect.height / 2 - v.y) / v.k;
      const x = cx + (Math.random() - 0.5) * 60;
      const y = cy + (Math.random() - 0.5) * 60;
      try {
        const created = await api<KNode>("/nodes", {
          method: "POST",
          body: JSON.stringify({
            type,
            title: TYPE_META[type].label + " senza titolo",
            x,
            y,
          }),
        });
        setData((d) => ({ ...d, nodes: [...d.nodes, created] }));
        setSelectedId(created.id);
      } catch {
        /* silent */
      }
    },
    [creatingType],
  );

  const handleUpdateNode = useCallback(
    async (id: number, patch: Partial<KNode>) => {
      try {
        const updated = await api<KNode>(`/nodes/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setData((d) => ({
          ...d,
          nodes: d.nodes.map((n) => (n.id === id ? updated : n)),
        }));
        if (patch.content && patch.content.length > 20) void fetchAutoLinks(id);
      } catch {
        /* silent */
      }
    },
    [fetchAutoLinks],
  );

  const handleDeleteNode = useCallback(
    async (id: number) => {
      try {
        await api(`/nodes/${id}`, { method: "DELETE" });
        setData((d) => ({
          nodes: d.nodes.filter((n) => n.id !== id),
          edges: d.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
        }));
        if (selectedId === id) setSelectedId(null);
      } catch {
        /* silent */
      }
    },
    [selectedId],
  );

  const handleCreateEdge = useCallback(
    async (sourceId: number, targetId: number, label?: string) => {
      if (sourceId === targetId) return;
      if (
        data.edges.some(
          (e) => e.sourceId === sourceId && e.targetId === targetId,
        )
      )
        return;
      try {
        const created = await api<KEdge>("/edges", {
          method: "POST",
          body: JSON.stringify({
            sourceId,
            targetId,
            label: label?.trim() || undefined,
          }),
        });
        setData((d) => ({ ...d, edges: [...d.edges, created] }));
      } catch {
        /* silent */
      }
    },
    [data.edges],
  );

  const handleDeleteEdge = useCallback(async (id: number) => {
    try {
      await api(`/edges/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    } catch {
      /* silent */
    }
  }, []);

  const handleUpdateEdgeLabel = useCallback(
    async (id: number, label: string) => {
      try {
        const updated = await api<KEdge>(`/edges/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ label: label.trim() || null }),
        });
        setData((d) => ({
          ...d,
          edges: d.edges.map((e) => (e.id === id ? updated : e)),
        }));
      } catch {
        /* silent */
      }
    },
    [],
  );

  const handleDuplicateNode = useCallback(
    async (id: number) => {
      const src = data.nodes.find((n) => n.id === id);
      if (!src) return;
      try {
        const created = await api<KNode>("/nodes", {
          method: "POST",
          body: JSON.stringify({
            type: src.type,
            title: src.title + " (copia)",
            content: src.content,
            url: src.url,
            x: src.x + 50,
            y: src.y + 50,
          }),
        });
        setData((d) => ({ ...d, nodes: [...d.nodes, created] }));
        setSelectedId(created.id);
        toast({
          title: "Nodo duplicato",
          description: `\u00ab${src.title}\u00bb copiato con successo.`,
        });
      } catch {
        /* silent */
      }
    },
    [data.nodes, toast],
  );

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent, n: KNode) => {
      e.stopPropagation();
      if (linkMode) {
        if (linkMode.sourceId === n.id) {
          setLinkMode(null);
          return;
        }
        setPendingEdge({ sourceId: linkMode.sourceId, targetId: n.id });
        setLinkMode(null);
        setEdgeLabelDraft("");
        return;
      }
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const svgRect = svgRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      const px = (e.clientX - svgRect.left - v.x) / v.k;
      const py = (e.clientY - svgRect.top - v.y) / v.k;
      dragState.current = {
        id: n.id,
        offsetX: px - n.x,
        offsetY: py - n.y,
        moved: false,
        x: n.x,
        y: n.y,
        el: e.currentTarget as SVGGElement,
      };
    },
    [linkMode],
  );

  const onNodeContextMenu = useCallback((e: React.MouseEvent, n: KNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ nodeId: n.id, x: e.clientX, y: e.clientY });
  }, []);

  const onEdgeLabelClick = useCallback(
    (e: React.MouseEvent, edge: KEdge, mx: number, my: number) => {
      e.stopPropagation();
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const v = viewRef.current;
      const screenX = mx * v.k + v.x + rect.left;
      const screenY = my * v.k + v.y + rect.top;
      setEdgeLabelEdit({
        edgeId: edge.id,
        draft: edge.label ?? "",
        screenX,
        screenY,
      });
    },
    [],
  );

  // ── DOM diretto durante drag, setState solo su pointerUp (regola 7.1) ──
  const onSvgPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragState.current;
    const pan = panState.current;
    if (drag) {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      const cx = e.clientX;
      const cy = e.clientY;
      rafId.current = requestAnimationFrame(() => {
        if (!drag || !svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const v = viewRef.current;
        const newX = (cx - svgRect.left - v.x) / v.k - drag.offsetX;
        const newY = (cy - svgRect.top - v.y) / v.k - drag.offsetY;
        drag.moved = true;
        drag.x = newX;
        drag.y = newY;
        if (drag.el) {
          drag.el.setAttribute("transform", `translate(${newX},${newY})`);
          drag.el.setAttribute("data-x", String(newX));
          drag.el.setAttribute("data-y", String(newY));
        }
        svgRef.current
          .querySelectorAll<SVGLineElement>(`line[data-source="${drag.id}"]`)
          .forEach((l) => {
            l.setAttribute("x1", String(newX));
            l.setAttribute("y1", String(newY));
          });
        svgRef.current
          .querySelectorAll<SVGLineElement>(`line[data-target="${drag.id}"]`)
          .forEach((l) => {
            l.setAttribute("x2", String(newX));
            l.setAttribute("y2", String(newY));
          });
        svgRef.current
          .querySelectorAll<SVGTextElement>(
            `text[data-edge-mid-source="${drag.id}"]`,
          )
          .forEach((txt) => {
            const ox = parseFloat(txt.getAttribute("data-other-x") ?? "0");
            const oy = parseFloat(txt.getAttribute("data-other-y") ?? "0");
            txt.setAttribute("x", String((newX + ox) / 2));
            txt.setAttribute("y", String((newY + oy) / 2 - 4));
          });
        svgRef.current
          .querySelectorAll<SVGTextElement>(
            `text[data-edge-mid-target="${drag.id}"]`,
          )
          .forEach((txt) => {
            const ox = parseFloat(txt.getAttribute("data-other-x") ?? "0");
            const oy = parseFloat(txt.getAttribute("data-other-y") ?? "0");
            txt.setAttribute("x", String((newX + ox) / 2));
            txt.setAttribute("y", String((newY + oy) / 2 - 4));
          });
        svgRef.current
          .querySelectorAll<SVGTextElement>(
            `text[data-edge-mid-source]:not([data-edge-mid-source="${drag.id}"]),` +
              `text[data-edge-mid-target]:not([data-edge-mid-target="${drag.id}"])`,
          )
          .forEach((txt) => {
            const srcId = txt.getAttribute("data-edge-mid-source");
            const tgtId = txt.getAttribute("data-edge-mid-target");
            const isDragOther =
              (srcId &&
                srcId !== String(drag.id) &&
                tgtId === String(drag.id)) ||
              (tgtId && tgtId !== String(drag.id) && srcId === String(drag.id));
            if (!isDragOther) return;
            txt.setAttribute("data-other-x", String(newX));
            txt.setAttribute("data-other-y", String(newY));
            const otherG = svgRef.current!.querySelector<SVGGElement>(
              `g[data-node-id="${srcId !== String(drag.id) ? srcId : tgtId}"]`,
            );
            if (otherG) {
              const otherX = parseFloat(otherG.getAttribute("data-x") ?? "0");
              const otherY = parseFloat(otherG.getAttribute("data-y") ?? "0");
              txt.setAttribute("x", String((newX + otherX) / 2));
              txt.setAttribute("y", String((newY + otherY) / 2 - 4));
            }
          });
      });
    } else if (pan) {
      setView({
        x: pan.vx + (e.clientX - pan.startX),
        y: pan.vy + (e.clientY - pan.startY),
        k: viewRef.current.k,
      });
    }
  }, []);

  // ── Commit stato React solo su pointerUp (regola 7.1) ───────────────
  const onNodePointerUp = useCallback(
    (e: React.PointerEvent, n: KNode) => {
      const drag = dragState.current;
      dragState.current = null;
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (!drag) return;
      if (!drag.moved) {
        setSelectedId(n.id);
      } else {
        setData((d) => ({
          ...d,
          nodes: d.nodes.map((nd) =>
            nd.id === drag.id ? { ...nd, x: drag.x, y: drag.y } : nd,
          ),
        }));
        queuePosition(drag.id, drag.x, drag.y);
      }
      e.stopPropagation();
    },
    [queuePosition],
  );

  const onSvgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      vx: viewRef.current.x,
      vy: viewRef.current.y,
    };
    setSelectedId(null);
    setLinkMode(null);
  }, []);

  const onSvgPointerUp = useCallback(() => {
    panState.current = null;
  }, []);

  useEffect(() => {
    const zeros = data.nodes.filter((n) => n.x === 0 && n.y === 0);
    if (zeros.length === 0) return;
    if (zeros.length === data.nodes.length && data.nodes.length > 0) {
      const r = 200 + Math.min(220, data.nodes.length * 14);
      const next = data.nodes.map((n, i) => {
        const angle = (i * 2 * Math.PI) / data.nodes.length;
        return { ...n, x: r * Math.cos(angle), y: r * Math.sin(angle) };
      });
      setData((d) => ({ ...d, nodes: next }));
      next.forEach((n) => queuePosition(n.id, n.x, n.y));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes.length]);

  if (!authReady || (user && loading)) {
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
          📚
        </div>
        <h2 className="text-2xl font-serif font-bold mb-3">
          Accesso richiesto
        </h2>
        <p className="text-muted-foreground mb-8">
          Registrati per costruire il tuo Archivio personale.
        </p>
        <Button asChild>
          <Link href="/registra">Registrati gratis</Link>
        </Button>
      </div>
    );
  }

  const ctxNode = contextMenu
    ? data.nodes.find((n) => n.id === contextMenu.nodeId)
    : null;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileImport(file);
        }}
      />

      {edgeLabelEdit && (
        <div
          className="fixed z-70 flex items-center gap-1"
          style={{
            left: edgeLabelEdit.screenX - 70,
            top: edgeLabelEdit.screenY - 14,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type="text"
            value={edgeLabelEdit.draft}
            onChange={(e) =>
              setEdgeLabelEdit((prev) =>
                prev ? { ...prev, draft: e.target.value } : null,
              )
            }
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                await handleUpdateEdgeLabel(
                  edgeLabelEdit.edgeId,
                  edgeLabelEdit.draft,
                );
                setEdgeLabelEdit(null);
              }
              if (e.key === "Escape") setEdgeLabelEdit(null);
            }}
            onBlur={async () => {
              await handleUpdateEdgeLabel(
                edgeLabelEdit.edgeId,
                edgeLabelEdit.draft,
              );
              setEdgeLabelEdit(null);
            }}
            placeholder="etichetta\u2026"
            className="w-36 h-6 px-2 text-[11px] rounded-lg border border-primary shadow-md bg-card outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={async () => {
              await handleUpdateEdgeLabel(
                edgeLabelEdit.edgeId,
                edgeLabelEdit.draft,
              );
              setEdgeLabelEdit(null);
            }}
            className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
          >
            <Check className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b bg-card/80 backdrop-blur-sm overflow-x-auto">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 shrink-0"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2 mr-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="w-3.5 h-3.5 text-primary" />
          </div>
          <h1 className="font-serif font-bold text-lg whitespace-nowrap">
            Il tuo Archivio
          </h1>
        </div>
        <div className="relative flex-1 min-w-35 max-w-55">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca\u2026"
            className="h-8 pl-8 text-sm rounded-xl"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NodeType | "all")}
          className="h-8 rounded-xl border border-border bg-background px-2 text-xs shrink-0"
        >
          <option value="all">Tutti</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={chatOpen ? "default" : "outline"}
                className="rounded-xl h-8 w-8"
                onClick={() => {
                  setChatOpen((v) => !v);
                  if (!chatOpen) setSelectedId(null);
                }}
              >
                <MessageCircleQuestion className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chiedi all'Archivio</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-8 gap-1"
                disabled={autoLinkingAll || data.nodes.length < 2}
                onClick={handleAutoLinkAll}
              >
                {autoLinkingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden lg:inline">Collega</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collega automaticamente</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="rounded-xl h-8 gap-1"
                disabled={importing}
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Aggiungi</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Crea elemento
              </DropdownMenuLabel>
              {ALL_TYPES.map((t) => {
                const m = TYPE_META[t];
                const Icon = m.Icon;
                return (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => handleAddNode(t)}
                    className="gap-2 cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: m.bg, color: m.color }}
                    >
                      <Icon className="w-3 h-3" />
                    </span>
                    {m.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 cursor-pointer"
                disabled={importing}
              >
                <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                  <Upload className="w-3 h-3" />
                </span>
                {importing ? "Importando\u2026" : "Importa file\u2026"}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  PDF, MD, TXT
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {linkMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <span>
            <Link2 className="w-3.5 h-3.5 inline mr-1" />
            Modalit\u00e0 collegamento \u2014 clicca un altro elemento per
            collegarlo a \u00ab
            {data.nodes.find((n) => n.id === linkMode.sourceId)?.title}\u00bb
            <span className="ml-2 opacity-60">(Esc per annullare)</span>
          </span>
          <button
            onClick={() => setLinkMode(null)}
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
                      await handleCreateEdge(autoLinkSourceId, s.id);
                      setAutoLinkSuggestions((prev) =>
                        prev.filter((x) => x.id !== s.id),
                      );
                      if (autoLinkSuggestions.length === 1)
                        setAutoLinkSourceId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: meta.bg,
                      color: meta.color,
                      borderColor: meta.border,
                    }}
                    title={`Affinit\u00e0 ${Math.round(s.score * 100)}%`}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {s.title}
                    <span className="opacity-60">
                      {Math.round(s.score * 100)}%
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setAutoLinkSuggestions((prev) =>
                        prev.filter((x) => x.id !== s.id),
                      );
                      if (autoLinkSuggestions.length === 1)
                        setAutoLinkSourceId(null);
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
              setAutoLinkSuggestions([]);
              setAutoLinkSourceId(null);
            }}
          >
            Ignora tutti
          </button>
        </div>
      )}

      {pendingEdge && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setPendingEdge(null)}
        >
          <div
            className="bg-card rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Etichetta collegamento</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {data.nodes.find((n) => n.id === pendingEdge.sourceId)?.title}{" "}
              \u2192{" "}
              {data.nodes.find((n) => n.id === pendingEdge.targetId)?.title}
            </p>
            <Input
              autoFocus
              placeholder="es. richiede, usa, simile a\u2026"
              value={edgeLabelDraft}
              onChange={(e) => setEdgeLabelDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await handleCreateEdge(
                    pendingEdge.sourceId,
                    pendingEdge.targetId,
                    edgeLabelDraft,
                  );
                  setPendingEdge(null);
                  setEdgeLabelDraft("");
                }
                if (e.key === "Escape") {
                  setPendingEdge(null);
                  setEdgeLabelDraft("");
                }
              }}
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingEdge(null)}
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await handleCreateEdge(
                    pendingEdge.sourceId,
                    pendingEdge.targetId,
                    edgeLabelDraft,
                  );
                  setPendingEdge(null);
                  setEdgeLabelDraft("");
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
              setSelectedId(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Apri
            dettaglio
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-xs"
            onClick={() => {
              setLinkMode({ sourceId: contextMenu.nodeId });
              setContextMenu(null);
              setSelectedId(null);
            }}
          >
            <Link2 className="w-3.5 h-3.5 text-muted-foreground" />{" "}
            Collega\u2026
          </button>
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2 text-xs"
            onClick={() => {
              void handleDuplicateNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Duplica
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 flex items-center gap-2 text-xs text-destructive"
            onClick={() => {
              void handleDeleteNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Elimina
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {isMobile && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-3 mb-2">
              <span className="text-lg leading-none shrink-0">
                \uD83D\uDDA5\uFE0F
              </span>
              <p>Per l'esperienza completa con drag & drop, apri da desktop.</p>
            </div>
            {data.nodes.length === 0 ? (
              <EmptyState
                onAdd={handleAddNode}
                onImport={() => fileInputRef.current?.click()}
              />
            ) : (
              filteredNodes.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.Icon;
                const connections = data.edges.filter(
                  (e) => e.sourceId === n.id || e.targetId === n.id,
                ).length;
                return (
                  <div
                    key={n.id}
                    className="rounded-xl border bg-card p-4 flex items-start gap-3"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: meta.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.content}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground text-right">
                      <span
                        className="block font-medium"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <span>{connections} link</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {!isMobile && (
          <div className="flex-1 relative bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-size-[24px_24px] overflow-hidden">
            {data.nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <EmptyState
                  onAdd={handleAddNode}
                  onImport={() => fileInputRef.current?.click()}
                />
              </div>
            )}
            <svg
              ref={svgRef}
              className="w-full h-full touch-none select-none"
              onPointerDown={onSvgPointerDown}
              onPointerMove={onSvgPointerMove}
              onPointerUp={onSvgPointerUp}
              onPointerLeave={onSvgPointerUp}
            >
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path
                    d="M0,0 L10,5 L0,10 Z"
                    fill="hsl(var(--muted-foreground))"
                  />
                </marker>
                <filter
                  id="node-shadow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="3"
                    floodColor="hsl(var(--foreground) / 0.08)"
                  />
                </filter>
              </defs>
              <g
                transform={`translate(${view.x},${view.y}) scale(${view.k})`}
                style={
                  fitAnimating
                    ? {
                        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                      }
                    : undefined
                }
              >
                {/* Edges */}
                {visibleEdges.map((edge) => {
                  const a = data.nodes.find((n) => n.id === edge.sourceId);
                  const b = data.nodes.find((n) => n.id === edge.targetId);
                  if (!a || !b) return null;
                  const dimmed =
                    selectedId != null &&
                    selectedId !== a.id &&
                    selectedId !== b.id;
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;
                  return (
                    <g key={edge.id} opacity={dimmed ? 0.15 : 0.9}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.4}
                        markerEnd="url(#arrow)"
                        data-source={edge.sourceId}
                        data-target={edge.targetId}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <g
                            style={{ cursor: "text" }}
                            onClick={(e) => onEdgeLabelClick(e, edge, mx, my)}
                          >
                            <rect
                              x={mx - 30}
                              y={my - 10}
                              width={60}
                              height={16}
                              fill="transparent"
                              data-edge-mid-source={edge.sourceId}
                              data-edge-mid-target={edge.targetId}
                            />
                            {edge.label ? (
                              <text
                                x={mx}
                                y={my - 4}
                                textAnchor="middle"
                                fontSize={9}
                                fill="hsl(var(--muted-foreground))"
                                style={{ pointerEvents: "none" }}
                                data-edge-mid-source={edge.sourceId}
                                data-edge-mid-target={edge.targetId}
                                data-other-x={b.x}
                                data-other-y={b.y}
                              >
                                {edge.label}
                              </text>
                            ) : (
                              <text
                                x={mx}
                                y={my - 4}
                                textAnchor="middle"
                                fontSize={8}
                                fill="hsl(var(--muted-foreground))"
                                style={{ pointerEvents: "none" }}
                                opacity={0.4}
                                data-edge-mid-source={edge.sourceId}
                                data-edge-mid-target={edge.targetId}
                                data-other-x={b.x}
                                data-other-y={b.y}
                              >
                                +
                              </text>
                            )}
                          </g>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          {edge.label
                            ? "Clicca per modificare"
                            : "Clicca per aggiungere etichetta"}
                        </TooltipContent>
                      </Tooltip>
                    </g>
                  );
                })}
                {/* Nodes — GraphNode memoizzato (regola 7.2) */}
                {filteredNodes.map((n) => (
                  <GraphNode
                    key={n.id}
                    node={n}
                    isSelected={selectedId === n.id}
                    isLinkSrc={linkMode?.sourceId === n.id}
                    isLinkMode={linkMode !== null}
                    onPointerDown={onNodePointerDown}
                    onPointerUp={onNodePointerUp}
                    onContextMenu={onNodeContextMenu}
                  />
                ))}
              </g>
            </svg>

            <Minimap
              nodes={data.nodes}
              view={view}
              svgRef={svgRef}
              onPan={handleMinimapPan}
            />

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col items-center gap-0.5 bg-card/90 backdrop-blur border rounded-xl shadow-sm p-1">
              <button
                onClick={() =>
                  setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))
                }
                className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold"
                title="Zoom in"
              >
                +
              </button>
              <span className="text-[9px] font-semibold text-muted-foreground tabular-nums w-7 text-center leading-5">
                {Math.round(view.k * 100)}%
              </span>
              <button
                onClick={() =>
                  setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))
                }
                className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold"
                title="Zoom out"
              >
                \u2212
              </button>
              <div className="w-full h-px bg-border my-0.5" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleFit}
                    className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center"
                    title="Fit to screen"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Adatta alla schermata
                </TooltipContent>
              </Tooltip>
              <button
                onClick={() => setView({ x: 0, y: 0, k: 1 })}
                className="w-7 h-7 rounded-lg hover:bg-muted text-[10px] font-semibold"
                title="Reset vista"
              >
                ⌂
              </button>
            </div>

            <div className="absolute top-3 left-3 flex gap-2 items-center">
              <Badge
                variant="outline"
                className="text-[10px] bg-card/80 backdrop-blur"
              >
                {filteredNodes.length} elementi
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] bg-card/80 backdrop-blur"
              >
                {visibleEdges.length} collegamenti
              </Badge>
              {selectedId !== null && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-card/80 backdrop-blur text-muted-foreground"
                >
                  Del = elimina \u00b7 Esc = chiudi \u00b7 \u2318S = salva
                </Badge>
              )}
            </div>
          </div>
        )}

        {selected && !chatOpen && (
          <NodeEditor
            key={selected.id}
            node={selected}
            edges={data.edges.filter(
              (e) => e.sourceId === selected.id || e.targetId === selected.id,
            )}
            allNodes={data.nodes}
            onClose={() => setSelectedId(null)}
            onSave={(patch) => handleUpdateNode(selected.id, patch)}
            onDelete={() => handleDeleteNode(selected.id)}
            onStartLink={() => setLinkMode({ sourceId: selected.id })}
            onDeleteEdge={(id) => handleDeleteEdge(id)}
            onSaveRef={onSaveRef}
          />
        )}

        {chatOpen && (
          <ChatPanel
            nodes={data.nodes}
            onClose={() => setChatOpen(false)}
            onFocusNode={(id) => {
              setChatOpen(false);
              setSelectedId(id);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── EmptyState (memoizzato — props stabili) ──────────────────────────────
const EmptyState = memo(function EmptyState({
  onAdd,
  onImport,
}: {
  onAdd: (type?: NodeType) => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 text-3xl">
        📚
      </div>
      <h2 className="font-serif font-bold text-xl mb-2">
        Il tuo Archivio \u00e8 vuoto
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Qui raccoglierai tutto quello che impari: note, competenze, documenti,
        idee. Ogni elemento si collega agli altri \u2014 costruisci la mappa del
        tuo percorso.
      </p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
        {(["note", "skill", "document"] as NodeType[]).map((t) => {
          const m = TYPE_META[t];
          const Icon = m.Icon;
          return (
            <button
              key={t}
              onClick={() => onAdd(t)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: m.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: m.color }} />
              </div>
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onImport}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border rounded-xl px-4 py-2 hover:border-primary/40 transition-colors"
      >
        <Upload className="w-4 h-4" /> Oppure importa un file esistente
      </button>
    </div>
  );
});

interface Citation {
  id: number;
  title: string;
  type: NodeType;
  score?: number;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  neighbors?: Citation[];
  status?: string;
  error?: string;
}
interface ChatPanelProps {
  nodes: KNode[];
  onClose: () => void;
  onFocusNode: (id: number) => void;
}

// ── ChatPanel — SSE via useSSEStream (regola 4.1) ────────────────────────
function ChatPanel({ nodes, onClose, onFocusNode }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
    start: startStream,
    reset: resetStream,
  } = useSSEStream({
    onError: () => {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last?.role === "assistant")
          next[next.length - 1] = {
            ...last,
            error: "Errore di rete",
            status: undefined,
          };
        return next;
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || isStreaming) return;
    setQuestion("");
    resetStream();
    const userMsg: ChatMessage = { role: "user", content: q };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      status: "starting",
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    // useSSEStream gestisce il fetch; per i messaggi strutturati (citations, status)
    // usiamo il pattern manuale solo per il parsing SSE semantico
    try {
      const res = await apiFetch(`${BASE}api/knowledge/ask`, {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Nessun reader");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            setMessages((prev) => {
              const next = prev.slice();
              const last = next[next.length - 1];
              if (last.role !== "assistant") return prev;
              if (data.content)
                next[next.length - 1] = {
                  ...last,
                  content: last.content + data.content,
                  status: undefined,
                };
              else if (data.status)
                next[next.length - 1] = { ...last, status: data.status };
              else if (data.citations)
                next[next.length - 1] = {
                  ...last,
                  citations: data.citations,
                  neighbors: data.neighbors,
                };
              else if (data.error)
                next[next.length - 1] = {
                  ...last,
                  error: data.error,
                  status: undefined,
                };
              return next;
            });
          } catch {
            /* malformed sse */
          }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last.role === "assistant")
          next[next.length - 1] = {
            ...last,
            error: err instanceof Error ? err.message : "Errore di rete",
            status: undefined,
          };
        return next;
      });
    }
  }, [question, isStreaming, resetStream]);

  function renderAnswer(content: string, citations?: Citation[]) {
    const parts: React.ReactNode[] = [];
    const regex = /\[#(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex)
        parts.push(content.slice(lastIndex, match.index));
      const id = Number(match[1]);
      const node = nodes.find((n) => n.id === id);
      const cite = citations?.find((c) => c.id === id);
      const label = node?.title ?? cite?.title ?? `#${id}`;
      parts.push(
        <button
          key={`c-${key++}`}
          onClick={() => onFocusNode(id)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 align-baseline"
          title={`Vai all'elemento ${label}`}
        >
          {label}
        </button>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return parts;
  }

  const suggestions = [
    "Cosa ho imparato finora?",
    "Quali competenze mi mancano per il mio obiettivo?",
    "Riassumi i miei documenti su questo argomento.",
    "Quali elementi sono pi\u00f9 connessi tra loro?",
  ];

  return (
    <aside className="w-full max-w-md border-l bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircleQuestion className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Assistente
          </p>
          <p className="text-sm font-semibold truncate">Chiedi all'Archivio</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold mb-1">
              Interroga il tuo Archivio
            </p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              L'AI legge tutti i tuoi elementi, considera i collegamenti e
              risponde basandosi solo su quello che hai salvato. {nodes.length}{" "}
              elementi disponibili.
            </p>
            <div className="space-y-1.5 text-left">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="w-full text-left px-3 py-2 rounded-lg border bg-background hover:border-primary/40 hover:bg-primary/5 text-xs transition-colors flex items-center gap-2"
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {m.citations && m.citations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Elementi usati
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => {
                        const meta = TYPE_META[c.type] ?? TYPE_META.note;
                        return (
                          <button
                            key={c.id}
                            onClick={() => onFocusNode(c.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-80"
                            style={{
                              backgroundColor: meta.bg,
                              color: meta.color,
                              borderColor: meta.border,
                            }}
                            title={`Affinit\u00e0 ${c.score ? Math.round(c.score * 100) : 0}%`}
                          >
                            <meta.Icon className="w-2.5 h-2.5" />
                            <span className="font-medium">{c.title}</span>
                            {c.score !== undefined && (
                              <span className="opacity-70">
                                {Math.round(c.score * 100)}%
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="bg-muted/40 border rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {m.error ? (
                    <span className="text-destructive">{m.error}</span>
                  ) : m.content ? (
                    renderAnswer(m.content, m.citations)
                  ) : m.status ? (
                    <span className="text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {m.status === "embedding" &&
                        "Analizzo il contenuto\u2026"}
                      {m.status === "retrieving" &&
                        "Cerco gli elementi pi\u00f9 rilevanti\u2026"}
                      {m.status === "answering" && "Sto rispondendo\u2026"}
                      {m.status === "starting" && "Avvio\u2026"}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
            placeholder="Chiedimi qualcosa sul tuo percorso\u2026"
            rows={2}
            className="rounded-xl text-sm resize-none flex-1"
            disabled={isStreaming}
          />
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0"
            disabled={isStreaming || !question.trim()}
            onClick={() => void ask()}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          \u21b5 invia \u00b7 Shift+\u21b5 vai a capo
        </p>
      </div>
    </aside>
  );
}

interface NodeEditorProps {
  node: KNode;
  edges: KEdge[];
  allNodes: KNode[];
  onClose: () => void;
  onSave: (patch: Partial<KNode>) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onStartLink: () => void;
  onDeleteEdge: (id: number) => Promise<void> | void;
  onSaveRef: React.MutableRefObject<(() => void) | null>;
}

function NodeEditor({
  node,
  edges,
  allNodes,
  onClose,
  onSave,
  onDelete,
  onStartLink,
  onDeleteEdge,
  onSaveRef,
}: NodeEditorProps) {
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [type, setType] = useState<NodeType>(node.type);
  const [url, setUrl] = useState(node.url ?? "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);

  useEffect(() => {
    setTitle(node.title);
    setContent(node.content);
    setType(node.type);
    setUrl(node.url ?? "");
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    title !== node.title ||
    content !== node.content ||
    type !== node.type ||
    (url || "") !== (node.url || "");

  const save = useCallback(
    async (silent = false) => {
      if (!dirty) return;
      setSaving(true);
      await onSave({
        title: title.trim() || "Senza titolo",
        content,
        type,
        url: url.trim() || null,
      });
      setSaving(false);
      if (silent) {
        setSavedBadge(true);
        setTimeout(() => setSavedBadge(false), 2000);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [dirty, title, content, type, url, onSave],
  );

  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      void save(true);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, type, url]);

  useEffect(() => {
    onSaveRef.current = dirty ? () => void save(false) : null;
    return () => {
      onSaveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, content, type, url]);

  const meta = TYPE_META[type] ?? TYPE_META.note;
  const Icon = meta.Icon;

  return (
    <aside className="w-full max-w-md border-l bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: meta.bg, color: meta.color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {meta.label}
          </p>
          <p className="text-sm font-semibold truncate">{node.title}</p>
        </div>
        {savedBadge && (
          <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 animate-in fade-in">
            <Check className="w-3 h-3" /> Salvato
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
            Titolo
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
            Tipo
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => {
              const m = TYPE_META[t];
              const TI = m.Icon;
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors",
                    type === t
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <TI className="w-3 h-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        {(type === "link" || type === "document") && (
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://\u2026"
              className="rounded-xl"
            />
          </div>
        )}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
            Contenuto
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Appunti, descrizione, riferimenti\u2026"
            rows={6}
            className="rounded-xl text-sm font-mono resize-y"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Markdown supportato \u00b7 autosalvataggio ogni 1.5s
          </p>
        </div>
        <div className="pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Collegamenti ({edges.length})
            </label>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-lg text-xs"
              onClick={onStartLink}
            >
              <Link2 className="w-3 h-3 mr-1" /> Collega\u2026
            </Button>
          </div>
          <div className="space-y-1">
            {edges.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nessun collegamento ancora.
              </p>
            )}
            {edges.map((e) => {
              const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
              const other = allNodes.find((n) => n.id === otherId);
              if (!other) return null;
              const m = TYPE_META[other.type] ?? TYPE_META.note;
              const direction = e.sourceId === node.id ? "\u2192" : "\u2190";
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-background text-xs"
                >
                  <span className="text-muted-foreground">{direction}</span>
                  <span
                    className="px-1.5 py-0.5 rounded font-medium"
                    style={{ backgroundColor: m.bg, color: m.color }}
                  >
                    {other.title}
                  </span>
                  {e.label && (
                    <span className="text-muted-foreground italic">
                      \u2014 {e.label}
                    </span>
                  )}
                  <button
                    onClick={() => onDeleteEdge(e.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t p-3 flex items-center gap-2">
        {confirming ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={onDelete}
              className="rounded-xl"
            >
              Conferma elimina
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(false)}
              className="rounded-xl"
            >
              Annulla
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina
          </Button>
        )}
        <Button
          size="sm"
          className="rounded-xl ml-auto"
          disabled={!dirty || saving}
          onClick={() => void save(false)}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5 mr-1" />
          )}
          Salva
          {dirty && (
            <span className="ml-1.5 text-[9px] opacity-60">\u2318S</span>
          )}
        </Button>
      </div>
    </aside>
  );
}
