import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TOP_NAV_MAX_VISIBLE } from "@/hooks/useTopNavigationLayout";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { TOP_NAVIGATION_ICONS, type TopNavigationCatalogItem, type TopNavigationLayoutItem } from "@/lib/top-navigation";
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
import { ArrowDown, ArrowUp, GripVertical, Lock, RotateCcw } from "lucide-react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

interface TopNavigationLayoutManagerProps {
  layout: TopNavigationLayoutItem[];
  availableItems: TopNavigationCatalogItem[];
  errorMessage: string | null;
  isSaving: boolean;
  onLayoutChange: (layout: TopNavigationLayoutItem[]) => boolean;
  onReset: () => void;
}

type EditableItem = TopNavigationCatalogItem & TopNavigationLayoutItem;

function mergeLayout(
  layout: TopNavigationLayoutItem[],
  availableItems: TopNavigationCatalogItem[],
): EditableItem[] {
  const layoutById = new Map(layout.map((item) => [item.id, item]));
  const availableById = new Map(availableItems.map((item) => [item.id, item]));
  const sortedLayout = [...layout]
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const catalog = availableById.get(item.id);
      return catalog ? { ...catalog, ...item } : null;
    })
    .filter((item): item is EditableItem => item !== null);

  const missing = availableItems
    .filter((item) => !layoutById.has(item.id))
    .map((item, index) => ({
      ...item,
      position: sortedLayout.length + index,
      visible: false,
    }));

  return [...sortedLayout, ...missing].map((item, position) => ({ ...item, position }));
}

function toLayout(items: EditableItem[]): TopNavigationLayoutItem[] {
  return items.map(({ id, position, visible }) => ({ id, position, visible }));
}

function SortableNavItem({
  item,
  index,
  total,
  visibleCount,
  onMove,
  onToggle,
}: {
  item: EditableItem;
  index: number;
  total: number;
  visibleCount: number;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const translatedLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: item.label,
    key: `nav.topNavigation.${item.id}`,
    context: "Top navigation layout item label",
  });
  const dragLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: `Sposta ${item.label}`,
    key: "profile.navigation.move",
    context: "Top navigation drag handle accessible label; keep the item name unchanged",
  });
  const lockedLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Bloccato",
    key: "profile.navigation.locked",
    context: "Top navigation locked item indicator",
  });
  const moveUpLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: `Sposta su ${item.label}`,
    key: "profile.navigation.moveUp",
    context: "Top navigation move item up accessible label; keep the item name unchanged",
  });
  const moveDownLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: `Sposta giu ${item.label}`,
    key: "profile.navigation.moveDown",
    context: "Top navigation move item down accessible label; keep the item name unchanged",
  });
  const toggleLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: `${item.visible ? "Nascondi" : "Mostra"} ${item.label}`,
    key: item.visible ? "profile.navigation.hide" : "profile.navigation.show",
    context: "Top navigation visibility toggle accessible label; keep the item name unchanged",
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = item.iconKey === "brand" ? null : TOP_NAVIGATION_ICONS[item.iconKey];
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 border-t border-border py-2 first:border-t-0",
        !item.visible && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={dragLabel}
        className="cursor-grab rounded-md p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          <p className="truncate text-sm font-medium">{translatedLabel}</p>
          {item.locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label={lockedLabel} />}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.href}</p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={moveUpLabel}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={moveDownLabel}
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Switch
        aria-label={toggleLabel}
        checked={item.visible}
        disabled={item.locked || (!item.visible && visibleCount >= TOP_NAV_MAX_VISIBLE)}
        onCheckedChange={() => onToggle(item.id)}
      />
    </div>
  );
}

export function TopNavigationLayoutManager({
  layout,
  availableItems,
  errorMessage,
  isSaving,
  onLayoutChange,
  onReset,
}: TopNavigationLayoutManagerProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const editableItems = mergeLayout(layout, availableItems);
  const visibleCount = editableItems.filter((item) => item.visible).length;
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const topBarLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Barra superiore",
    key: "profile.navigation.topBar",
    context: "Profile settings top navigation customization title",
  });
  const visibleCountLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: `${visibleCount}/${TOP_NAV_MAX_VISIBLE} sezioni visibili`,
    key: "profile.navigation.visibleCount",
    context: "Profile settings top navigation visible sections count; keep numbers unchanged",
  });
  const savingLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Salvataggio...",
    key: "profile.navigation.saving",
    context: "Profile settings top navigation saving state",
  });
  const resetLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Ripristina barra",
    key: "profile.navigation.reset",
    context: "Profile settings reset top navigation button",
  });

  function commit(items: EditableItem[]) {
    return onLayoutChange(toLayout(items.map((item, position) => ({ ...item, position }))));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = editableItems.findIndex((item) => item.id === active.id);
    const newIndex = editableItems.findIndex((item) => item.id === over.id);
    commit(arrayMove(editableItems, oldIndex, newIndex));
  }

  function handleMove(from: number, to: number) {
    commit(arrayMove(editableItems, from, to));
  }

  function handleToggle(id: string) {
    commit(editableItems.map((item) => (
      item.id === id ? { ...item, visible: item.locked ? true : !item.visible } : item
    )));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{topBarLabel}</p>
          <p className="text-xs text-muted-foreground">{visibleCountLabel}</p>
        </div>
        {isSaving && <span className="text-xs text-muted-foreground">{savingLabel}</span>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={editableItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div>
            {editableItems.map((item, index) => (
              <SortableNavItem
                key={item.id}
                item={item}
                index={index}
                total={editableItems.length}
                visibleCount={visibleCount}
                onMove={handleMove}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {errorMessage && <p className="text-xs font-medium text-destructive">{errorMessage}</p>}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onReset}>
          <RotateCcw className="h-3 w-3" />
          {resetLabel}
        </Button>
      </div>
    </div>
  );
}
