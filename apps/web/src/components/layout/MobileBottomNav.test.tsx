import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

let mockLocation = "/dashboard";
const mockNavigate = vi.fn();
const topNavItems = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: { journeyType: "dipendente" },
  }),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => ({
    open: vi.fn(),
    isOpen: false,
    isSpeaking: false,
    phase: "idle",
  }),
}));

vi.mock("@/hooks/useProactiveInsights", () => ({
  useProactiveInsights: () => ({ unreadCount: 0 }),
}));

vi.mock("@/hooks/useTopNavigationLayout", () => ({
  useTopNavigationLayout: topNavItems,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => [mockLocation, mockNavigate],
}));

describe("MobileBottomNav", () => {
  beforeEach(() => {
    mockLocation = "/dashboard";
    topNavItems.mockReturnValue({
      items: [
        { href: "/dashboard", label: "NorthStar", brand: true },
        { href: "/lavori", label: "Offerte" },
        { href: "/coach", label: "Coach" },
        { href: "/crescita", label: "Crescita personale" },
        { href: "/social", label: "Social" },
      ],
    });
  });

  it("shows Crescita personale in the top nav and does not expose Wendy", () => {
    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Crescita personale")).toHaveAttribute("href", "/crescita");
    expect(screen.queryByLabelText(/Apri Wendy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Wendy")).not.toBeInTheDocument();
  });

  it("renders the saved top navigation order and hidden state", () => {
    topNavItems.mockReturnValue({
      items: [
        { href: "/dashboard", label: "NorthStar", brand: true },
        { href: "/crescita", label: "Crescita personale" },
        { href: "/coach", label: "Coach" },
      ],
    });

    render(<MobileBottomNav />);

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(links).toEqual(["NorthStar", "Crescita personale", "Coach"]);
    expect(screen.queryByLabelText("Offerte")).not.toBeInTheDocument();
  });

  it("uses the active logo URL for the brand navigation item", () => {
    topNavItems.mockReturnValue({
      items: [
        { href: "/dashboard", label: "NorthStar", brand: true, logoUrl: "/brand/aurora.svg" },
      ],
    });

    render(<MobileBottomNav />);

    expect(screen.getByAltText("")).toHaveAttribute("src", "/brand/aurora.svg");
  });

  it("switches to the social sub-nav on social routes", () => {
    mockLocation = "/social/leaderboard";

    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Torna indietro")).toBeInTheDocument();
    expect(screen.getByLabelText("Feed")).toHaveAttribute("href", "/social/feed");
    expect(screen.getByLabelText("Leaderboard")).toHaveAttribute("href", "/social/leaderboard");
    expect(screen.getByLabelText("Chat")).toHaveAttribute("href", "/social/chat");
    expect(screen.getByLabelText("Profilo")).toHaveAttribute("href", "/social/profilo");
    expect(screen.queryByLabelText("Offerte")).not.toBeInTheDocument();
  });
});
