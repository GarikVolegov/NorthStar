/**
 * RoutineCard.test.tsx — unit tests for the routine management card.
 *
 * Verifies:
 *  - Renders the routine name, type label, schedule, and output channel
 *  - Toggle calls onToggleActive with id + new checked state
 *  - Delete button requires two clicks (confirm dialog flow)
 *  - "In pausa" badge appears only when routine.active = false
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoutineCard } from "./RoutineCard";
import type { UserRoutine } from "@/hooks/useRoutines";

function makeRoutine(overrides: Partial<UserRoutine> = {}): UserRoutine {
  return {
    id:            1,
    userId:        42,
    type:          "job_monitor",
    name:          "Monitoraggio Offerte",
    schedule:      "every_thursday",
    parameters:    { role: "developer", city: "Milano" },
    outputChannel: "email",
    active:        true,
    lastRunAt:     null,
    nextRunAt:     "2026-06-05T09:00:00.000Z",
    createdAt:     "2026-05-28T10:00:00.000Z",
    updatedAt:     "2026-05-28T10:00:00.000Z",
    ...overrides,
  };
}

describe("RoutineCard", () => {
  it("renders the routine name and the human schedule label", () => {
    render(
      <RoutineCard
        routine={makeRoutine({ name: "Offerte Dev Milano", schedule: "every_thursday" })}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Offerte Dev Milano")).toBeInTheDocument();
    expect(screen.getByText("Ogni giovedì")).toBeInTheDocument();
  });

  it("renders the output channel badge", () => {
    render(
      <RoutineCard
        routine={makeRoutine({ outputChannel: "email" })}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("does not show 'In pausa' when routine is active", () => {
    render(
      <RoutineCard
        routine={makeRoutine({ active: true })}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByText("In pausa")).not.toBeInTheDocument();
  });

  it("shows 'In pausa' badge when routine.active = false", () => {
    render(
      <RoutineCard
        routine={makeRoutine({ active: false })}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("In pausa")).toBeInTheDocument();
  });

  it("calls onToggleActive with id + new state when switch toggled", () => {
    const onToggle = vi.fn();
    render(
      <RoutineCard
        routine={makeRoutine({ id: 7, active: true })}
        onToggleActive={onToggle}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /disattiva routine/i }));

    expect(onToggle).toHaveBeenCalledWith(7, false);
  });

  it("first delete click shows confirm state, does NOT call onDelete", () => {
    const onDelete = vi.fn();
    render(
      <RoutineCard
        routine={makeRoutine({ id: 5 })}
        onToggleActive={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /elimina/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /conferma eliminazione/i })).toBeInTheDocument();
  });

  it("second delete click calls onDelete with routine id", () => {
    const onDelete = vi.fn();
    render(
      <RoutineCard
        routine={makeRoutine({ id: 5 })}
        onToggleActive={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /elimina/i }));
    fireEvent.click(screen.getByRole("button", { name: /conferma eliminazione/i }));

    expect(onDelete).toHaveBeenCalledWith(5);
  });

  it("formats 'Mai eseguita' when lastRunAt is null", () => {
    render(
      <RoutineCard
        routine={makeRoutine({ lastRunAt: null })}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Mai eseguita")).toBeInTheDocument();
  });
});
