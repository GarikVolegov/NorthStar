import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Plus, Save, Trash2, Link2, X, Search, Sparkles, Loader2,
  StickyNote, Lightbulb, FileText, Target, Briefcase, Wrench, Award,
  Network, Globe, MessageCircleQuestion, Send, ChevronRight,
  Upload, Wand2, Check, AlertCircle,
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

interface AutoLinkSuggestion {
  id: number;
  title: string;
  type: NodeType;
  score: number;
}

const TYPE_META: Record<NodeType, { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<{ className?: string }> }> = {
  note:          { label: "Nota",          color: "#0891b2", bg: "#ecfeff", border: "#67e8f9", Icon: StickyNote },
  skill:         { label: "Competenza",    color: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", Icon: Lightbulb },
  document:      { label: "Documento",     color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", Icon: FileText },
  sector:        { label: "Settore",       color: "#1a3a2a", bg: "#f0fdf4", border: "#86efac", Icon: Target },
  role:          { label: "Ruolo",         color: "#6366f1", bg: "#eef2ff", border: "#a5b4fc", Icon: Briefcase },
  tool:          { label: "Strumento",     color: "#ea580c", bg: "#fff7ed", border: "#fdba74", Icon: Wrench },
  certification: { label: "Certificazione", color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd", Icon: Award },
  concept:       { label: "Idea",          color: "#db2777", bg: "#fdf2f8", border: "#f9a8d4", Icon: Network },
  link:          { label: "Link",          color: "#0284c7", bg: "#f0f9ff", border: "#7dd3fc", Icon: Globe },
};

const ALL_TYPES: NodeType[] = ["note", "skill", "document", "role", "tool", "certification", "concept", "link"];

function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch(`${BASE}api/knowledge${path}`, init).then(async (r) => {
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

export default function Archivio() {
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

  // File import state
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-link suggestions
  const [autoLinkSuggestions, setAutoLinkSuggestions] = useState<AutoLinkSuggestion[]>([]);
  const [autoLinkSourceId, setAutoLinkSourceId] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);

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
  const pendingPositions = useRef<Map<number, { x: number; y: number }>>(new Map());
  const flushTimer = useRef<number | null>(null);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const panState = useRef<{ startX: number; startY: number; vx: number; vy: number } | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const g = await api<GraphData>("/graph");
      setData(g);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { setLoading(false); return; }
    void loadGraph();
  }, [authReady, user, loadGraph]);

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

  const queuePosition = useCallback((id: number, x: number, y: number) => {
    pendingPositions.current.set(id, { x, y });
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(flushPositions, 600);
  }, [flushPositions]);

  useEffect(() => () => flushPositions(), [flushPositions]);

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

  // ── Fetch auto-link suggestions after node create/import ────────────────
  const fetchAutoLinks = useCallback(async (nodeId: number) => {
    try {
      const suggestions = await api<AutoLinkSuggestion[]>(`/nodes/${nodeId}/auto-link`, {
        method: "POST",
      });
      if (suggestions.length > 0) {
        setAutoLinkSuggestions(suggestions);
        setAutoLinkSourceId(nodeId);
      }
    } catch {
      // auto-link is best-effort, silent on failure
    }
  }, []);

  // ── File import ─────────────────────────────────────────────────────────
  const handleFileImport = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch(`${BASE}api/knowledge/import`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json() as KNode;
      setData((d) => ({ ...d, nodes: [...d.nodes, created] }));
      setSelectedId(created.id);
      // Trigger auto-link suggestions for the imported node
      void fetchAutoLinks(created.id);
    } catch (err) {
      console.error("[archivio] import failed", err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchAutoLinks]);

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
      void fetchAutoLinks(created.id);
    } catch (err) {
      console.error("[archivio] create node failed", err);
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
      console.error("[archivio] update node failed", err);
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
      console.error("[archivio] delete failed", err);
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
      console.error("[archivio] edge failed", err);
    }
  }

  async function handleDeleteEdge(id: number) {
    try {
      await api(`/edges/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    } catch (err) {
      console.error("[archivio] edge delete failed", err);
    }
  }

  // ── Drag (zero-rerender DOM mutation strategy) ──────────────────────────
  function onNodePointerDown(e: React.PointerEvent, n: KNode) {
    e.stopPropagation();
    if (linkMode) {
      if (linkMode.sourceId === n.id) { setLinkMode(null); return; }
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
      id: n.id, offsetX: px - n.x, offsetY: py - n.y,
      moved: false, x: n.x, y: n.y,
      el: e.currentTarget as SVGGElement,
    };
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    const pan = panState.current;
    if (drag) {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      const cx = e.clientX; const cy = e.clientY;
      rafId.current = requestAnimationFrame(() => {
        if (!drag || !svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const v = viewRef.current;
        const newX = (cx - svgRect.left - v.x) / v.k - drag.offsetX;
        const newY = (cy - svgRect.top - v.y) / v.k - drag.offsetY;
        drag.moved = true; drag.x = newX; drag.y = newY;
        if (drag.el) drag.el.setAttribute("transform", `translate(${newX},${newY})`);
        if (svgRef.current) {
          svgRef.current.querySelectorAll<SVGLineElement>(`line[data-source="${drag.id}"]`)
            .forEach((l) => { l.setAttribute("x1", String(newX)); l.setAttribute("y1", String(newY)); });
          svgRef.current.querySelectorAll<SVGLineElement>(`line[data-target="${drag.id}"]`)
            .forEach((l) => { l.setAttribute("x2", String(newX)); l.setAttribute("y2", String(newY)); });
          svgRef.current.querySelectorAll<SVGTextElement>(
            `text[data-edge-mid-source="${drag.id}"],text[data-edge-mid-target="${drag.id}"]`
          ).forEach((txt) => {
            const ox = parseFloat(txt.getAttribute("data-other-x") ?? "0");
            const oy = parseFloat(txt.getAttribute("data-other-y") ?? "0");
            txt.setAttribute("x", String((newX + ox) / 2));
            txt.setAttribute("y", String((newY + oy) / 2 - 4));
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
    if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    if (!drag) return;
    if (!drag.moved) {
      setSelectedId(n.id);
    } else {
      setData((d) => ({
        ...d,
        nodes: d.nodes.map((nd) => (nd.id === drag.id ? { ...nd, x: drag.x, y: drag.y } : nd)),
      }));
      queuePosition(drag.id, drag.x, drag.y);
    }
    e.stopPropagation();
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    panState.current = { startX: e.clientX, startY: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    setSelectedId(null);
    setLinkMode(null);
  }

  function onSvgPointerUp() { panState.current = null; }

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
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-3xl">📚</div>
        <h2 className="text-2xl font-serif font-bold mb-3">Accesso richiesto</h2>
        <p className="text-muted-foreground mb-8">
          Registrati per costruire il tuo Archivio personale: note, competenze, documenti e tutto quello che impari, connesso e sempre a portata di mano.
        </p>
        <Button asChild><Link href="/registra">Registrati gratis</Link></Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">

      {/* Hidden file input */}
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b bg-card/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" asChild>
          <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>

        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Network className="w-3.5 h-3.5 text-primary" />
          </div>
          <h1 className="font-serif font-bold text-lg">Il tuo Archivio</h1>
        </div>

        <div className="relative flex-1 min-w-[160px] max-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca…"
            className="h-8 pl-8 text-sm rounded-xl"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NodeType | "all")}
          className="h-8 rounded-xl border border-border bg-background px-2 text-xs"
        >
          <option value="all">Tutti</option>
          {ALL_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Chat toggle — icon only */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={chatOpen ? "default" : "outline"}
                className="rounded-xl h-8 w-8"
                onClick={() => { setChatOpen((v) => !v); if (!chatOpen) setSelectedId(null); }}
              >
                <MessageCircleQuestion className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chiedi all'Archivio</TooltipContent>
          </Tooltip>

          {/* Import file */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-8 gap-1.5"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{importing ? "Importando…" : "Importa"}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Importa PDF, testo, immagine</TooltipContent>
          </Tooltip>

          {/* New node — type picker + button */}
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
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuovo
          </Button>
        </div>
      </div>

      {/* Link mode hint */}
      {linkMode && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <span>
            <Link2 className="w-3.5 h-3.5 inline mr-1" />
            Modalità collegamento — clicca un altro elemento per collegarlo a «
            {data.nodes.find((n) => n.id === linkMode.sourceId)?.title}»
          </span>
          <button onClick={() => setLinkMode(null)} className="text-amber-900 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Auto-link suggestions banner */}
      {autoLinkSuggestions.length > 0 && autoLinkSourceId !== null && (
        <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-3 flex-wrap">
          <Wand2 className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-xs font-medium text-violet-900">
            {autoLinkSuggestions.length} collegament{autoLinkSuggestions.length === 1 ? "o suggerito" : "i suggeriti"} automaticamente:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {autoLinkSuggestions.map((s) => {
              const meta = TYPE_META[s.type] ?? TYPE_META.note;
              return (
                <div key={s.id} className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      await handleCreateEdge(autoLinkSourceId, s.id);
                      setAutoLinkSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                      if (autoLinkSuggestions.length === 1) setAutoLinkSourceId(null);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: meta.bg, color: meta.color, borderColor: meta.border }}
                    title={`Affinità ${Math.round(s.score * 100)}%`}
                  >
                    <Check className="w-2.5 h-2.5" />
                    {s.title}
                    <span className="opacity-60">{Math.round(s.score * 100)}%</span>
                  </button>
                  <button
                    onClick={() => {
                      setAutoLinkSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                      if (autoLinkSuggestions.length === 1) setAutoLinkSourceId(null);
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
            onClick={() => { setAutoLinkSuggestions([]); setAutoLinkSourceId(null); }}
          >
            Ignora tutti
          </button>
        </div>
      )}

      {/* Pending edge label dialog */}
      {pendingEdge && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setPendingEdge(null)}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Etichetta collegamento</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {data.nodes.find((n) => n.id === pendingEdge.sourceId)?.title} →{" "}
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
                  setPendingEdge(null); setEdgeLabelDraft("");
                }
              }}
              className="rounded-xl"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={() => setPendingEdge(null)}>Annulla</Button>
              <Button size="sm" onClick={async () => {
                await handleCreateEdge(pendingEdge.sourceId, pendingEdge.targetId, edgeLabelDraft);
                setPendingEdge(null); setEdgeLabelDraft("");
              }}>Collega</Button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Mobile list */}
        {isMobile && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-3 mb-2">
              <span className="text-lg leading-none shrink-0">🖥️</span>
              <p>Per l'esperienza completa con drag & drop, apri da desktop.</p>
            </div>
            {data.nodes.length === 0 ? (
              <EmptyState onAdd={handleAddNode} onImport={() => fileInputRef.current?.click()} />
            ) : (
              filteredNodes.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.Icon;
                const connections = data.edges.filter((e) => e.sourceId === n.id || e.targetId === n.id).length;
                return (
                  <div key={n.id} className="rounded-xl border bg-card p-4 flex items-start gap-3" onClick={() => setSelectedId(n.id)}>
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

        {/* SVG canvas — desktop */}
        {!isMobile && (
          <div className="flex-1 relative bg-[radial-gradient(circle,#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] overflow-hidden">
            {data.nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <EmptyState onAdd={handleAddNode} onImport={() => fileInputRef.current?.click()} />
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
                {/* Subtle drop-shadow filter for nodes */}
                <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000015" />
                </filter>
              </defs>
              <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                {/* Edges */}
                {visibleEdges.map((edge) => {
                  const a = data.nodes.find((n) => n.id === edge.sourceId);
                  const b = data.nodes.find((n) => n.id === edge.targetId);
                  if (!a || !b) return null;
                  const dimmed = selectedId != null && selectedId !== a.id && selectedId !== b.id;
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;
                  return (
                    <g key={edge.id} opacity={dimmed ? 0.15 : 0.9}>
                      <line
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke="#94a3b8" strokeWidth={1.4}
                        markerEnd="url(#arrow)"
                        data-source={edge.sourceId}
                        data-target={edge.targetId}
                      />
                      {edge.label && (
                        <text
                          x={mx} y={my - 4}
                          textAnchor="middle" fontSize={9} fill="#64748b"
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
                  const r = Math.max(28, Math.min(52, 22 + n.title.length * 0.55));
                  const isSelected = selectedId === n.id;
                  const isLinkSrc = linkMode?.sourceId === n.id;
                  const labelW = Math.min(80, 16 + meta.label.length * 5.5);
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      style={{ cursor: linkMode ? "crosshair" : "grab" }}
                      onPointerDown={(e) => onNodePointerDown(e, n)}
                      onPointerUp={(e) => onNodePointerUp(e, n)}
                    >
                      {/* Drop shadow circle */}
                      <circle
                        r={r}
                        fill={n.color || meta.bg}
                        stroke={isSelected || isLinkSrc ? meta.color : meta.border}
                        strokeWidth={isSelected || isLinkSrc ? 2.5 : 1.5}
                        filter="url(#node-shadow)"
                      />
                      {/* Title */}
                      <text
                        textAnchor="middle" y={4}
                        fontSize={11} fontWeight={600} fill={meta.color}
                        style={{ pointerEvents: "none" }}
                      >
                        {n.title.length > 20 ? n.title.slice(0, 19) + "…" : n.title}
                      </text>
                      {/* Type pill */}
                      <rect
                        x={-labelW / 2} y={r + 5}
                        width={labelW} height={14}
                        rx={7} fill={meta.bg}
                        stroke={meta.border} strokeWidth={1}
                      />
                      <text
                        textAnchor="middle" y={r + 15}
                        fontSize={8} fontWeight={500} fill={meta.color}
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
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 bg-card/90 backdrop-blur border rounded-xl shadow-sm p-1">
              <button onClick={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold">+</button>
              <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))} className="w-7 h-7 rounded-lg hover:bg-muted text-sm font-bold">−</button>
              <button onClick={() => setView({ x: 0, y: 0, k: 1 })} className="w-7 h-7 rounded-lg hover:bg-muted text-[10px] font-semibold" title="Reset vista">⌂</button>
            </div>

            {/* Stats badge */}
            <div className="absolute top-3 left-3 flex gap-2">
              <Badge variant="outline" className="text-[10px] bg-card/80 backdrop-blur">
                {filteredNodes.length} elementi
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-card/80 backdrop-blur">
                {visibleEdges.length} collegamenti
              </Badge>
            </div>
          </div>
        )}

        {/* Side panel */}
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
            onFocusNode={(id) => { setChatOpen(false); setSelectedId(id); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd, onImport }: { onAdd: (type?: NodeType) => void; onImport: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 text-3xl">📚</div>
      <h2 className="font-serif font-bold text-xl mb-2">Il tuo Archivio è vuoto</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Qui raccoglierai tutto quello che impari: note, competenze, documenti, idee.
        Ogni elemento si collega agli altri — costruisci la mappa del tuo percorso.
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
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: m.bg }}>
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
}

// ── RAG chat panel ───────────────────────────────────────────────────────────
interface Citation { id: number; title: string; type: NodeType; score?: number }
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  neighbors?: Citation[];
  status?: string;
  error?: string;
}
interface ChatPanelProps { nodes: KNode[]; onClose: () => void; onFocusNode: (id: number) => void }

function ChatPanel({ nodes, onClose, onFocusNode }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      const res = await apiFetch(`${BASE}api/knowledge/ask`, { method: "POST", body: JSON.stringify({ question: q }) });
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
              if (data.content) next[next.length - 1] = { ...last, content: last.content + data.content, status: undefined };
              else if (data.status) next[next.length - 1] = { ...last, status: data.status };
              else if (data.citations) next[next.length - 1] = { ...last, citations: data.citations, neighbors: data.neighbors };
              else if (data.error) next[next.length - 1] = { ...last, error: data.error, status: undefined };
              return next;
            });
          } catch { /* malformed sse */ }
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last.role === "assistant") next[next.length - 1] = { ...last, error: err instanceof Error ? err.message : "Errore di rete", status: undefined };
        return next;
      });
    }
    setBusy(false);
  }

  function renderAnswer(content: string, citations?: Citation[]) {
    const parts: React.ReactNode[] = [];
    const regex = /\[#(\d+)\]/g;
    let lastIndex = 0; let match: RegExpExecArray | null; let key = 0;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
      const id = Number(match[1]);
      const node = nodes.find((n) => n.id === id);
      const cite = citations?.find((c) => c.id === id);
      const label = node?.title ?? cite?.title ?? `#${id}`;
      parts.push(
        <button key={`c-${key++}`} onClick={() => onFocusNode(id)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 align-baseline"
          title={`Vai all'elemento ${label}`}>{label}</button>,
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
    "Quali elementi sono più connessi tra loro?",
  ];

  return (
    <aside className="w-full max-w-md border-l bg-card flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <MessageCircleQuestion className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assistente</p>
          <p className="text-sm font-semibold truncate">Chiedi all'Archivio</p>
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
            <p className="text-sm font-semibold mb-1">Interroga il tuo Archivio</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              L'AI legge tutti i tuoi elementi, considera i collegamenti e risponde
              basandosi solo su quello che hai salvato. {nodes.length} elementi disponibili.
            </p>
            <div className="space-y-1.5 text-left">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setQuestion(s)}
                  className="w-full text-left px-3 py-2 rounded-lg border bg-background hover:border-primary/40 hover:bg-primary/5 text-xs transition-colors flex items-center gap-2">
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
                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">{m.content}</div>
              </div>
            ) : (
              <div className="space-y-2">
                {m.citations && m.citations.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Elementi usati</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.citations.map((c) => {
                        const meta = TYPE_META[c.type] ?? TYPE_META.note;
                        return (
                          <button key={c.id} onClick={() => onFocusNode(c.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] hover:opacity-80"
                            style={{ backgroundColor: meta.bg, color: meta.color, borderColor: meta.border }}
                            title={`Affinità ${c.score ? Math.round(c.score * 100) : 0}%`}>
                            <meta.Icon className="w-2.5 h-2.5" />
                            <span className="font-medium">{c.title}</span>
                            {c.score !== undefined && <span className="opacity-70">{Math.round(c.score * 100)}%</span>}
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
                      {m.status === "embedding" && "Analizzo il contenuto…"}
                      {m.status === "retrieving" && "Cerco gli elementi più rilevanti…"}
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            placeholder="Chiedimi qualcosa sul tuo percorso…"
            rows={2}
            className="rounded-xl text-sm resize-none flex-1"
            disabled={busy}
          />
          <Button size="icon" className="rounded-xl h-9 w-9 shrink-0" disabled={busy || !question.trim()} onClick={() => void ask()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">↵ invia · Shift+↵ vai a capo</p>
      </div>
    </aside>
  );
}

// ── Node editor side panel ───────────────────────────────────────────────────
interface NodeEditorProps {
  node: KNode; edges: KEdge[]; allNodes: KNode[];
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
    setTitle(node.title); setContent(node.content);
    setType(node.type); setUrl(node.url ?? "");
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = title !== node.title || content !== node.content || type !== node.type || (url || "") !== (node.url || "");

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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: meta.bg, color: meta.color }}>
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
                <button key={t} onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors",
                    type === t ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary/40",
                  )}>
                  <TI className="w-3 h-3" />{m.label}
                </button>
              );
            })}
          </div>
        </div>
        {(type === "link" || type === "document") && (
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="rounded-xl" />
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
            <label className="text-[11px] font-medium text-muted-foreground">Collegamenti ({edges.length})</label>
            <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={onStartLink}>
              <Link2 className="w-3 h-3 mr-1" /> Collega…
            </Button>
          </div>
          <div className="space-y-1">
            {edges.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun collegamento ancora.</p>}
            {edges.map((e) => {
              const otherId = e.sourceId === node.id ? e.targetId : e.sourceId;
              const other = allNodes.find((n) => n.id === otherId);
              if (!other) return null;
              const m = TYPE_META[other.type] ?? TYPE_META.note;
              const direction = e.sourceId === node.id ? "→" : "←";
              return (
                <div key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-background text-xs">
                  <span className="text-muted-foreground">{direction}</span>
                  <span className="px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: m.bg, color: m.color }}>{other.title}</span>
                  {e.label && <span className="text-muted-foreground italic">— {e.label}</span>}
                  <button onClick={() => onDeleteEdge(e.id)} className="ml-auto text-muted-foreground hover:text-destructive">
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
            <Button size="sm" variant="destructive" onClick={onDelete} className="rounded-xl">Conferma elimina</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} className="rounded-xl">Annulla</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Elimina
          </Button>
        )}
        <Button size="sm" className="rounded-xl ml-auto" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          Salva
        </Button>
      </div>
    </aside>
  );
}
