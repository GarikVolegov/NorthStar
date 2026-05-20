import { ALL_TYPES, TYPE_META } from "@/components/knowledge-graph/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Link2, Loader2, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { KEdge, KNode, NodeType } from "./knowledgeGraphTypes";

interface NodeEditorProps {
  node: KNode;
  edges: KEdge[];
  allNodes: KNode[];
  onClose: () => void;
  onSave: (patch: Partial<KNode>) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onStartLink: () => void;
  onDeleteEdge: (id: number) => Promise<void> | void;
  onSaveRef: MutableRefObject<(() => void) | null>;
}

export function KnowledgeNodeEditor({
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
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Provenance memoria
            </p>
            <span
              className={cn(
                "text-[10px] rounded-full border px-2 py-0.5",
                node.status === "candidate" && "border-amber-200 text-amber-700 bg-amber-50",
                node.status === "active" && "border-emerald-200 text-emerald-700 bg-emerald-50",
                (!node.status || node.status === "archived" || node.status === "rejected") && "border-border text-muted-foreground bg-background",
              )}
            >
              {node.status ?? "active"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">Fonte</span>
              <p className="font-medium truncate">{node.sourceType ?? "manual"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Confidence</span>
              <p className="font-medium">{Math.round((node.confidence ?? 0.75) * 100)}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Entita</span>
              <p className="font-medium truncate">{node.sourceEntityType ?? "nodo manuale"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Importanza</span>
              <p className="font-medium">{Math.round((node.importance ?? 0.5) * 100)}%</p>
            </div>
          </div>
        </div>
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
                  {e.confidence != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(e.confidence * 100)}%
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
