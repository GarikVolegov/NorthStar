import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { knowledgeApi as api } from "./knowledgeGraphApi";
import { computeFitView } from "./knowledgeGraphUtils";
import { apiFetch } from "@/lib/api-fetch";
import { TYPE_META } from "@/components/knowledge-graph/types";
import type {
  GraphData,
  NodeType,
  KNode,
  KEdge,
  AutoLinkSuggestion,
  AutoLinkAllResponse,
} from "./knowledgeGraphTypes";

const BASE = import.meta.env.BASE_URL || "/";

interface UseKnowledgeGraphDataProps {
  toast: (props: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewRef: React.MutableRefObject<{ x: number; y: number; k: number }>;
  setView: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
  setFitAnimating: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKnowledgeGraphData({
  toast,
  svgRef,
  viewRef,
  setView,
  setFitAnimating,
}: UseKnowledgeGraphDataProps) {
  const { user, authReady } = useAuth();

  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [importing, setImporting] = useState(false);
  const [autoLinkSuggestions, setAutoLinkSuggestions] = useState<AutoLinkSuggestion[]>([]);
  const [autoLinkSourceId, setAutoLinkSourceId] = useState<number | null>(null);
  const [autoLinkingAll, setAutoLinkingAll] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ nodeId: number; x: number; y: number } | null>(null);
  const [edgeLabelEdit, setEdgeLabelEdit] = useState<{
    edgeId: number;
    draft: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  const pendingPositions = useRef<Map<number, { x: number; y: number }>>(
    new globalThis.Map<number, { x: number; y: number }>()
  );
  const flushTimer = useRef<number | null>(null);

  const flushPositions = useCallback(() => {
    const map = pendingPositions.current;
    if (map.size === 0) return;
    const positions = Array.from(map.entries()).map(([id, p]) => ({
      id,
      x: p.x,
      y: p.y,
    }));
    pendingPositions.current = new globalThis.Map<number, { x: number; y: number }>();
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
    [flushPositions]
  );

  useEffect(() => () => flushPositions(), [flushPositions]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const g = await api<GraphData>("/graph");
      setData(g);
      if (g.nodes.length > 0 && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const fv = computeFitView(
          g.nodes,
          rect.width || window.innerWidth,
          rect.height || window.innerHeight - 64
        );
        setFitAnimating(true);
        setView(fv);
        viewRef.current = fv;
        setTimeout(() => setFitAnimating(false), 400);
      }
    } catch (err) {
      const message = errorMessage(err, "Errore di rete.");
      setLoadError(message);
      toast({
        title: "Archivio non caricato",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [setView, svgRef, setFitAnimating, toast, viewRef]);

  const handleFit = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const fv = computeFitView(data.nodes, rect.width, rect.height);
    setFitAnimating(true);
    setView(fv);
    viewRef.current = fv;
    setTimeout(() => setFitAnimating(false), 400);
  }, [data.nodes, svgRef, setView, setFitAnimating, viewRef]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadGraph();
  }, [authReady, user, loadGraph]);

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
    [filteredNodes]
  );
  
  const visibleEdges = useMemo(
    () =>
      data.edges.filter(
        (e) => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)
      ),
    [data.edges, visibleIds]
  );

  const selected = useMemo(
    () =>
      selectedId == null
        ? null
        : (data.nodes.find((n) => n.id === selectedId) ?? null),
    [data.nodes, selectedId]
  );

  const fetchAutoLinks = useCallback(async (nodeId: number) => {
    try {
      const suggestions = await api<AutoLinkSuggestion[]>(
        `/nodes/${nodeId}/auto-link`,
        { method: "POST" }
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
      }
    },
    [fetchAutoLinks, toast]
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
      } catch (err) {
        toast({
          title: "Creazione elemento fallita",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
      }
    },
    [creatingType, svgRef, toast, viewRef]
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
      } catch (err) {
        toast({
          title: "Salvataggio fallito",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
        throw err;
      }
    },
    [fetchAutoLinks, toast]
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
      } catch (err) {
        toast({
          title: "Eliminazione fallita",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
        throw err;
      }
    },
    [selectedId, toast]
  );

  const handleCreateEdge = useCallback(
    async (sourceId: number, targetId: number, label?: string) => {
      if (sourceId === targetId) return;
      if (
        data.edges.some(
          (e) => e.sourceId === sourceId && e.targetId === targetId
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
      } catch (err) {
        toast({
          title: "Collegamento fallito",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
        throw err;
      }
    },
    [data.edges, toast]
  );

  const handleDeleteEdge = useCallback(async (id: number) => {
    try {
      await api(`/edges/${id}`, { method: "DELETE" });
      setData((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    } catch (err) {
      toast({
        title: "Eliminazione collegamento fallita",
        description: errorMessage(err, "Errore di rete."),
        variant: "destructive",
      });
      throw err;
    }
  }, [toast]);

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
      } catch (err) {
        toast({
          title: "Etichetta non salvata",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
        throw err;
      }
    },
    [toast]
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
      } catch (err) {
        toast({
          title: "Duplicazione fallita",
          description: errorMessage(err, "Errore di rete."),
          variant: "destructive",
        });
      }
    },
    [data.nodes, toast]
  );

  // Auto-arrange nodes that are placed at (0, 0)
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
  }, [data.nodes.length, queuePosition]);

  return {
    user,
    authReady,
    data,
    setData,
    loading,
    loadError,
    selectedId,
    setSelectedId,
    linkMode,
    setLinkMode,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    edgeLabelDraft,
    setEdgeLabelDraft,
    pendingEdge,
    setPendingEdge,
    chatOpen,
    setChatOpen,
    importing,
    autoLinkSuggestions,
    setAutoLinkSuggestions,
    autoLinkSourceId,
    setAutoLinkSourceId,
    autoLinkingAll,
    contextMenu,
    setContextMenu,
    edgeLabelEdit,
    setEdgeLabelEdit,
    filteredNodes,
    visibleIds,
    visibleEdges,
    selected,
    loadGraph,
    handleFit,
    queuePosition,
    handleFileImport,
    handleAutoLinkAll,
    handleAddNode,
    handleUpdateNode,
    handleDeleteNode,
    handleCreateEdge,
    handleDeleteEdge,
    handleUpdateEdgeLabel,
    handleDuplicateNode,
  };
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}
