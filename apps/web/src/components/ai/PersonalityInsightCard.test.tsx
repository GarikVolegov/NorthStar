import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PersonalityInsightCard } from "./PersonalityInsightCard";

const usePersonalityInsightMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAIAgents", () => ({
  usePersonalityInsight: usePersonalityInsightMock,
}));

describe("PersonalityInsightCard", () => {
  it("explains how to recover when the AI insight request fails", () => {
    usePersonalityInsightMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <PersonalityInsightCard
        riasecScores={{ S: 80 }}
        primaryTypes={["Sociale"]}
      />,
    );

    expect(screen.getByText(/insight ai non disponibile/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vedi risultati completi/i })).toHaveAttribute("href", "/risultati");
  });
});
