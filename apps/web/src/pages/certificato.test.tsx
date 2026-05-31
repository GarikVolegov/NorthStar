import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  getJson: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(message: string, readonly status: number, readonly body: unknown) {
      super(message);
      this.name = "ApiClientError";
    }
  },
  getJson: (...args: unknown[]) => apiState.getJson(...args),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useRoute: () => [true, { hash: "abc123" }],
}));

import { ApiClientError } from "@/lib/apiClient";
import CertificatePage from "./certificato";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CertificatePage />
    </QueryClientProvider>,
  );
}

describe("CertificatePage", () => {
  beforeEach(() => {
    apiState.getJson.mockReset();
  });

  it("shows a recoverable service error instead of not-found when verification is unavailable", async () => {
    const user = userEvent.setup();
    apiState.getJson
      .mockRejectedValueOnce(new ApiClientError("Service unavailable", 503, { error: "certificates_unavailable" }))
      .mockResolvedValueOnce({
        valid: true,
        certificate: {
          id: 1,
          userName: "Ada",
          objectiveText: "Completa il primo percorso",
          category: "analisi",
          certificateHash: "abc123",
          chain: "NorthStar Ledger",
          mintedAt: "2026-05-31T10:00:00.000Z",
          status: "issued",
        },
      });

    renderPage();

    expect(await screen.findByText(/verifica temporaneamente non disponibile/i)).toBeInTheDocument();
    expect(screen.queryByText(/certificato non trovato/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /riprova/i }));

    expect(await screen.findByText(/certificato autentico/i)).toBeInTheDocument();
    expect(apiState.getJson).toHaveBeenCalledTimes(2);
  });

  it("keeps a real missing hash as not found", async () => {
    apiState.getJson.mockRejectedValue(new ApiClientError("Not found", 404, { error: "not_found" }));

    renderPage();

    expect(await screen.findByText(/certificato non trovato/i)).toBeInTheDocument();
  });
});
