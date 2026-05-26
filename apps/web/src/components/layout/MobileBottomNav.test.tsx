import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

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

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/dashboard"],
}));

describe("MobileBottomNav", () => {
  it("shows Crescita personale in the top nav and does not expose Wendy", () => {
    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Crescita personale")).toHaveAttribute("href", "/crescita");
    expect(screen.queryByLabelText(/Apri Wendy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Wendy")).not.toBeInTheDocument();
  });
});
