import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextRoutineWidget } from "./NextRoutineWidget";

const askMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => ({ ask: askMock }),
}));

vi.mock("@/hooks/useRoutines", () => ({
  ROUTINE_TYPE_LABEL: {
    job_monitor: "Monitoraggio Offerte",
  },
  useRoutines: () => ({
    isLoading: false,
    routines: [],
    meta: { activeCount: 0, total: 0, limit: 1, canCreate: true, plan: "free" },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("NextRoutineWidget", () => {
  it("opens Wendy with a routine configuration prompt from the empty state", () => {
    render(<NextRoutineWidget size="md" />);

    fireEvent.click(screen.getByRole("button", { name: /configura con wendy/i }));

    expect(askMock).toHaveBeenCalledWith(expect.stringContaining("configurare una routine"));
    expect(screen.getByRole("link", { name: /gestisci routine/i })).toHaveAttribute("href", "/routines");
  });
});
