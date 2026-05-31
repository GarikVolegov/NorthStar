import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/apiClient";
import { MindsetStreakWidget } from "./MindsetStreakWidget";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7 } }),
}));

vi.mock("@/lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiClient")>();
  return {
    ...actual,
    getJson: getJsonMock,
  };
});

function renderWithQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MindsetStreakWidget size="md" />
    </QueryClientProvider>,
  );
}

describe("MindsetStreakWidget", () => {
  it("shows a recovery state instead of zero streak when the feed API fails", async () => {
    getJsonMock.mockRejectedValueOnce(new ApiClientError("Server down", 500, null));

    renderWithQueryClient();

    expect(await screen.findByText(/streak non disponibile/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
  });
});
