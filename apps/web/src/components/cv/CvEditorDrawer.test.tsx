import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/apiClient";
import { CvEditorDrawer, type GeneratedCv } from "./CvEditorDrawer";

const patchJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return {
    ...actual,
    patchJson: patchJsonMock,
  };
});

const initialCv: GeneratedCv = {
  personalInfo: { name: "Ada Lovelace", email: "ada@example.com" },
  summary: "Inventrice",
  experience: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
  certifications: [],
  template: "classic",
};

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("CvEditorDrawer persistence states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps edits open and reports that generated CV changes were not saved", async () => {
    patchJsonMock.mockRejectedValue(
      new ApiClientError("Persistenza CV non disponibile", 503, {
        code: "CV_PERSISTENCE_UNAVAILABLE",
      }),
    );

    renderWithClient(
      <CvEditorDrawer
        open
        onClose={vi.fn()}
        userId={42}
        initialCv={initialCv}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Salva/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Persistenza CV non disponibile",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Salvato!")).not.toBeInTheDocument();
  });

  it("asks before discarding unsaved edits", () => {
    const onClose = vi.fn();

    renderWithClient(
      <CvEditorDrawer
        open
        onClose={onClose}
        userId={42}
        initialCv={initialCv}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Profilo \/ Sommario/i }));
    fireEvent.change(screen.getByPlaceholderText("Breve descrizione professionale..."), {
      target: { value: "Inventrice e mentor tecnico" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Scartare le modifiche al CV?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Inventrice e mentor tecnico")).toBeInTheDocument();
  });
});
