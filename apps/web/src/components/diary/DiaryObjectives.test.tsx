import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  deleteJson: vi.fn(),
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Ada" }, authReady: true }),
}));

vi.mock("@/lib/apiClient", () => ({
  deleteJson: (...args: unknown[]) => apiState.deleteJson(...args),
  getJson: (...args: unknown[]) => apiState.getJson(...args),
  patchJson: (...args: unknown[]) => apiState.patchJson(...args),
  postJson: (...args: unknown[]) => apiState.postJson(...args),
}));

import { DiaryObjectives } from "./DiaryObjectives";

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <DiaryObjectives />
    </QueryClientProvider>,
  );
}

describe("DiaryObjectives", () => {
  it("manages objectives from inside the diary using the existing objectives API", async () => {
    const user = userEvent.setup();
    apiState.getJson.mockResolvedValue([
      {
        id: 1,
        text: "Diventare UX Researcher",
        category: "carriera",
        progress: 35,
        completed: false,
        completedAt: null,
        dueDate: null,
        createdAt: "2026-05-27T00:00:00.000Z",
      },
    ]);
    apiState.postJson.mockResolvedValue({});
    apiState.patchJson.mockResolvedValue({});
    apiState.deleteJson.mockResolvedValue({});

    renderComponent();

    expect(await screen.findByText("Diventare UX Researcher")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nuovo obiettivo"), "Preparare portfolio");
    await user.click(screen.getByRole("button", { name: /aggiungi/i }));

    expect(apiState.postJson).toHaveBeenCalledWith("/api/objectives", {
      text: "Preparare portfolio",
      category: "carriera",
    });

    await user.click(screen.getByRole("button", { name: /completa obiettivo/i }));
    expect(apiState.patchJson).toHaveBeenCalledWith("/api/objectives/1", {
      completed: true,
    });

    await user.click(screen.getByRole("button", { name: /elimina obiettivo/i }));
    expect(apiState.deleteJson).toHaveBeenCalledWith("/api/objectives/1");

    await waitFor(() => {
      expect(apiState.getJson).toHaveBeenCalledWith("/api/objectives");
    });
  });
});
