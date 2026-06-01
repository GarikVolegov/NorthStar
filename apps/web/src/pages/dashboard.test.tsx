import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Dashboard from "./dashboard";

type WendyPageContextCall = {
  page?: string;
  journeyType?: string;
  adaptivePhase?: string;
  adaptiveNextAction?: {
    label: string;
    href: string;
    sectionId: string;
  };
  savedSectorsCount?: number;
};

const useDashboardDataMock = vi.hoisted(() => vi.fn());
const refetchDashboardMock = vi.hoisted(() => vi.fn());
const getJsonMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());
const useWendyPageContextMock = vi.hoisted(() => vi.fn<(ctx: WendyPageContextCall) => void>());
const authState = vi.hoisted(() => ({
  user: {
    id: 7,
    name: "Ada",
    journeyType: "dipendente",
    onboardingCompleted: true,
    avatarUrl: null,
  } as {
    id: number;
    name: string;
    journeyType: string;
    onboardingCompleted: boolean;
    avatarUrl: string | null;
    journeyDecidedAt?: string | null;
  },
}));
const dashboardLayoutState = vi.hoisted(() => ({
  layout: [
    { id: "tools", position: 0, visible: true, size: "lg" },
    { id: "clarity_path", position: 1, visible: true, size: "lg" },
    { id: "discovery_feed", position: 2, visible: true, size: "lg" },
    { id: "career_comparison", position: 3, visible: true, size: "lg" },
    { id: "kpi_strip", position: 4, visible: true, size: "lg" },
    { id: "week_timeline", position: 5, visible: true, size: "lg" },
    { id: "diary_objectives", position: 6, visible: true, size: "lg" },
  ],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    authReady: true,
    user: authState.user,
  }),
}));

vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardData: useDashboardDataMock,
}));

vi.mock("@/hooks/useDashboardLayout", () => ({
  useDashboardLayout: () => ({
    layout: dashboardLayoutState.layout,
  }),
}));

