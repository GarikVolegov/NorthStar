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
import {
  type DashboardSectionDefinition,
} from "./dashboard-layout-sections";
import { cn } from "@/lib/utils";

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
  availableSections: DashboardSectionDefinition[];
  defaultLayout: WidgetLayout[];
  onLayoutChange: (newLayout: WidgetLayout[]) => void;
}

export function DashboardLayoutManager({
  layout,
  availableSections,
  defaultLayout,
  onLayoutChange,
}: DashboardLayoutManagerProps) {
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
    onLayoutChange(defaultLayout);
  }

  const sectionsById = new Map(availableSections.map((section) => [section.id, section]));

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
              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {sectionsById.get(widget.id)?.label ?? widget.id}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {sectionsById.get(widget.id)?.description ?? "Sezione dashboard"}
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    widget.visible ? "border-primary/25 bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  )}>
                    {widget.visible ? "Visibile" : "Nascosta"}
                  </span>
                </div>
              </div>
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
