import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommitmentReadinessWidget } from "./CommitmentReadinessWidget";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "it",
      resolvedLanguage: "en-US",
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithQueryClient(client = createClient()) {

  return render(
    <QueryClientProvider client={client}>
      <CommitmentReadinessWidget />
    </QueryClientProvider>,
  );
}

describe("CommitmentReadinessWidget", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("shows a recoverable error instead of disappearing when readiness cannot load", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "down" }),
    });

    renderWithQueryClient();

    expect(await screen.findByText("dynamic:dashboard.readiness.error.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.error.copy")).toBeInTheDocument();
    expect(screen.queryByText("Prontezza non disponibile")).not.toBeInTheDocument();
    expect(screen.queryByText(/livello di prontezza/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery engine/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:dashboard\.readiness\.error\.retry/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.readiness\.error\.continue/i })).toHaveAttribute("href", "/dashboard");
  });

  it("shows a recoverable error if the shared readiness cache contains incomplete data", async () => {
    const client = createClient();
    client.setQueryData(["discovery-readiness"], { band: "low" });

    renderWithQueryClient(client);

    expect(await screen.findByText("dynamic:dashboard.readiness.error.title")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("renders loaded readiness content through dynamic translation", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        score: 72,
        band: "high",
        components: {
          selfKnowledge: 20,
          exploration: 22,
          reflection: 18,
          emotion: 8,
          commitment: 4,
        },
        nextNudge: null,
      }),
    });

    renderWithQueryClient();

    expect(await screen.findByText("dynamic:dashboard.readiness.kicker")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.bands.high.headline")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.bands.high.sub")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.components.selfKnowledge.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.components.exploration.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.highGuidance")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.readiness\.highGuidanceCta/i })).toHaveAttribute("href", "/profilo");
    expect(screen.getByText("dynamic:dashboard.readiness.emptyNudge.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.readiness.emptyNudge.copy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.readiness\.emptyNudge\.cta/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText(/72/)).toBeInTheDocument();
    expect(screen.queryByText("Prontezza alla scelta")).not.toBeInTheDocument();
    expect(screen.queryByText(/La scelta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery engine/i)).not.toBeInTheDocument();
  });

  it("translates backend nudge messages by component instead of rendering raw server copy", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        score: 45,
        band: "mid",
        components: {
          selfKnowledge: 15,
          exploration: 8,
          reflection: 12,
          emotion: 6,
          commitment: 4,
        },
        nextNudge: {
          component: "exploration",
          toolHref: "/settori",
          message: "Esplora alcuni settori e salva quelli che ti incuriosiscono di piu.",
        },
      }),
    });

    renderWithQueryClient();

    expect(await screen.findByText("dynamic:dashboard.readiness.nudges.exploration.message")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.readiness\.nudges\.exploration\.message/i })).toHaveAttribute("href", "/settori");
    expect(screen.queryByText(/Esplora alcuni settori/i)).not.toBeInTheDocument();
  });
});
