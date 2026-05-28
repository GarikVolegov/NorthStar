import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoutinesPage from "./routines";

const askMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => ({ ask: askMock }),
}));

vi.mock("@/hooks/useRoutines", () => ({
  useDeleteRoutine: () => ({ mutate: vi.fn() }),
  useMarkFeedRead: () => ({ mutate: vi.fn() }),
  useRoutineFeed: () => ({ feed: [], isLoading: false }),
  useRoutines: () => ({
    routines: [],
    meta: { total: 0, activeCount: 0, plan: "free", limit: 1, canCreate: true },
    isLoading: false,
  }),
  useUpdateRoutine: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/routines/RoutinesList", () => ({
  RoutinesList: () => <div>Lista routine</div>,
}));

vi.mock("@/components/routines/RoutineFeed", () => ({
  RoutineFeed: () => <div>Feed routine</div>,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

describe("RoutinesPage", () => {
  it("opens Wendy from the routine configuration CTA", () => {
    render(<RoutinesPage />);

    fireEvent.click(screen.getByRole("button", { name: /parla con wendy/i }));

    expect(askMock).toHaveBeenCalledWith(expect.stringContaining("configurare una routine"));
  });
});
