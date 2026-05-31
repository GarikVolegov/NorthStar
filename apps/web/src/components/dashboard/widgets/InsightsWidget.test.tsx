import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InsightsWidget } from "./InsightsWidget";

const useProactiveInsightsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useProactiveInsights", () => ({
  useProactiveInsights: useProactiveInsightsMock,
}));

describe("InsightsWidget", () => {
  it("shows Wendy insight API failures as recoverable errors", () => {
    useProactiveInsightsMock.mockReturnValue({
      insights: [],
      isLoading: false,
      error: new Error("down"),
      refetch: vi.fn(),
      markRead: vi.fn(),
      dismiss: vi.fn(),
    });

    render(<InsightsWidget size="md" />);

    expect(screen.getByText(/insight di wendy non disponibili/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
  });
});
