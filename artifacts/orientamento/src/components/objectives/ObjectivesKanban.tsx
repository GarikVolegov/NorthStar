import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

interface Objective {
  id: number;
  text: string;
  category: string;
  progress: number;
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
}

type Column = "todo" | "inprogress" | "done";

const COLUMN_CONFIG: Record<Column, { label: string; color: string; filter: (o: Objective) => boolean }> = {
  todo:       { label: "Da fare",    color: "bg-slate-100 text-slate-700",   filter: (o) => !o.completed && o.progress < 30 },
  inprogress: { label: "In corso",   color: "bg-amber-100 text-amber-700",   filter: (o) => !o.completed && o.progress >= 30 },
  done:       { label: "Completati", color: "bg-emerald-100 text-emerald-700", filter: (o) => o.completed },
};

const DROP_PATCH: Record<Column, Partial<Objective>> = {
  todo:       { progress: 0, completed: false },
  inprogress: { progress: 50, completed: false },
  done:       { completed: true },
};

const CATEGORY_COLORS: Record<string, string> = {
  formazione:     "bg-indigo-50 text-indigo-700 border-indigo-100",
  certificazione: "bg-violet-50 text-violet-700 border-violet-100",
  networking:     "bg-cyan-50 text-cyan-700 border-cyan-100",
  esperienza:     "bg-orange-50 text-orange-700 border-orange-100",
};

interface Props {
  userId: number;
}

export function ObjectivesKanban({ userId }: Props) {
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [addingText, setAddingText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const { data: objectives = [], isLoading } = useQuery<Objective[]>({
    queryKey: ["objectives", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/objectives/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
  });

  const patchObjective = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Objective> }) => {
      const res = await fetch(`${BASE}api/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}api/objectives/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objectives", userId] }),
  });

  const createObjective = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, category: "formazione" }),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["objectives", userId] });
      setAddingText("");
      setShowAddForm(false);
    },
  });

  function handleDragStart(e: React.DragEvent, id: number) {
    e.dataTransfer.setData("objectiveId", String(id));
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, col: Column) {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("objectiveId"), 10);
    if (isNaN(id)) return;
    patchObjective.mutate({ id, patch: DROP_PATCH[col] });
    setDraggingId(null);
  }

  function saveEdit(id: number) {
    if (!editText.trim()) return;
    patchObjective.mutate({ id, patch: { text: editText.trim() } });
    setEditId(null);
  }

  function isOverdue(dueDate: string | null) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        {(Object.keys(COLUMN_CONFIG) as Column[]).map((col) => {
          const cfg = COLUMN_CONFIG[col];
          const items = objectives.filter(cfg.filter);
          return (
            <div
              key={col}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col)}
              className="rounded-2xl border bg-muted/20 p-3 min-h-[200px] transition-colors data-[drag-over]:bg-primary/5"
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cfg.color}`}>
                    {items.length}
                  </span>
                </div>
                {col === "todo" && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Add form (only in todo column) */}
              {col === "todo" && showAddForm && (
                <div className="mb-3 space-y-2">
                  <Input
                    autoFocus
                    placeholder="Nuovo obiettivo…"
                    value={addingText}
                    onChange={(e) => setAddingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createObjective.mutate(addingText);
                      if (e.key === "Escape") { setShowAddForm(false); setAddingText(""); }
                    }}
                    className="text-sm h-8"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => createObjective.mutate(addingText)} disabled={!addingText.trim()}>
                      Aggiungi
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddForm(false); setAddingText(""); }}>
                      Annulla
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards */}
              <div className="space-y-2">
                {items.map((obj) => (
                  <div
                    key={obj.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, obj.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "bg-card border rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all",
                      draggingId === obj.id && "opacity-50 scale-95"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        {editId === obj.id ? (
                          <Input
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(obj.id);
                              if (e.key === "Escape") setEditId(null);
                            }}
                            onBlur={() => saveEdit(obj.id)}
                            className="h-6 text-xs px-1 py-0"
                          />
                        ) : (
                          <p className="text-sm font-medium leading-tight truncate">{obj.text}</p>
                        )}

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {obj.category && (
                            <span className={`text-xs border rounded-full px-2 py-0.5 ${CATEGORY_COLORS[obj.category] ?? "bg-muted text-muted-foreground"}`}>
                              {obj.category}
                            </span>
                          )}
                          {obj.dueDate && (
                            <span className={`text-xs ${isOverdue(obj.dueDate) ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                              {isOverdue(obj.dueDate) ? "⚠ " : ""}
                              {new Date(obj.dueDate).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>

                        {/* Progress slider */}
                        {!obj.completed && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-muted-foreground">{obj.progress}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={obj.progress}
                              onChange={(e) => patchObjective.mutate({ id: obj.id, patch: { progress: parseInt(e.target.value) } })}
                              className="w-full h-1 accent-primary cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-muted transition-colors shrink-0">
                            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => { setEditId(obj.id); setEditText(obj.text); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteObjective.mutate(obj.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Elimina
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Trascina qui un obiettivo
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
