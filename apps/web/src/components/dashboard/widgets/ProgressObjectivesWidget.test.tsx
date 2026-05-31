import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProgressObjectivesWidget } from "./ProgressObjectivesWidget";

const useDashboardDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardData: useDashboardDataMock,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("ProgressObjectivesWidget", () => {
  it("does not present an API failure as an empty objectives list", () => {
    useDashboardDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    render(<ProgressObjectivesWidget size="md" />);

    expect(screen.getByText(/obiettivi non disponibili/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /apri obiettivi/i })).toHaveAttribute("href", "/obiettivi");
  });
});
