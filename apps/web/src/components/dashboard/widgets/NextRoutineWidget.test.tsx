import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRoutineWidget } from "./NextRoutineWidget";

const askMock = vi.hoisted(() => vi.fn());
const routinesState = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  error: null as Error | null,
  routines: [] as Array<{
    id: number;
    active: boolean;
    name: string | null;
    type: "job_monitor";
    nextRunAt: string | null;
    outputChannel: "in_app";
  }>,
  meta: { activeCount: 0, total: 0, limit: 1, canCreate: true, plan: "free" },
  refetch: vi.fn(),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => ({ ask: askMock }),
}));

vi.mock("@/hooks/useRoutines", () => ({
  ROUTINE_TYPE_LABEL: {
    job_monitor: "Monitoraggio Offerte",
  },
  useRoutines: () => ({
    ...routinesState,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("NextRoutineWidget", () => {
  beforeEach(() => {
    askMock.mockReset();
    routinesState.isLoading = false;
    routinesState.isError = false;
    routinesState.error = null;
    routinesState.routines = [];
    routinesState.refetch.mockReset();
  });

  it("opens Wendy with a routine configuration prompt from the empty state", () => {
    render(<NextRoutineWidget size="md" />);

    fireEvent.click(screen.getByRole("button", { name: /configura con wendy/i }));

    expect(askMock).toHaveBeenCalledWith(expect.stringContaining("configurare una routine"));
    expect(screen.getByRole("link", { name: /gestisci routine/i })).toHaveAttribute("href", "/routines");
  });

  it("shows a recoverable error instead of setup guidance when routines fail to load", () => {
    routinesState.isError = true;
    routinesState.error = new Error("Routine temporarily unavailable");

    render(<NextRoutineWidget size="md" />);

    expect(screen.getByText(/routine non disponibili/i)).toBeInTheDocument();
    expect(screen.getByText(/routine temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/configura la prima routine/i)).not.toBeInTheDocument();
  });
});
