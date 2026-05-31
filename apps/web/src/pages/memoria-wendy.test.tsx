import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoriaWendy from "./memoria-wendy";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  deleteJson: vi.fn(),
  getJson: getJsonMock,
  postJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true, authReady: true }),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

function renderMemoryPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoriaWendy />
    </QueryClientProvider>,
  );
}

describe("Memoria Wendy accessibility", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("keeps each delete action persistently visible and touch-sized", async () => {
    getJsonMock.mockResolvedValue({
      facts: [
        {
          id: 7,
          key: "user_manual",
          value: "Preferisce lavorare su prodotti accessibili",
          source: "user_manual",
          confirmedCount: 1,
          createdAt: "2026-05-31T08:00:00.000Z",
        },
      ],
    });

    renderMemoryPage();

    const deleteButton = await screen.findByRole("button", { name: /cancella fatto/i });

    expect(deleteButton).not.toHaveClass("opacity-0");
    expect(deleteButton).not.toHaveClass("group-hover:opacity-100");
    expect(deleteButton).toHaveClass("min-h-11", "min-w-11");
  });

  it("keeps the manual memory composer comfortable on narrow mobile screens", async () => {
    getJsonMock.mockResolvedValue({ facts: [] });

    renderMemoryPage();

    const input = await screen.findByPlaceholderText(/Aggiunge un fatto manuale/i);
    const addButton = screen.getByRole("button", { name: /aggiungi/i });

    expect(input.parentElement).toHaveClass("flex-col", "sm:flex-row");
    expect(input).toHaveClass("min-h-11");
    expect(addButton).toHaveClass("min-h-11", "w-full", "sm:w-auto");
  });
});
