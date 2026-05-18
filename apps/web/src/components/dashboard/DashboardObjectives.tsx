import { useState } from "react";
import { Plus, CheckCircle2, Circle, Trash2, Target, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardObjective } from "@/hooks/useDashboardData";

function DueDateBadge({ dueDate, completed }: { dueDate: string | null; completed: boolean }) {
  if (!dueDate || completed) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const { label, cls } =
    daysLeft < 0
      ? { label: "Scaduto", cls: "text-destructive bg-destructive/10" }
      : daysLeft <= 3
      ? { label: `${daysLeft}g`, cls: "text-amber-500 bg-amber-500/10" }
      : { label: due.toLocaleDateString("it-IT", { day: "numeric", month: "short" }), cls: "text-muted-foreground bg-muted" };

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", cls)}>
      <Clock className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export function DashboardObjectives({
  objectives,
  progress,
  onToggle,
  onDelete,
  onCreate,
}: {
  objectives: DashboardObjective[];
  progress: { done: number; total: number; percent: number };
  onToggle: (id: number, current: boolean) => void;
  onDelete: (id: number) => void;
  onCreate: (text: string) => void;
}) {
  const [newText, setNewText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newText.trim().length < 3) return;
    onCreate(newText.trim());
    setNewText("");
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <Target className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Obiettivi</h3>
          {progress.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.done} di {progress.total} completati
            </p>
          )}
        </div>
      </div>

      {progress.total > 0 && (
        <div className="h-2 bg-primary/10 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      )}

      <div className="space-y-2 mb-4">
        {objectives.map((obj) => (
          <div
            key={obj.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all",
              obj.completed
                ? "border-primary/20 bg-primary/5"
                : "border-border bg-card hover:border-primary/20"
            )}
          >
            <button
              onClick={() => onToggle(obj.id, obj.completed)}
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              {obj.completed ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn("text-sm", obj.completed && "line-through text-muted-foreground")}>
                  {obj.text}
                </p>
                <DueDateBadge dueDate={obj.dueDate} completed={obj.completed} />
              </div>
              {obj.progress > 0 && !obj.completed && (
                <div className="h-1 bg-primary/10 rounded-full mt-1.5 max-w-30">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${obj.progress}%` }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => onDelete(obj.id)}
              className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Aggiungi obiettivo…"
          className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <Button type="submit" size="sm" variant="outline" className="shrink-0 rounded-xl">
          <Plus className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
