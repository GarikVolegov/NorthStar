import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  location: "/diario",
  navigate: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Ada", journeyType: "dipendente" },
    authReady: true,
  }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/components/diary/DiaryReflections", () => ({
  DiaryReflections: () => <section>Riflessioni mock</section>,
}));

vi.mock("@/components/diary/DiaryIdeas", () => ({
  DiaryIdeas: () => <section>Idee mock</section>,
}));

vi.mock("@/components/diary/InvestorAnalysis", () => ({
  InvestorAnalysis: () => <section>Analisi mock</section>,
}));

vi.mock("@/components/diary/DiaryRecap", () => ({
  DiaryRecap: () => <section>Recap mock</section>,
}));

vi.mock("@/components/diary/DiaryObjectives", () => ({
  DiaryObjectives: () => <section>Obiettivi nel diario</section>,
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
  useLocation: () => [routerState.location, routerState.navigate] as const,
}));

import DiaryPage from "./diario";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <DiaryPage />
    </QueryClientProvider>,
  );
}

describe("DiaryPage", () => {
  it("shows objectives as a first-class diary tab", () => {
    routerState.location = "/diario";

    renderPage();

    expect(screen.getByRole("button", { name: /obiettivi/i })).toBeInTheDocument();
  });

  it("opens objectives directly from the objectives deep link", () => {
    routerState.location = "/diario?tab=objectives";

    renderPage();

    expect(screen.getByText("Obiettivi nel diario")).toBeInTheDocument();
    expect(screen.queryByText("Riflessioni mock")).not.toBeInTheDocument();
  });
});
