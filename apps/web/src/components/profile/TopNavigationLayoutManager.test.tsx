import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNavigationLayoutManager } from "./TopNavigationLayoutManager";
import type { TopNavigationCatalogItem, TopNavigationLayoutItem } from "@/lib/top-navigation";

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

const availableItems: TopNavigationCatalogItem[] = [
  {
    id: "dashboard",
    label: "NorthStar",
    href: "/dashboard",
    iconKey: "brand",
    brand: true,
    locked: true,
    allowedPhases: ["dipendente"],
  },
  {
    id: "jobs",
    label: "Offerte",
    href: "/lavori",
    iconKey: "map-pin",
    brand: false,
    locked: false,
    allowedPhases: ["dipendente"],
  },
];

const layout: TopNavigationLayoutItem[] = [
  { id: "dashboard", position: 0, visible: true },
  { id: "jobs", position: 1, visible: false },
];

describe("TopNavigationLayoutManager", () => {
  it("uses dynamic translations for labels and controls", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    render(
      <TopNavigationLayoutManager
        layout={layout}
        availableItems={availableItems}
        errorMessage={null}
        isSaving
        onLayoutChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText("dynamic:profile.navigation.topBar")).toBeInTheDocument();
    expect(screen.getByText("dynamic:profile.navigation.visibleCount")).toBeInTheDocument();
    expect(screen.getByText("dynamic:profile.navigation.saving")).toBeInTheDocument();
    expect(screen.getByText("dynamic:nav.topNavigation.dashboard")).toBeInTheDocument();
    expect(screen.getByText("dynamic:nav.topNavigation.jobs")).toBeInTheDocument();
    expect(screen.getByLabelText("dynamic:profile.navigation.locked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:profile.navigation.reset" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "dynamic:profile.navigation.show" })).toBeInTheDocument();
  });
});
