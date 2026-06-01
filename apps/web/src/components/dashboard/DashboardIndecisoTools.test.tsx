import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardIndecisoTools } from "./DashboardIndecisoTools";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderWithClient(
  client: QueryClient,
  props: React.ComponentProps<typeof DashboardIndecisoTools> = {
    toolsProps: { journeyType: "indeciso" },
  },
) {
  return render(
    <QueryClientProvider client={client}>
      <DashboardIndecisoTools {...props} />
    </QueryClientProvider>,
  );
}

describe("DashboardIndecisoTools", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 55,
        band: "mid",
        components: {
          selfKnowledge: 10,
          exploration: 10,
          reflection: 10,
          emotion: 8,
          commitment: 3,
        },
        nextNudge: null,
      }),
    });
  });

  it("does not band tools from incomplete shared readiness cache data", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["discovery-readiness"], { band: "low" });

    renderWithClient(client);

    expect(screen.getByText(/discovery engine non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/test di personalit/i)).toBeInTheDocument();
  });

  it("promotes the path selection tool when the adaptive phase is choose_path", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["discovery-readiness"], {
      score: 82,
      band: "high",
      components: {
        selfKnowledge: 20,
        exploration: 20,
        reflection: 18,
        emotion: 12,
        commitment: 12,
      },
      nextNudge: null,
    });

    renderWithClient(client, {
      toolsProps: { journeyType: "indeciso" },
      adaptivePhase: "choose_path",
    });

    const choosePath = screen.getByText("Scegli percorso");
    const diary = screen.getByText("Il mio Diario");
    expect(choosePath.compareDocumentPosition(diary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("promotes the test tool when the adaptive phase is start_test", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(client, {
      toolsProps: { journeyType: "indeciso" },
      adaptivePhase: "start_test",
    });

    const test = screen.getByText(/test di personalit/i);
    const diary = screen.getByText("Il mio Diario");
    expect(test.compareDocumentPosition(diary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("promotes sector exploration when the adaptive phase is explore_sectors", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["discovery-readiness"], {
      score: 38,
      band: "low",
      components: {
        selfKnowledge: 15,
        exploration: 6,
        reflection: 8,
        emotion: 6,
        commitment: 3,
      },
      nextNudge: null,
    });

    renderWithClient(client, {
      toolsProps: { journeyType: "indeciso" },
      adaptivePhase: "explore_sectors",
    });

    const sectors = screen.getByText("Esplora settori");
    const diary = screen.getByText("Il mio Diario");
    expect(sectors.compareDocumentPosition(diary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