vi.mock("@/lib/apiClient", () => {
  return {
    getJson: getJsonMock,
  };
});

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: useWendyPageContextMock,
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
  NextRoutineWidget: () => <section>Prossima routine</section>,
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
    apiFetchMock.mockResolvedValue({ ok: true });
    dashboardLayoutState.layout = [
      { id: "tools", position: 0, visible: true, size: "lg" },
      { id: "clarity_path", position: 1, visible: true, size: "lg" },
      { id: "discovery_feed", position: 2, visible: true, size: "lg" },
      { id: "career_comparison", position: 3, visible: true, size: "lg" },
      { id: "kpi_strip", position: 4, visible: true, size: "lg" },
      { id: "week_timeline", position: 5, visible: true, size: "lg" },
      { id: "diary_objectives", position: 6, visible: true, size: "lg" },
    ];
    authState.user = {
      id: 7,
      name: "Ada",
      journeyType: "dipendente",
      onboardingCompleted: true,
      avatarUrl: null,
    };
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

  it("promotes discovery feed above tools when the indeciso user has completed the test", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      journeyType: "indeciso",
      onboardingCompleted: true,
      avatarUrl: null,
    };
    useDashboardDataMock.mockReturnValue({
      data: {
        user: {
          journeyType: "indeciso",
          name: "Ada",
          email: "ada@example.com",
          isPremium: false,
          onboardingCompleted: true,
        },
        session: null,
        objectives: [],
        objectivesProgress: { done: 0, total: 0, percent: 0 },
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
          recommendations: [
            { sectorId: 1, sectorName: "Product Design", matchScore: 91 },
            { sectorId: 2, sectorName: "UX Research", matchScore: 88 },
          ],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      if (url.endsWith("api/test-sessions/42")) {
        return {
          id: 42,
          recommendations: [
            { sectorId: 1, sectorName: "Product Design", matchScore: 91 },
            { sectorId: 2, sectorName: "UX Research", matchScore: 88 },
          ],
          riasecScores: {},
          primaryTypes: ["A"],
          spiritScores: {},
          createdAt: "2026-05-30T00:00:00.000Z",
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    const clarity = await screen.findByText(/mappa della chiarezza/i);
    const sectors = await screen.findByText(/settori consigliati per te/i);
    const tools = await screen.findByRole("heading", { name: /strumenti del percorso/i });

    expect(clarity.compareDocumentPosition(sectors) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sectors.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const wendyContext = useWendyPageContextMock.mock.calls.at(-1)?.[0];
    expect(wendyContext?.page).toBe("dashboard");
    expect(wendyContext?.adaptivePhase).toBe("explore_sectors");
    expect(wendyContext?.adaptiveNextAction).toEqual({
      label: "Esplora settori",
      href: "/settori",
      sectionId: "discovery_feed",
    });
    expect(wendyContext?.savedSectorsCount).toBe(0);
  });

  it("renders the full adaptive dashboard shell for an indeciso user before the first test", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      journeyType: "indeciso",
      onboardingCompleted: false,
      avatarUrl: null,
    };
    useDashboardDataMock.mockReturnValue({
      data: {
        user: {
          journeyType: "indeciso",
          name: "Ada",
          email: "ada@example.com",
          isPremium: false,
          onboardingCompleted: false,
        },
        session: null,
        objectives: [],
        objectivesProgress: { done: 0, total: 0, percent: 0 },
        upcomingEvents: [],
      },
      isLoading: false,
      isError: false,
      refetch: refetchDashboardMock,
    });
    getJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith("api/test-sessions/latest")) {
        return {
          sessionId: null,
          recommendations: [],
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    expect(await screen.findByText("Dashboard hero")).toBeInTheDocument();
    expect(await screen.findByText(/mappa della chiarezza/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inizia il test/i })).toHaveAttribute("href", "/test");
    const wendyContext = useWendyPageContextMock.mock.calls.at(-1)?.[0];
    expect(wendyContext?.adaptivePhase).toBe("start_test");
    expect(wendyContext?.adaptiveNextAction).toEqual({
      label: "Inizia il test",
      href: "/test",
      sectionId: "clarity_path",
    });
  });

  it("uses persisted dashboard decision state when auth context still says indeciso", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      journeyType: "indeciso",
      onboardingCompleted: true,
      avatarUrl: null,
    };
    useDashboardDataMock.mockReturnValue({
      data: {
        user: {
          journeyType: "dipendente",
          journeyDecidedAt: "2026-06-01T10:00:00.000Z",
          journeyDecisionSource: "percorso_page",
          name: "Ada",
          email: "ada@example.com",
          isPremium: false,
          onboardingCompleted: true,
        },
        session: null,
        objectives: [],
        objectivesProgress: { done: 0, total: 0, percent: 0 },
        upcomingEvents: [],
      },
      isLoading: false,
      isError: false,
      refetch: refetchDashboardMock,
    });
    getJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith("api/test-sessions/latest")) {
        return {
          sessionId: null,
          recommendations: [],
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    await screen.findByText("Dashboard hero");
    const wendyContext = useWendyPageContextMock.mock.calls.at(-1)?.[0];
    expect(wendyContext?.journeyType).toBe("dipendente");
    expect(wendyContext?.adaptivePhase).toBe("active_journey");
    expect(wendyContext?.adaptiveNextAction).toEqual({
      label: "Apri prossima routine",
      href: "/dashboard",
      sectionId: "next_routine",
    });
  });

  it("renders the active journey next routine above saved standard layout order", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      journeyType: "dipendente",
      onboardingCompleted: true,
      avatarUrl: null,
    };
    dashboardLayoutState.layout = [
      { id: "week_timeline", position: 0, visible: true, size: "lg" },
      { id: "kpi_strip", position: 1, visible: true, size: "lg" },
      { id: "next_routine", position: 2, visible: false, size: "lg" },
      { id: "tools", position: 3, visible: true, size: "lg" },
    ];
    useDashboardDataMock.mockReturnValue({
      data: {
        user: {
          journeyType: "dipendente",
          journeyDecidedAt: null,
          journeyDecisionSource: null,
          name: "Ada",
          email: "ada@example.com",
          isPremium: false,
          onboardingCompleted: true,
        },
        session: null,
        objectives: [],
        objectivesProgress: { done: 0, total: 0, percent: 0 },
        upcomingEvents: [],
      },
      isLoading: false,
      isError: false,
      refetch: refetchDashboardMock,
    });
    getJsonMock.mockImplementation(async (url: string) => {
      if (url.endsWith("api/test-sessions/latest")) {
        return {
          sessionId: null,
          recommendations: [],
        };
      }
      return { layout: [] };
    });

    renderDashboard();

    const nextRoutine = await screen.findByText(/prossima routine/i);
    const timeline = await screen.findByText(/timeline settimanale/i);
    expect(nextRoutine.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
