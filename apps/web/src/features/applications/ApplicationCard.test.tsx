import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppCard } from "./ApplicationCard";
import type { Application } from "./applicationTypes";

const deleteJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  deleteJson: deleteJsonMock,
  postJson: postJsonMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "it-IT" },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const baseApplication: Application = {
  id: 7,
  userId: 42,
  company: "NorthStar",
  role: "UX Reliability",
  url: null,
  status: "saved",
  notes: null,
  salary: null,
  location: null,
  appliedAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
  notesLog: null,
};

function renderCard(app: Application = baseApplication) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <AppCard
        app={app}
        userId={42}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
        deleting={false}
        isDragging={false}
        onDragStart={vi.fn()}
        onDragEnd={vi.fn()}
        onCoverLetter={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("AppCard diary notes", () => {
  beforeEach(() => {
    deleteJsonMock.mockReset();
    postJsonMock.mockReset();
  });

  it("shows a compact alert and keeps the typed note when saving a diary note fails", async () => {
    postJsonMock.mockRejectedValue(new Error("Diario non disponibile"));

    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /apri diario note northstar/i }));
    fireEvent.change(screen.getByPlaceholderText("candidature.addNotePlaceholder"), {
      target: { value: "Follow up with recruiter" },
    });
    fireEvent.click(screen.getByRole("button", { name: /aggiungi nota/i }));

    await waitFor(() => expect(postJsonMock).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Diario non disponibile");
    expect(screen.getByDisplayValue("Follow up with recruiter")).toBeInTheDocument();
  });

  it("shows a compact alert when deleting a diary note fails", async () => {
    deleteJsonMock.mockRejectedValue(new Error("Nota non eliminata"));

    renderCard({
      ...baseApplication,
      notesLog: [{ text: "Call scheduled", createdAt: "2026-05-21T09:00:00.000Z" }],
    });

    fireEvent.click(screen.getByRole("button", { name: /apri diario note northstar/i }));
    fireEvent.click(screen.getByRole("button", { name: /elimina nota 1/i }));

    await waitFor(() => expect(deleteJsonMock).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Nota non eliminata");
  });
});
