import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as WorkModeSelectorModule from "@/components/WorkModeSelector";
import Settori from "./settori";

const authState = vi.hoisted(() => ({
  user: { id: 7 } as { id: number } | null,
}));

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoggedIn: Boolean(authState.user),
    authReady: true,
  }),
}));

vi.mock("@/components/WorkModeSelector", async () => {
  const actual = await vi.importActual<typeof WorkModeSelectorModule>(
    "@/components/WorkModeSelector",
  );
  return {
    ...actual,
    useWorkPreference: () => ({
      workPreference: "autonomo",
      setWorkPreference: vi.fn(),
      save: vi.fn(),
      isLoading: false,
    }),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number; filtered?: number; total?: number }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/motion", () => ({
  AnimateOnScroll: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/lib/sector-icon", () => ({
  RIASEC_LABELS: {
    R: { label: "Realistico" },
    I: { label: "Investigativo" },
    A: { label: "Artistico" },
    S: { label: "Sociale" },
    E: { label: "Imprenditivo" },
    C: { label: "Convenzionale" },
  },
  SectorIcon: () => <span data-testid="sector-icon" />,
}));

const sectors = [
  sector(1, "Cybersecurity", ["I", "C"], "dipendente", 8, "booming", "low"),
  sector(2, "Design & UX", ["A", "S"], "autonomo", 6, "growing", "medium"),
  sector(3, "Sanita digitale", ["S", "I"], "dipendente", 7, "growing", "low"),
  sector(4, "Finanza", ["C", "E"], "ibrido", 5, "stable", "medium"),
  sector(5, "Marketing", ["E", "A"], "autonomo", 4, "stable", "high"),
  sector(6, "Energia", ["R", "I"], "dipendente", 9, "booming", "medium"),
  sector(7, "Educazione", ["S", "A"], "ibrido", 3, "stable", "low"),
  sector(8, "Data science", ["I", "C"], "autonomo", 7, "growing", "low"),
];

function sector(
  id: number,
  name: string,
  riasecTypes: string[],
  workMode: "dipendente" | "autonomo" | "ibrido",
  growthRate: number,
  trend: string,
  automationRisk: string,
) {
  return {
    id,
    name,
    description: `${name} description`,
    icon: "compass",
    color: "#c19e4a",
    riasecTypes,
    skills: [],
    avgSalaryMin: 30000 + id * 1000,
    avgSalaryMax: 52000 + id * 1000,
    growthRate,
    automationRisk,
    scalability: "medium",
    trend,
    timeToAutonomy: "6 mesi",
    advantages: [],
    disadvantages: [],
    opportunities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    workMode: [workMode],
  };
}

function renderSettori() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Settori />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authState.user = { id: 7 };
  getJsonMock.mockReset();
  getJsonMock.mockImplementation((url: string) => {
    if (url.includes("api/sectors")) return Promise.resolve(sectors);
    if (url.includes("api/test-sessions/latest")) {
      return Promise.resolve({
        sessionId: 12,
        recommendations: [
          { sectorId: 2, sectorName: "Design & UX", matchScore: 96, matchReason: "Alta compatibilita creativa." },
        ],
        riasecScores: { A: 5, S: 4, I: 1, C: 1, E: 2, R: 1 },
      });
    }
    return Promise.reject(new Error(`Unhandled URL ${url}`));
  });
  window.history.replaceState({}, "", "/settori");
});

describe("Settori adaptive pyramid", () => {
  it("ranks the pyramid from the user's latest recommendations", async () => {
    renderSettori();

    const apex = await screen.findByTestId("sector-pyramid-apex");

    expect(within(apex).getByText("Design & UX")).toBeInTheDocument();
    expect(within(apex).getByText("Area guida")).toBeInTheDocument();
    expect(screen.getByText("Piramide personale")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-sector-filters")).not.toBeVisible();
  });

  it("updates the pyramid when compact filters change the result set", async () => {
    renderSettori();

    await screen.findByTestId("sector-pyramid");
    fireEvent.change(screen.getByPlaceholderText("sectors.searchPlaceholder"), {
      target: { value: "Sanita" },
    });

    const apex = screen.getByTestId("sector-pyramid-apex");
    expect(within(apex).getByText("Sanita digitale")).toBeInTheDocument();
    expect(within(apex).queryByText("Design & UX")).not.toBeInTheDocument();
  });

  it("falls back to market ranking and test CTA without a profile", async () => {
    authState.user = null;
    renderSettori();

    const pyramid = await screen.findByTestId("sector-pyramid");

    expect(screen.getByText("Piramide mercato")).toBeInTheDocument();
    expect(screen.getByText("Fai il test per personalizzarla")).toBeInTheDocument();
    expect(pyramid).not.toHaveTextContent(/\+\d+(\.\d+)?%/);
  });

  it("shows a loading error state when sectors cannot be fetched", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/sectors")) return Promise.reject(new Error("network down"));
      if (url.includes("api/test-sessions/latest")) return Promise.resolve(null);
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderSettori();

    expect(await screen.findByText("Errore nel caricamento dei settori")).toBeInTheDocument();
    expect(screen.getByText("Riprova")).toBeInTheDocument();
    expect(screen.queryByTestId("sector-pyramid")).not.toBeInTheDocument();
  });

  it("shows a backend empty state when no sectors exist", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/sectors")) return Promise.resolve([]);
      if (url.includes("api/test-sessions/latest")) return Promise.resolve(null);
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderSettori();

    expect(await screen.findByText("Nessun dato backend")).toBeInTheDocument();
    expect(screen.getByText("I settori non sono ancora disponibili.")).toBeInTheDocument();
    expect(screen.queryByText("Rimuovi filtri")).not.toBeInTheDocument();
  });

  it("shows a filtered empty state without implying backend data is missing", async () => {
    renderSettori();

    await screen.findByTestId("sector-pyramid");
    fireEvent.change(screen.getByPlaceholderText("sectors.searchPlaceholder"), {
      target: { value: "settore inesistente" },
    });

    expect(screen.getByText("Nessun risultato filtrato")).toBeInTheDocument();
    expect(screen.getByText("Prova a rimuovere un filtro o cambiare ricerca.")).toBeInTheDocument();
    expect(screen.getAllByText("Rimuovi filtri").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nessun dato backend")).not.toBeInTheDocument();
  });
});
