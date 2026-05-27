import { Button } from "@/components/ui/button";
import type { WidgetLayout } from "@/hooks/useDashboardLayout";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { InsightsWidget } from "./widgets/InsightsWidget";
import { JobFeedWidget } from "./widgets/JobFeedWidget";
import { MindsetStreakWidget } from "./widgets/MindsetStreakWidget";
import { NextRoutineWidget } from "./widgets/NextRoutineWidget";
import { ProgressObjectivesWidget } from "./widgets/ProgressObjectivesWidget";
import { cn } from "@/lib/utils";

const WIDGET_LABELS: Record<string, string> = {
  progress_objectives: "Obiettivi in corso",
  next_routine:        "Prossima routine",
  job_feed:            "Monitor offerte lavoro",
  insights:            "Insight da Wendy",
  mindset_streak:      "Streak mindset",
};

const DEFAULT_LAYOUT: WidgetLayout[] = [
  { id: "progress_objectives", position: 0, visible: true,  size: "lg" },
  { id: "next_routine",        position: 1, visible: true,  size: "md" },
  { id: "job_feed",            position: 2, visible: true,  size: "md" },
  { id: "insights",            position: 3, visible: true,  size: "md" },
  { id: "mindset_streak",      position: 4, visible: false, size: "sm" },
];

function renderWidget(id: string, size: "sm" | "md" | "lg") {
  switch (id) {
    case "progress_objectives": return <ProgressObjectivesWidget size={size} />;
    case "next_routine":        return <NextRoutineWidget size={size} />;
    case "job_feed":            return <JobFeedWidget size={size} />;
    case "insights":            return <InsightsWidget size={size} />;
    case "mindset_streak":      return <MindsetStreakWidget size={size} />;
    default:                    return null;
  }
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  visible: boolean;
  onToggleVisible: () => void;
}

function SortableItem({ id, children, visible, onToggleVisible }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center px-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing z-10"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Visibility toggle */}
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Nascondi widget" : "Mostra widget"}
        className="absolute right-2 top-2 z-10 rounded-md p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
      >
        {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>

      <div className={cn("ml-6 transition-opacity", !visible && "opacity-40")}>
        {children}
      </div>
    </div>
  );
}

interface DashboardLayoutManagerProps {
  layout: WidgetLayout[];
  onLayoutChange: (newLayout: WidgetLayout[]) => void;
}

export function DashboardLayoutManager({ layout, onLayoutChange }: DashboardLayoutManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedLayout = [...layout].sort((a, b) => a.position - b.position);
  const ids = sortedLayout.map((w) => w.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedLayout.findIndex((w) => w.id === active.id);
    const newIndex = sortedLayout.findIndex((w) => w.id === over.id);

    const reordered = arrayMove(sortedLayout, oldIndex, newIndex).map(
      (item, index) => ({ ...item, position: index }),
    );
    onLayoutChange(reordered);
  }

  function handleToggleVisible(id: string) {
    const updated = layout.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w,
    );
    onLayoutChange(updated);
  }

  function handleReset() {
    onLayoutChange(DEFAULT_LAYOUT);
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {sortedLayout.map((widget) => (
            <SortableItem
              key={widget.id}
              id={widget.id}
              visible={widget.visible}
              onToggleVisible={() => handleToggleVisible(widget.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-medium">
                  {WIDGET_LABELS[widget.id] ?? widget.id}
                </span>
              </div>
              {widget.visible && renderWidget(widget.id, widget.size)}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground gap-1.5"
        >
          <RotateCcw className="h-3 w-3" />
          Ripristina layout
        </Button>
      </div>
    </div>
  );
}
