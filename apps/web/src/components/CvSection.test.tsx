import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/apiClient";
import { CvSection } from "./CvSection";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return {
    ...actual,
    getJson: getJsonMock,
    postJson: postJsonMock,
    deleteJson: deleteJsonMock,
  };
});

vi.mock("./cv/CvDownloadMenu", () => ({
  CvDownloadMenu: () => <button type="button">Scarica</button>,
}));

vi.mock("./cv/CvEditorDrawer", () => ({
  CvEditorDrawer: () => null,
}));

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("CvSection persistence states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a retryable load error instead of the empty CV state", async () => {
    getJsonMock.mockRejectedValue(new Error("CV persistence offline"));

    renderWithClient(<CvSection userId={42} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("CV non caricati");
    expect(screen.getByRole("button", { name: "Riprova caricamento CV" })).toBeInTheDocument();
    expect(screen.queryByText(/Nessun CV presente/i)).not.toBeInTheDocument();
  });

  it("keeps the CV visible and offers retry messaging when deletion fails", async () => {
    getJsonMock.mockResolvedValue({
      cvs: [
        {
          id: "cv-42",
          filename: "CV Generato.pdf",
          uploadedAt: "2026-05-20T10:00:00.000Z",
          source: "generated",
          hasPdf: false,
          template: "classic",
        },
      ],
    });
    deleteJsonMock.mockRejectedValue(
      new ApiClientError("Persistenza CV non disponibile", 503, {
        code: "CV_PERSISTENCE_UNAVAILABLE",
      }),
    );

    renderWithClient(<CvSection userId={42} />);

    expect(await screen.findByText("CV Generato.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Elimina tutto"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Persistenza CV non disponibile");
    expect(screen.getByText("CV Generato.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova eliminazione CV" })).toBeInTheDocument();
  });
});
