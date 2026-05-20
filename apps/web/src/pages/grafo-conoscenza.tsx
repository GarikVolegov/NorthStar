import { TYPE_META } from "@/components/knowledge-graph/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { KnowledgeChatPanel as ChatPanel } from "@/features/knowledge-graph/KnowledgeChatPanel";
import { KnowledgeEmptyState as EmptyState } from "@/features/knowledge-graph/KnowledgeEmptyState";
import { knowledgeApi as api } from "@/features/knowledge-graph/knowledgeGraphApi";
import { KnowledgeGraphMinimap } from "@/features/knowledge-graph/KnowledgeGraphMinimap";
import { KnowledgeGraphNode } from "@/features/knowledge-graph/KnowledgeGraphNode";
import { KnowledgeGraphOverlays } from "@/features/knowledge-graph/KnowledgeGraphOverlays";
import { KnowledgeGraphToolbar } from "@/features/knowledge-graph/KnowledgeGraphToolbar";
import type {
  AutoLinkAllResponse,
  AutoLinkSuggestion,
  ContextMenu,
  EdgeLabelEdit,
  GraphData,
  KEdge,
  KNode,
  NodeType,
} from "@/features/knowledge-graph/knowledgeGraphTypes";
import { computeFitView } from "@/features/knowledge-graph/knowledgeGraphUtils";
import { KnowledgeNodeEditor as NodeEditor } from "@/features/knowledge-graph/KnowledgeNodeEditor";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import {
  Check,
  Loader2,
  Maximize2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

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
  const creatingType: NodeType = "note";
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
    ? (data.nodes.find((n) => n.id === contextMenu.nodeId) ?? null)
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

      <KnowledgeGraphToolbar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        chatOpen={chatOpen}
        onToggleChat={() => {
          setChatOpen((v) => !v);
          if (!chatOpen) setSelectedId(null);
        }}
        autoLinkingAll={autoLinkingAll}
        nodesCount={data.nodes.length}
        importing={importing}
        onAutoLinkAll={handleAutoLinkAll}
        onAddNode={handleAddNode}
        onImportClick={() => fileInputRef.current?.click()}
      />

      <KnowledgeGraphOverlays
        linkMode={linkMode}
        onCancelLinkMode={() => setLinkMode(null)}
        nodes={data.nodes}
        autoLinkSuggestions={autoLinkSuggestions}
        autoLinkSourceId={autoLinkSourceId}
        onCreateEdge={handleCreateEdge}
        onSetAutoLinkSuggestions={setAutoLinkSuggestions}
        onSetAutoLinkSourceId={setAutoLinkSourceId}
        pendingEdge={pendingEdge}
        edgeLabelDraft={edgeLabelDraft}
        onSetPendingEdge={setPendingEdge}
        onSetEdgeLabelDraft={setEdgeLabelDraft}
        contextMenu={contextMenu}
        ctxNode={ctxNode}
        onSelectNode={setSelectedId}
        onSetContextMenu={setContextMenu}
        onStartLink={(nodeId) => setLinkMode({ sourceId: nodeId })}
        onDuplicateNode={handleDuplicateNode}
        onDeleteNode={handleDeleteNode}
      />

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
                {filteredNodes.map((n) => (
                  <KnowledgeGraphNode
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

            <KnowledgeGraphMinimap
              nodes={data.nodes}
              view={view}
              svgRef={svgRef}
              onPan={handleMinimapPan}
            />

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
