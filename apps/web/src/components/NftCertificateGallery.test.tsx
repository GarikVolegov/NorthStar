import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  getJson: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getJson: (...args: unknown[]) => apiState.getJson(...args),
}));

import { NftCertificateGallery } from "./NftCertificateGallery";

function renderComponent() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NftCertificateGallery userId={42} />
    </QueryClientProvider>,
  );
}

describe("NftCertificateGallery", () => {
  it("renders issued certificates with SVG image and verify links", async () => {
    apiState.getJson.mockResolvedValue({
      certificates: [
        {
          id: 1,
          userId: 42,
          objectiveId: 7,
          objectiveText: "Analizza 5 settori in crescita",
          userName: "Ada",
          category: "analisi",
          certificateHash: "abc123",
          metadata: {},
          mintedAt: "2026-05-29T10:15:00.000Z",
          status: "issued",
          chain: "NorthStar Ledger",
          imageUrl: "/api/nft-certificates/image/abc123.svg",
          verifyUrl: "/certificato/abc123",
        },
      ],
    });

    renderComponent();

    expect(await screen.findByText("Analizza 5 settori in crescita")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /certificato/i })).toHaveAttribute(
      "src",
      "/api/nft-certificates/image/abc123.svg",
    );
    expect(screen.getByRole("link", { name: /verifica/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/certificato/abc123"),
    );
    expect(screen.getByText(/off-chain/i)).toBeInTheDocument();
  });
});
