import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Plus, Save, Trash2, Link2, X, Search, Sparkles, Loader2,
  StickyNote, Lightbulb, FileText, Target, Briefcase, Wrench, Award, Network, Globe,
  MessageCircleQuestion, Send, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

type NodeType = "note" | "skill" | "document" | "sector" | "role" | "tool" | "certification" | "concept" | "link";

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

const TYPE_META: Record<NodeType, { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  note:          { label: "Nota",          color: "#0891b2", bg: "#ecfeff", border: "#67e8f9", Icon: StickyNote },
  skill:         { label: "Competenza",    color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", Icon: Lightbulb },
  document:      { label: "Documento",     color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", Icon: FileText },
  sector:        { label: "Settore",       color: "#1a3a2a", bg: "#f0fdf4", border: "#86efac", Icon: Target },
  role:          { label: "Ruolo",         color: "#6366f1", bg: "#eef2ff", border: "#a5b4fc", Icon: Briefcase },
  tool:          { label: "Strumento",     color: "#ea580c", bg: "#fff7ed", border: "#fdba74", Icon: Wrench },
  certification: { label: "Certificazione", color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd", Icon: Award },
  concept:       { label: "Concetto",      color: "#db2777", bg: "#fdf2f8", border: "#f9a8d4", Icon: Network },
  link:          { label: "Link",          color: "#0284c7", bg: "#f0f9ff", border: "#7dd3fc", Icon: Globe },
};

const ALL_TYPES: NodeType[] = ["note", "skill", "document", "role", "tool", "certification", "concept", "link"];

function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch(`${BASE}api/knowledge${path}`, init).then(async (r) => {
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

export default function GrafoConoscenza() {
  const { user, authReady } = useAuth();

  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [linkMode, setLinkMode] = useState<{ sourceId: number } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<NodeType | "all">("all");
  const [edgeLabelDraft, setEdgeLabelDraft] = useState("");
  const [pendingEdge, setPendingEdge] = useState<{ sourceId: number; targetId: number } | null>(null);
  const [creatingType, setCreatingType] = useState<NodeType>("note");
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * dragState: tracks the active drag operation.
   * We deliberately keep live x/y OUT of React state to avoid re-rendering
   * the entire node list on every pointermove. Instead we mutate the SVG DOM
   * directly via setAttribute inside a requestAnimationFrame loop.
   */
  const dragState = useRef<{
    id: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    x: number;      // live position during drag
    y: number;
    el: SVGGElement | null; // reference to the <g> being dragged
  } | null>(null);

  /** Pending rAF id — cancelled on pointerup to avoid stale frames. */
  const rafId = useRef<number | null>(null);

  /** Node positions waiting to be flushed to the server. */
  const pendingPositions = useRef<Map<number, { x: number; y: number }>>(new Map());
  const flushTimer = useRef<number | null>(null);

  // ── Pan / zoom ──────────────────────────────────────────────────────────
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const panState = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);

  // ── Load graph on mount ─────────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api<GraphData>("/graph");
      setData(g);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadGraph();
  }, [authReady, user, loadGraph]);

  // ── Persist position changes (debounced) ────────────────────────────────
  const flushPositions = useCallback(() => {
    const map = pendingPositions.current;
    if (map.size === 0) return;
    const positions = Array.from(map.entries()).map(([id, p]) => ({ id, x: p.x, y: p.y }));
    pendingPositions.current = new Map();
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

  // ── Filtering / search ──────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.nodes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (q && !`${n.title} ${n.content}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.nodes, search, typeFilter]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const visibleEdges = useMemo(
    () => data.edges.filter((e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)),
    [data.edges, visibleIds],
  );

  const selected = useMemo(
    () => (selectedId == null ? null : data.nodes.find((n) => n.id === selectedId) ?? null),
    [data.nodes, selectedId],
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  async function handleAddNode(type: NodeType = creatingType) {
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
        body: JSON.stringify({ type, title: TYPE_META[type].label + " senza titolo", x, y }),
      });
      setData((d) => ({ ...d, nodes: [...d.nodes, created] }));
      setSelectedId(created.id);
    } catch (err) {
      console.error("[grafo] create node failed", err);
    }
  }

  async function handleUpdateNode(id: number, patch: Partial<KNode>) {
    try {
      const updated = await api<KNode>(`/nodes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? updated : n)) }));
    } catch (err) {
      console.error("[grafo] update node failed", err);
    }
  }

  async function handleDeleteNode(id: number) {
    try {
      await api(`/nodes/${id}`, { method: "DELETE" });
      setData((d) => ({
        nodes: d.nodes.filter((n) => n.id !== id),
        edges: d.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
      }));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      console.error("[grafo] delete failed", err);
    }
  }

  async function handleCreateEdge(sourceId: number, targetId: number, label?: string) {
    if (sourceId === targetId) return;
    if (data.edges.some((e) => e.sourceId === sourceId && e.targetId === targetId)) return;
    try {
      const created = await api<KEdge>("/edges", {
        method: "POST",
        body: JSON.stringify({ sourceId, targetId, label: label?.trim() || undefined }),
      });
      setData((d) => ({ ...d, edges: [...d.edges, created] }));
    } catch (err) {
      console.error("[grafo] edge failed", err);
    }
  }

  async function handleDeleteEdge(id: number) {
    try {
      await api(`/edges/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    } catch (err) {
      console.error("[grafo] edge delete failed", err);
    }
  }

  // ── Drag handling (graph nodes) ─────────────────────────────────────────
  //
  // Strategy: DOM-direct mutation during drag, single React state commit on up.
  //
  // Why: setData() on every pointermove rebuilds the full nodes array (O(n))
  // and triggers a React diff + SVG repaint at 60fps — catastrophic for large
  // graphs. Instead:
  //   1. onPointerDown: capture the dragged <g> element + compute offset
  //   2. onPointerMove: schedule RAF; inside RAF mutate ONLY the <g>.transform
  //      and update edge endpoints via querySelectorAll — zero React overhead
  //   3. onPointerUp: write the final coords to React state (1 render total)
  //      and queue the server persist

  function onNodePointerDown(e: React.PointerEvent, n: KNode) {
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

    // Find the <g> element that owns this node
    const gEl = (e.currentTarget as SVGGElement);

    dragState.current = {
      id: n.id,
      offsetX: px - n.x,
      offsetY: py - n.y,
      moved: false,
      x: n.x,
      y: n.y,
      el: gEl,
    };
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const pan = panState.current;
    const drag = dragState.current;

    if (drag) {
      // Cancel any pending RAF — we'll schedule a fresh one
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      // Capture clientX/Y before the async RAF callback
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

        // Mutate the dragged node's SVG <g> transform directly — no React render
        if (drag.el) {
          drag.el.setAttribute("transform", `translate(${newX},${newY})`);
        }

        // Update connected edge endpoints in the DOM directly.
        // Edges are <line> elements with data-source / data-target attributes.
        if (svgRef.current) {
          svgRef.current
            .querySelectorAll<SVGLineElement>(`line[data-source="${drag.id}"]`)
            .forEach((line) => {
              line.setAttribute("x1", String(newX));
              line.setAttribute("y1", String(newY));
            });
          svgRef.current
            .querySelectorAll<SVGLineElement>(`line[data-target="${drag.id}"]`)
            .forEach((line) => {
              line.setAttribute("x2", String(newX));
              line.setAttribute("y2", String(newY));
            });
          // Update midpoint label positions for edges connected to this node
          svgRef.current
            .querySelectorAll<SVGTextElement>(`text[data-edge-mid-source="${drag.id}"],text[data-edge-mid-target="${drag.id}"]`)
            .forEach((txt) => {
              const otherX = parseFloat(txt.getAttribute("data-other-x") ?? "0");
              const otherY = parseFloat(txt.getAttribute("data-other-y") ?? "0");
              txt.setAttribute("x", String((newX + otherX) / 2));
              txt.setAttribute("y", String((newY + otherY) / 2 - 4));
            });
        }
      });
    } else if (pan) {
      setView({ x: pan.vx + (e.clientX - pan.startX), y: pan.vy + (e.clientY - pan.startY), k: viewRef.current.k });
    }
  }

  function onNodePointerUp(e: React.PointerEvent, n: KNode) {
    const drag = dragState.current;
    dragState.current = null;

    // Cancel any pending rAF
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    if (!drag) return;

    if (!drag.moved) {
      // Plain click (no movement) → select the node
      setSelectedId(n.id);
    } else {
      // Drag ended — commit final position to React state (single render)
      // and queue the server persist.
      const finalX = drag.x;
      const finalY = drag.y;
      setData((d) => ({
        ...d,
        nodes: d.nodes.map((nd) => (nd.id === drag.id ? { ...nd, x: finalX, y: finalY } : nd)),
      }));
      queuePosition(drag.id, finalX, finalY);
    }
    e.stopPropagation();
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    panState.current = { startX: e.clientX, startY: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    setSelectedId(null);
    setLinkMode(null);
  }

  function onSvgPointerUp() {
    panState.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const v = viewRef.current;
    const newK = Math.max(0.3, Math.min(2.5, v.k * (1 + delta)));
    const svgRect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - svgRect.left;
    const my = e.clientY - svgRect.top;
    const ratio = newK / v.k;
    setView({ x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio, k: newK });
  }

  // ── Auto-layout when nodes have no positions yet ────────────────────────
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

  // ── Guard ──────────────────────────────────────────────────────────────
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
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-3xl">🖧️</div>
        <h2 className="text-2xl font-serif font-bold mb-3">Accesso richiesto</h2>
        <p className="text-muted-foreground mb-8">
          Registrati per costruire il tuo grafo personale di note, competenze e documenti.
        </p>
        <Button asChild>
          <Link href="/registra">Registrati gratis</Link>
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b bg-card/50">
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" asChild>
          <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-2 mr-2">
          <Network className="w-4 h-4 text-primary" />
          <h1 className="font-serif font-bold text-lg">Grafo della Conoscenza</h1>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca nodi…"
            className="h-8 pl-8 text-sm rounded-xl"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NodeType | "all")}
          className="h-8 rounded-xl border border-border bg-background px-2 text-xs"
        >
          <option value="all">Tutti i tipi</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={creatingType}
            onChange={(e) => setCreatingType(e.target.value as NodeType)}
            className="h-8 rounded-xl border border-border bg-background px-2 text-xs"
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <Button size="sm" className="rounded-xl h-8" onClick={() => handleAddNode()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo nodo
          </Button>
          <Button
            size="sm"
            variant={chatOpen ? "default" : "outline"}
            className="rounded-xl h-8"
            onClick={() => {
              setChatOpen((v) => !v);
              if (!chatOpen) setSelectedId(null);
            }}
          >
            <MessageCircleQuestion className="w-3.5 h-3.5 mr-1" /> Chiedi al grafo
          </Button>
        </div>
      </div>

      {/* Hint when in link mode */}
      {linkMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <span>
            <Link2 className="w-3.5 h-3.5 inline mr-1" />
            Modalità collegamento — clicca un altro nodo per collegarlo a “
            {data.nodes.find((n) => n.id === linkMode.sourceId)?.title}”
          </span>
          <button onClick={() => setLinkMode(null)} className="text-amber-900 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending edge label dialog */}
      {pendingEdge && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setPendingEdge(null)}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Etichetta collegamento</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {data.nodes.find((n) => n.id === pendingEdge.sourceId)?.title} {"→"}{" "}
              {data.nodes.find((n) => n.id === pendingEdge.targetId)?.title}
            </p>
            <Input
              autoFocus
              placeholder="es. richiede, usa, simile a…"
              value={edgeLabelDraft}
              onChange={(e) => setEdgeLabelDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await handleCreateEdge(pendingEdge.sourceId, pendingEdge.targetId, edgeLabelDraft);
                  setPendingEdge(null);
                  setEdgeLabelDraft("");
                }
              }}
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={() => setPendingEdge(null)}>Annulla</Button>
              <Button
                size="sm"
                onClick={async () => {
                  await handleCreateEdge(pendingEdge.sourceId, pendingEdge.targetId, edgeLabelDraft);
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

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile fallback — list view */}
        {isMobile && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-3 mb-2">
              <span className="text-lg leading-none shrink-0">🖥️</span>
              <p>Per l’esperienza completa con drag & drop, apri da desktop.</p>
            </div>
            {data.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 gap-4 px-6">
                <span className="text-5xl">🕸️</span>
                <h2 className="font-serif text-xl font-bold">Il tuo spazio di conoscenza è vuoto</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Aggiungi note, skill, certificazioni e documenti. Collegali tra loro per vedere come si costruisce il tuo percorso professionale.
                </p>
                <Button onClick={() => handleAddNode("note")} className="rounded-full">
                  <Plus className="w-4 h-4 mr-2" /> Aggiungi il primo nodo
                </Button>
              </div>
            ) : (
              filteredNodes.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.Icon;
                const connections = data.edges.filter((e) => e.sourceId === n.id || e.targetId === n.id).length;
                return (
                  <div
                    key={n.id}
                    className="rounded-xl border bg-card p-4 flex items-start gap-3"
                    onClick={() => setSelectedId(n.id)}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground text-right">
                      <span className="block font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      <span>{connections} link</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SVG canvas — desktop only */}
        {!isMobile && (
        <div className="flex-1 relative bg-[radial-gradient(circle,#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] overflow-hidden">
          {data.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <span className="text-5xl mb-4">🕸️</span>
              <h2 className="font-serif font-bold text-xl mb-2">Il tuo spazio di conoscenza è vuoto</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Aggiungi note, skill, certificazioni e documenti. Collegali tra loro
                per vedere come si costruisce il tuo percorso professionale.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(["note", "skill", "document"] as NodeType[]).map((t) => {
                  const m = TYPE_META[t];
                  const Icon = m.Icon;
                  return (
                    <Button key={t} variant="outline" className="rounded-xl" onClick={() => handleAddNode(t)}>
                      <Icon className="w-3.5 h-3.5 mr-1.5" />
                      {m.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full touch-none select-none"
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerLeave={onSvgPointerUp}
            onWheel={onWheel}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
              </marker>
            </defs>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {/* Edges — data-source/data-target attrs enable direct DOM update during drag */}
              {visibleEdges.map((edge) => {
                const a = data.nodes.find((n) => n.id === edge.sourceId);
                const b = data.nodes.find((n) => n.id === edge.targetId);
                if (!a || !b) return null;
                const dimmed =
                  selectedId != null && selectedId !== a.id && selectedId !== b.id;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                return (
                  <g key={edge.id} opacity={dimmed ? 0.2 : 0.85}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#94a3b8"
                      strokeWidth={1.4}
                      markerEnd="url(#arrow)"
                      data-source={edge.sourceId}
                      data-target={edge.targetId}
                    />
                    {edge.label && (
                      <text
                        x={mx}
                        y={my - 4}
                        textAnchor="middle"
                        fontSize={10}
                        fill="#64748b"
                        style={{ pointerEvents: "none" }}
                        data-edge-mid-source={edge.sourceId}
                        data-edge-mid-target={edge.targetId}
                        data-other-x={b.x}
                        data-other-y={b.y}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {filteredNodes.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.note;
                const r = Math.max(28, Math.min(54, 24 + n.title.length * 0.6));
                const isSelected = selectedId === n.id;
                const isLinkSrc = linkMode?.sourceId === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: linkMode ? "crosshair" : "grab" }}
                    onPointerDown={(e) => onNodePointerDown(e, n)}
                    onPointerUp={(e) => onNodePointerUp(e, n)}
                  >
                    <circle
                      r={r}
                      fill={n.color || meta.bg}
                      stroke={isSelected || isLinkSrc ? meta.color : meta.border}
                      strokeWidth={isSelected || isLinkSrc ? 3 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      y={4}
                      fontSize={12}
                      fontWeight={600}
                      fill={meta.color}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.title.length > 18 ? n.title.slice(0, 17) + "…" : n.title}
                    </text>
                    <text
                      textAnchor="middle"
                      y={r + 14}
                      fontSize={9}
                      fontWeight={500}
                      fill="#64748b"
                      style={{ pointerEvents: "none" }}
                    >
                      {meta.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-card border rounded-xl shadow-sm p-1">
            <button
              onClick={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))}
              className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold"
            >+</button>
            <button
              onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))}
              className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold"
            >−</button>
            <button
              onClick={() => setView({ x: 0, y: 0, k: 1 })}
              className="w-7 h-7 rounded-lg hover:bg-muted text-[10px] font-semibold"
              title="Reset vista"
            >⌂</button>
          </div>

          {/* Stats */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge variant="outline" className="text-[10px] bg-card/80 backdrop-blur">
              {filteredNodes.length} nodi
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-card/80 backdrop-blur">
              {visibleEdges.length} collegamenti
            </Badge>
          </div>
        </div>
        )}

        {/* Side panel (selected node) */}
        {selected && !chatOpen && (
          <NodeEditor
            key={selected.id}
            node={selected}
            edges={data.edges.filter((e) => e.sourceId === selected.id || e.targetId === selected.id)}
            allNodes={data.nodes}
            onClose={() => setSelectedId(null)}
            onSave={(patch) => handleUpdateNode(selected.id, patch)}
            onDelete={() => handleDeleteNode(selected.id)}
            onStartLink={() => setLinkMode({ sourceId: selected.id })}
            onDeleteEdge={(id) => handleDeleteEdge(id)}
          />
        )}

        {/* RAG chat panel */}
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

// ─── RAG chat panel ────────────────────────────────────────────

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

function ChatPanel({ nodes, onClose, onFocusNode }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);

    const userMsg: ChatMessage = { role: "user", content: q };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", status: "starting" };
    setMessages((m) => [...m, userMsg, assistantMsg]);

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
              if (data.content) {
                next[next.length - 1] = {
                  ...last,
                  content: last.content + data.content,
                  status: undefined,
                };
              } else if (data.status) {
                next[next.length - 1] = { ...last, status: data.status };
              } else if (data.citations) {
                next[next.length - 1] = {
                  ...last,
                  citations: data.citations,
                  neighbors: data.neighbors,
                };
              } else if (data.error) {
                next[next.length - 1] = {
                  ...last,
                  error: data.error,
                  status: undefined,
                };
              }
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
        if (last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            error: err instanceof Error ? err.message : "Errore di rete",
            status: undefined,
          };
        }
        return next;
      });
    }

    setBusy(false);
  }

  function renderAnswer(content: string, citations?: Citation[]) {
    const parts: React.ReactNode[] = [];
    const regex = /\[#(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      const id = Number(match[1]);
      const node = nodes.find((n) => n.id === id);
      const cite = citations?.find((c) => c.id === id);
      const label = node?.title ?? cite?.title ?? `#${id}`;
      parts.push(
        <button
          key={`c-${key++}`}
          onClick={() => onFocusNode(id)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 align-baseline"
          title={`Vai al nodo ${label}`}
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
    "Quali competenze ho già acquisito?",
    "Cosa mi manca per il ruolo che voglio?",
    "Riassumi i miei appunti su questo settore.",
    "Quali nodi sono più collegati tra loro?",
  ];

  return (
    <aside className="w-full max-w-md border-l bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircleQuestion className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">RAG</p>
          <p className="text-sm font-semibold truncate">Chiedi al tuo grafo</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold mb-1">Interroga il tuo grafo</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              L’AI cerca i nodi più rilevanti, considera i loro collegamenti e risponde solo
              in base ai tuoi appunti. {nodes.length} nodi disponibili.
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
                      Nodi rilevanti
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => {
                        const meta = TYPE_META[c.type] ?? TYPE_META.note;
                        return (
                          <button
                            key={c.id}
                            onClick={() => onFocusNode(c.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-80"
                            style={{ backgroundColor: meta.bg, color: meta.color, borderColor: meta.border }}
                            title={`Affinità ${c.score ? Math.round(c.score * 100) : 0}% — clicca per aprire`}
                          >
                            <meta.Icon className="w-2.5 h-2.5" />
                            <span className="font-medium">{c.title}</span>
                            {c.score !== undefined && (
                              <span className="opacity-70">{Math.round(c.score * 100)}%</span>
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
                      {m.status === "embedding" && "Calcolo embedding mancanti…"}
                      {m.status === "retrieving" && "Cerco i nodi più rilevanti…"}
                      {m.status === "answering" && "Sto rispondendo…"}
                      {m.status === "starting" && "Avvio…"}
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
            placeholder="Chiedi qualcosa sui tuoi nodi…"
            rows={2}
            className="rounded-xl text-sm resize-none flex-1"
            disabled={busy}
          />
          <Button
            size="icon"
            className="rounded-xl h-9 w-9 shrink-0"
            disabled={busy || !question.trim()}
            onClick={() => void ask()}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          ↵ per inviare · Shift+↵ per andare a capo
        </p>
      </div>
    </aside>
  );
}

// ── Side panel ────────────────────────────────────────────────────────────────────

interface NodeEditorProps {
  node: KNode;
  edges: KEdge[];
  allNodes: KNode[];
  onClose: () => void;
  onSave: (patch: Partial<KNode>) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onStartLink: () => void;
  onDeleteEdge: (id: number) => Promise<void> | void;
}

function NodeEditor({ node, edges, allNodes, onClose, onSave, onDelete, onStartLink, onDeleteEdge }: NodeEditorProps) {
  const [title, setTitle] = useState(node.title);
  const [content, setContent] = useState(node.content);
  const [type, setType] = useState<NodeType>(node.type);
  const [url, setUrl] = useState(node.url ?? "");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  async function save() {
    if (!dirty) return;
    setSaving(true);
    await onSave({ title: title.trim() || "Senza titolo", content, type, url: url.trim() || null });
    setSaving(false);
  }

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
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
          <p className="text-sm font-semibold truncate">{node.title}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Titolo</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Tipo</label>
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
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="rounded-xl"
            />
          </div>
        )}

        <div>
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Contenuto</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Appunti, descrizione, riferimenti…"
            rows={10}
            className="rounded-xl text-sm font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Markdown supportato</p>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">
              Collegamenti ({edges.length})
            </label>
            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={onStartLink}>
              <Link2 className="w-3 h-3 mr-1" /> Collega…
            </Button>
          </div>
          <div className="space-y-1">
            {edges.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nessun collegamento ancora.</p>
            )}
            {edges.map((e) => {
              const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
              const other = allNodes.find((n) => n.id === otherId);
              if (!other) return null;
              const m = TYPE_META[other.type] ?? TYPE_META.note;
              const direction = e.sourceId === node.id ? "→" : "←";
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
                  {e.label && <span className="text-muted-foreground italic">— {e.label}</span>}
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
            <Button size="sm" variant="destructive" onClick={onDelete} className="rounded-xl">
              Conferma elimina
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} className="rounded-xl">
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
          onClick={save}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Salva
        </Button>
      </div>
    </aside>
  );
}
