import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  deleteJson: apiState.deleteJson,
  getJson: apiState.getJson,
  patchJson: apiState.patchJson,
  postJson: apiState.postJson,
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
  beforeEach(() => {
    apiState.deleteJson.mockReset();
    apiState.getJson.mockReset();
    apiState.patchJson.mockReset();
    apiState.postJson.mockReset();
  });

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
        isCertifiableMilestone: false,
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

  it("shows a recoverable error instead of an empty state when objectives cannot load", async () => {
    apiState.getJson.mockRejectedValue(new Error("API obiettivi non disponibile"));

    renderComponent();

    expect(await screen.findByText("Obiettivi non disponibili")).toBeInTheDocument();
    expect(screen.getByText(/API obiettivi non disponibile/i)).toBeInTheDocument();
    expect(screen.queryByText("Nessun obiettivo principale")).not.toBeInTheDocument();
  });

  it("keeps failed objective mutations visible with the API reason", async () => {
    const user = userEvent.setup();
    apiState.getJson.mockResolvedValue([
      {
        id: 1,
        text: "Diventare UX Researcher",
        category: "carriera",
        progress: 35,
        completed: false,
        completedAt: null,
        isCertifiableMilestone: false,
        dueDate: null,
        createdAt: "2026-05-27T00:00:00.000Z",
      },
    ]);
    apiState.patchJson.mockRejectedValue(new Error("Obiettivo non trovato"));

    renderComponent();

    await screen.findByText("Diventare UX Researcher");
    await user.click(screen.getByRole("button", { name: /completa obiettivo/i }));

    expect(await screen.findByText("Aggiornamento non riuscito")).toBeInTheDocument();
    expect(screen.getByText(/Obiettivo non trovato/i)).toBeInTheDocument();
  });
});
