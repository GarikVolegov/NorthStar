import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayoutManager } from "./DashboardLayoutManager";
import { getDashboardSectionCatalog } from "./dashboard-layout-sections";
import type { WidgetLayout } from "@/hooks/useDashboardLayout";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: <T,>(items: T[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    return next;
  },
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

describe("DashboardLayoutManager", () => {
  it("uses dynamic translations for section labels, status badges, and aria controls", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    const layout: WidgetLayout[] = [
      { id: "kpi_strip", position: 0, visible: true, size: "lg" },
      { id: "next_routine", position: 1, visible: false, size: "md" },
    ];

    render(
      <DashboardLayoutManager
        layout={layout}
        availableSections={getDashboardSectionCatalog("dipendente")}
        defaultLayout={layout}
        onLayoutChange={vi.fn()}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.layout.sections.kpi_strip.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.layout.sections.kpi_strip.description")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.layout.status.visible")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.layout.status.hidden")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:dashboard.layout.actions.hideWidget" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:dashboard.layout.actions.showWidget" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:dashboard.layout.actions.reset" })).toBeInTheDocument();
  });
});
