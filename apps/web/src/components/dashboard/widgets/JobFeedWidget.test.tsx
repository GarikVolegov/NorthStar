import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobFeedWidget } from "./JobFeedWidget";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(message: string, readonly status: number, readonly body: unknown) {
      super(message);
      this.name = "ApiClientError";
    }
  },
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 } }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderWidget() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <JobFeedWidget size="md" />
    </QueryClientProvider>,
  );
}

describe("JobFeedWidget reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("shows an error state instead of the empty feed when the backend fails", async () => {
    getJsonMock.mockRejectedValue(new Error("feed_unavailable"));

    renderWidget();

    expect(await screen.findByText("Monitor offerte non disponibile")).toBeInTheDocument();
    expect(screen.queryByText(/Nessuna notifica recente/i)).not.toBeInTheDocument();
  });

  it("shows an actionable empty state when the backend succeeds with no feed items", async () => {
    getJsonMock.mockResolvedValue({ feed: [] });

    renderWidget();

    expect(await screen.findByText(/Nessuna notifica recente/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /configura routine/i })).toHaveAttribute("href", "/routines");
  });
});
