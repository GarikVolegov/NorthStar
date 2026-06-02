import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  authReady: true,
  isLoggedIn: false,
  updateUser: vi.fn(),
  user: null as null | {
    id: number;
    journeyType?: string;
    name: string;
    onboardingCompleted?: boolean;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; returnObjects?: boolean }) => {
      if (options?.returnObjects) {
        if (key === "chiSiamo.values") {
          return [
            { title: "Chiarezza", desc: "Direzione concreta." },
            { title: "Empatia", desc: "Percorsi rispettati." },
          ];
        }
        if (key === "chiSiamo.methodSteps") {
          return [
            { title: "Test", desc: "Capisci il profilo." },
            { title: "Matching", desc: "Trovi settori coerenti." },
          ];
        }
        if (key === "chiSiamo.whatWeDoFeatures") {
          return [{ label: "Test", desc: "Una bussola iniziale." }];
        }
        if (key === "chiSiamo.whoWeServeItems") {
          return ["Persone al primo orientamento"];
        }
        return [];
      }
      return options?.defaultValue ?? key;
    },
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
  useLocation: () => ["/", routerState.navigate],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({ open: vi.fn(), phase: "idle", isOpen: false }),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetStatsSummary: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/features/home/homeApi", () => ({
  useHomeNews: () => ({ data: { news: [] }, isLoading: false }),
  useLatestRecommendations: () => ({ data: null, isLoading: false }),
  useTrendingSectors: () => ({ data: [] }),
}));

vi.mock("@/components/motion", () => ({
  AnimateOnScroll: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AnimateOnScrollItem: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    create:
      (Component: React.ComponentType<React.PropsWithChildren>) =>
      ({ children, ...props }: React.PropsWithChildren) => (
        <Component {...props}>{children}</Component>
      ),
  },
}));

vi.mock("@/features/home/GuestPersonaHero", () => ({
  GuestPersonaHero: () => (
    <section data-testid="guest-persona-section">
      <h2>Per chi e NorthStar</h2>
    </section>
  ),
}));

vi.mock("@/features/home/TrendingMobileStrip", () => ({
  TrendingMobileStrip: () => null,
}));

vi.mock("@/features/home/HomeNewsCard", () => ({
  HomeNewsCard: () => <article />,
}));

vi.mock("@/features/home/LoggedInHero", () => ({
  LoggedInHero: () => null,
}));

vi.mock("@/features/home/QuickToolsSection", () => ({
  QuickToolsSection: () => null,
}));

vi.mock("@/features/home/PersonalizedRecommendationsSection", () => ({
  PersonalizedRecommendationsSection: () => null,
}));

vi.mock("@/components/calendario/ProssimiEventi", () => ({
  ProssimiEventi: () => null,
}));

vi.mock("@/components/OnboardingWizard", () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard" />,
}));

vi.mock("@/components/brand/AppLogo", () => ({
  AppLogo: ({ alt }: { alt?: string }) => <span>{alt ?? "NorthStar"}</span>,
}));

import ChiSiamo from "./chi-siamo";
import Home from "./home";

describe("Home integrated landing", () => {
  beforeEach(() => {
    routerState.navigate.mockClear();
    authState.authReady = true;
    authState.isLoggedIn = false;
    authState.updateUser.mockClear();
    authState.user = null;
    localStorage.clear();
  });

  it("introduces NorthStar before showing persona choices to a new visitor", () => {
    const { container } = render(<Home />);

    const narrativeHero = screen.getByTestId("guest-narrative-hero");
    const personaSection = screen.getByTestId("guest-persona-section");

    expect(narrativeHero).toHaveTextContent(
      "NorthStar e la bussola per capire quale direzione professionale ha senso per te.",
    );
    expect(
      narrativeHero.compareDocumentPosition(personaSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelector("#chi-siamo")).toBeInTheDocument();
  });

  it("redirects the legacy Chi siamo route to the integrated home anchor", () => {
    render(<ChiSiamo />);

    expect(routerState.navigate).toHaveBeenCalledWith("/#chi-siamo", {
      replace: true,
    });
  });

  it("keeps logged-in users on the home page when they still need onboarding", () => {
    vi.useFakeTimers();
    authState.isLoggedIn = true;
    authState.user = {
      id: 7,
      journeyType: "indeciso",
      name: "Ada",
      onboardingCompleted: false,
    };

    render(<Home />);

    expect(routerState.navigate).not.toHaveBeenCalledWith("/dashboard");

    act(() => {
      vi.advanceTimersByTime(601);
    });

    expect(screen.getByTestId("onboarding-wizard")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
