import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Plan } from "@/hooks/useSubscription";
import Abbonamento from "./abbonamento";

type MockSubscriptionState = {
  plan: Plan;
  isPro: boolean;
  isTeam: boolean;
  isFree: boolean;
  validUntil: string | null;
  canAccess: (feature: string) => boolean;
  isLoading: boolean;
};

const subscriptionState = vi.hoisted((): { value: MockSubscriptionState } => ({
  value: {
    plan: "free" as Plan,
    isPro: false,
    isTeam: false,
    isFree: true,
    validUntil: null as string | null,
    canAccess: () => false,
    isLoading: false,
  },
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => subscriptionState.value,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function setPlan(plan: Plan, validUntil: string | null = null) {
  subscriptionState.value = {
    plan,
    isPro: plan === "pro" || plan === "team",
    isTeam: plan === "team",
    isFree: plan === "free",
    validUntil,
    canAccess: () => plan !== "free",
    isLoading: false,
  };
}

describe("Abbonamento", () => {
  it("shows the free plan with an upgrade link", () => {
    setPlan("free");

    render(<Abbonamento />);

    expect(screen.getByRole("heading", { name: /gestione abbonamento/i })).toBeInTheDocument();
    expect(screen.getByText("Piano Free")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /passa a pro/i })).toHaveAttribute("href", "/premium");
  });

  it("shows the pro plan with a team discovery link and renewal date", () => {
    setPlan("pro", "2026-06-30T00:00:00.000Z");

    render(<Abbonamento />);

    expect(screen.getByText("Piano Pro")).toBeInTheDocument();
    expect(screen.getByText(/rinnovo previsto il 30 giugno/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scopri team/i })).toHaveAttribute("href", "/premium");
  });

  it("shows the team plan with a support link", () => {
    setPlan("team");

    render(<Abbonamento />);

    expect(screen.getByText("Piano Team")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contatta supporto/i })).toHaveAttribute("href", "/contatti");
  });

  it("shows a loading placeholder while subscription data loads", () => {
    subscriptionState.value = {
      ...subscriptionState.value,
      isLoading: true,
    };

    render(<Abbonamento />);

    expect(screen.getByTestId("subscription-management-loading")).toBeInTheDocument();
  });
});
