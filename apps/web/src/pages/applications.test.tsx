import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Candidature from "./applications";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  deleteJson: vi.fn(),
  getJson: getJsonMock,
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderApplications() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Candidature />
    </QueryClientProvider>,
  );
}

describe("applications page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("shows an API error state instead of the empty-applications state when loading fails", async () => {
    getJsonMock.mockRejectedValue(new Error("applications_unavailable"));

    renderApplications();

    expect(await screen.findByText("Candidature non disponibili")).toBeInTheDocument();
    expect(screen.queryByText("candidature.startTracking")).not.toBeInTheDocument();
  });

  it("shows the real empty state when the API succeeds with no applications", async () => {
    getJsonMock.mockResolvedValue({ applications: [], status: "empty", totalCount: 0 });

    renderApplications();

    expect(await screen.findByText("candidature.startTracking")).toBeInTheDocument();
    expect(screen.queryByText("candidature.loadError")).not.toBeInTheDocument();
  });
});
