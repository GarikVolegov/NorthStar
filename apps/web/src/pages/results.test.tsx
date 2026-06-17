import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  getTestSession: vi.fn(),
  useAgentAnalysis: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useLocation: () => ["/risultati/123", vi.fn()],
  useParams: () => ({ id: "123" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ refetchQueries: vi.fn() }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetTestSessionQueryKey: (id: number) => ["test-session", id],
  useConfirmSector: () => ({ mutate: vi.fn() }),
  useGetStatsSummary: () => ({ data: null }),
  useGetTestSession: (...args: unknown[]): unknown => apiState.getTestSession(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useAgentAnalysis", () => ({
  useAgentAnalysis: (...args: unknown[]): unknown => apiState.useAgentAnalysis(...args),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/lib/motion", () => ({
  durations: { fast: 0, normal: 0, slow: 0, verySlow: 0 },
  easings: { easeOut: "easeOut", easeIn: "easeIn", easeInOut: "easeInOut" },
  fadeIn: {},
  fadeInDown: {},
  fadeInLeft: {},
  fadeInRight: {},
  fadeInUp: {},
  listItem: {},
  pageVariants: {},
  scaleIn: {},
  springs: {},
  staggerContainer: {},
  staggerFast: {},
  staggerSlow: {},
  useReducedMotion: () => true,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/components/WorkModeSelector", () => ({
  WorkModeSelector: () => <div />,
  useWorkPreference: () => ({
    workPreference: null,
    save: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/components/skeletons/ResultsSkeleton", () => ({
  ResultsSkeleton: () => <div data-testid="results-skeleton" />,
}));

import Results from "./results";

describe("Results page", () => {
  it("renders the loading skeleton without reading spirit scores from a missing session", () => {
    apiState.getTestSession.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    apiState.useAgentAnalysis.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    render(<Results />);

    expect(screen.getByTestId("results-skeleton")).toBeInTheDocument();
    expect(apiState.useAgentAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ spiritScores: undefined }),
    );
  });
});
