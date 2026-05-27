/**
 * DashboardLayoutManager.test.tsx — unit tests for the drag-drop layout manager.
 *
 * We do not exercise dnd-kit's pointer machinery (too brittle for unit tests).
 * Instead we cover the data flow: render, visibility toggle, reset.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardLayoutManager } from "./DashboardLayoutManager";
import type { DashboardSectionDefinition } from "./dashboard-layout-sections";
import type { WidgetLayout } from "@/hooks/useDashboardLayout";

const sections: DashboardSectionDefinition[] = [
  { id: "kpi_strip",      label: "Indicatori principali", description: "Progressi e profilo",                  size: "lg" },
  { id: "next_routine",   label: "Prossima routine",      description: "Prossima automazione configurabile",   size: "md" },
  { id: "week_timeline",  label: "Timeline settimanale",  description: "Eventi e prossima azione",             size: "lg" },
];

const defaultLayout: WidgetLayout[] = [
  { id: "kpi_strip",     position: 0, visible: true,  size: "lg" },
  { id: "next_routine",  position: 1, visible: true,  size: "md" },
  { id: "week_timeline", position: 2, visible: true,  size: "lg" },
];

describe("DashboardLayoutManager", () => {
  it("renders all widgets in position order with their label and description", () => {
    render(
      <DashboardLayoutManager
        layout={defaultLayout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Indicatori principali")).toBeInTheDocument();
    expect(screen.getByText("Prossima routine")).toBeInTheDocument();
    expect(screen.getByText("Timeline settimanale")).toBeInTheDocument();
    expect(screen.getByText("Progressi e profilo")).toBeInTheDocument();
  });

  it("marks visible widgets with the 'Visibile' chip and hidden with 'Nascosta'", () => {
    const layout: WidgetLayout[] = [
      { id: "kpi_strip",     position: 0, visible: true,  size: "lg" },
      { id: "next_routine",  position: 1, visible: false, size: "md" },
    ];

    render(
      <DashboardLayoutManager
        layout={layout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Visibile")).toBeInTheDocument();
    expect(screen.getByText("Nascosta")).toBeInTheDocument();
  });

  it("clicking the hide button calls onLayoutChange with the widget visibility toggled", () => {
    const onChange = vi.fn();
    render(
      <DashboardLayoutManager
        layout={defaultLayout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={onChange}
      />,
    );

    // The first toggle button corresponds to the first widget (kpi_strip), which is visible
    const hideButton = screen.getAllByRole("button", { name: /nascondi widget/i })[0];
    expect(hideButton).toBeDefined();
    fireEvent.click(hideButton!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const firstCall = onChange.mock.calls[0];
    expect(firstCall).toBeDefined();
    const updated = firstCall![0] as WidgetLayout[];
    const kpi = updated.find((w) => w.id === "kpi_strip");
    expect(kpi?.visible).toBe(false);
    // Other widgets keep their visibility
    expect(updated.find((w) => w.id === "next_routine")?.visible).toBe(true);
  });

  it("clicking 'Mostra widget' on a hidden one flips visibility back to true", () => {
    const layout: WidgetLayout[] = [
      { id: "kpi_strip", position: 0, visible: false, size: "lg" },
    ];
    const onChange = vi.fn();

    render(
      <DashboardLayoutManager
        layout={layout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mostra widget/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const firstCall = onChange.mock.calls[0];
    expect(firstCall).toBeDefined();
    const updated = firstCall![0] as WidgetLayout[];
    expect(updated[0]?.visible).toBe(true);
  });

  it("clicking 'Ripristina layout' calls onLayoutChange with the defaultLayout", () => {
    const customLayout: WidgetLayout[] = [
      { id: "week_timeline", position: 0, visible: false, size: "lg" },
      { id: "kpi_strip",     position: 1, visible: true,  size: "lg" },
    ];
    const onChange = vi.fn();

    render(
      <DashboardLayoutManager
        layout={customLayout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ripristina layout/i }));

    expect(onChange).toHaveBeenCalledWith(defaultLayout);
  });

  it("falls back to widget id when label/description are missing from sections catalog", () => {
    const layout: WidgetLayout[] = [
      { id: "unknown_widget", position: 0, visible: true, size: "md" },
    ];

    render(
      <DashboardLayoutManager
        layout={layout}
        availableSections={sections}
        defaultLayout={defaultLayout}
        onLayoutChange={vi.fn()}
      />,
    );

    expect(screen.getByText("unknown_widget")).toBeInTheDocument();
    expect(screen.getByText("Sezione dashboard")).toBeInTheDocument();
  });
});
