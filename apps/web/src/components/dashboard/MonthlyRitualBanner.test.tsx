import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthlyRitualBanner } from "./MonthlyRitualBanner";
import type { MonthlyRitualCurrent } from "@/hooks/useMonthlyRitual";

const openMutate = vi.hoisted(() => vi.fn());
const completeMutate = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useMonthlyRitual", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useMonthlyRitual")>("@/hooks/useMonthlyRitual");
  return {
    ...actual,
    useMonthlyRitualActions: () => ({
      open: { mutate: openMutate, isPending: false },
      complete: { mutate: completeMutate, isPending: false },
      updatePreferences: { mutate: vi.fn(), isPending: false },
    }),
  };
});

describe("MonthlyRitualBanner", () => {
  it("is hidden when the ritual is inactive", () => {
    const { container } = render(<MonthlyRitualBanner ritual={{ ...ritual(), active: false, run: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens and completes the active Scintilla", () => {
    render(<MonthlyRitualBanner ritual={ritual()} forceExpanded />);

    expect(screen.getByText("Notte della Fondazione")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /apri il rito/i }));
    fireEvent.click(screen.getByRole("button", { name: /completa scintilla/i }));

    expect(openMutate).toHaveBeenCalledTimes(1);
    expect(completeMutate).toHaveBeenCalledTimes(1);
  });
});

function ritual(): MonthlyRitualCurrent {
  return {
    active: true,
    phase: "active",
    ritualMonth: "2026-05",
    ritualDate: "2026-05-07",
    nextRitualDate: "2026-05-07",
    preferences: { ritualEnabled: true, emailReminderEnabled: false },
    run: {
      id: 1,
      ritualMonth: "2026-05",
      status: "pending",
      routeTitle: "Rotta del Mese",
      routeBody: "Rivedi la tua direzione.",
      challengeKey: "choose_three_directions",
      challengeLabel: "Scegli 3 direzioni",
      challengeBody: "Salva tre direzioni vive.",
      ctaLabel: "Accendi la Scintilla 24h",
      ctaTarget: "/dashboard?ritual=notte-fondazione",
      completedAt: null,
    },
  };
}
