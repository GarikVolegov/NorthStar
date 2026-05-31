import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./dashboard";

const useDashboardDataMock = vi.hoisted(() => vi.fn());
const refetchDashboardMock = vi.hoisted(() => vi.fn());
const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    authReady: true,
    user: {
      id: 7,
      name: "Ada",
      journeyType: "dipendente",
      onboardingCompleted: true,
      avatarUrl: null,
    },
  }),
}));

vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardData: useDashboardDataMock,
}));

vi.mock("@/hooks/useDashboardLayout", () => ({
  useDashboardLayout: () => ({
    layout: [
      { id: "kpi_strip", position: 0, visible: true, size: "lg" },
      { id: "week_timeline", position: 1, visible: true, size: "lg" },
      { id: "diary_objectives", position: 2, visible: true, size: "lg" },
    ],
  }),
}));

vi.mock("@/lib/apiClient", () => {
  return {
    getJson: getJsonMock,
  };
});

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/hooks/useAgentAnalysis", () => ({
  useAgentAnalysis: () => ({ data: null, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/useProactiveInsights", () => ({
  useProactiveInsights: () => ({
    insights: [],
    error: null,
    refetch: vi.fn(),
    markRead: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/hooks/useMonthlyRitual", () => ({
  useMonthlyRitualCurrent: () => ({ data: null }),
}));

vi.mock("@/components/dashboard/DashboardHero", () => ({
  DashboardHero: () => <div>Dashboard hero</div>,
}));

vi.mock("@/components/dashboard/MonthlyRitualBanner", () => ({
  MonthlyRitualBanner: () => null,
}));

vi.mock("@/components/dashboard/DashboardDiscoveryFeed", () => ({
  DashboardDiscoveryFeed: () => null,
  useSavedSectorsCount: () => 0,
}));

vi.mock("@/components/dashboard/widgets/NextRoutineWidget", () => ({
  NextRoutineWidget: () => null,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ["/dashboard", vi.fn()],
}));

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

describe("Dashboard progress UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render empty progress widgets when dashboard data fails to load", async () => {
    useDashboardDataMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchDashboardMock,
    });
    getJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith("api/test-sessions/latest")) {
        return {
          sessionId: 42,
          recommendations: [{ sectorId: 1, sectorName: "Product Design", matchScore: 91 }],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      if (url.endsWith("api/test-sessions/42")) {
        return {
          id: 42,
          recommendations: [{ sectorId: 1, sectorName: "Product Design", matchScore: 91 }],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    expect(await screen.findByText(/progressi dashboard non disponibili/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
    expect(screen.queryByText(/timeline settimanale/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/crea il primo obiettivo strategico/i)).not.toBeInTheDocument();
  });

  it("uses active objectives in the weekly timeline when calendar events are empty", async () => {
    useDashboardDataMock.mockReturnValue({
      data: {
        user: {
          journeyType: "dipendente",
          name: "Ada",
          email: "ada@example.com",
          isPremium: false,
          onboardingCompleted: true,
        },
        session: null,
        objectives: [{
          id: 11,
          text: "Aggiornare portfolio",
          category: "carriera",
          progress: 20,
          completed: false,
          completedAt: null,
          isCertifiableMilestone: false,
          dueDate: "2026-06-02",
          createdAt: "2026-05-30T00:00:00.000Z",
        }],
        objectivesProgress: { done: 0, total: 1, percent: 20 },
        upcomingEvents: [],
      },
      isLoading: false,
      isError: false,
      refetch: refetchDashboardMock,
    });
    getJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith("api/test-sessions/latest")) {
        return {
          sessionId: 42,
          recommendations: [{ sectorId: 1, sectorName: "Product Design", matchScore: 91 }],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      if (url.endsWith("api/test-sessions/42")) {
        return {
          id: 42,
          recommendations: [{ sectorId: 1, sectorName: "Product Design", matchScore: 91 }],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    expect(await screen.findByText(/timeline settimanale/i)).toBeInTheDocument();
    expect(screen.getAllByText("Aggiornare portfolio").length).toBeGreaterThan(0);
    expect(screen.queryByText(/traccia predefinita/i)).not.toBeInTheDocument();
  });
});
