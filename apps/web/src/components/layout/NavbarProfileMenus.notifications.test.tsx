import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavbarDesktopProfileMenu } from "./NavbarProfileMenus";

const markRead = vi.fn();
const dismiss = vi.fn();

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [
      {
        id: 9,
        source: "monthly_ritual",
        severity: "info",
        title: "E' la Notte della Fondazione",
        body: "La tua Rotta del Mese e' pronta.",
        ctaLabel: "Apri il rito",
        ctaUrl: "/dashboard?ritual=notte-fondazione",
        iconKey: "moon-star",
        readAt: null,
        createdAt: "2026-05-27T10:00:00.000Z",
      },
    ],
    unreadCount: 1,
    markRead,
    dismiss,
    markAllRead: vi.fn(),
    openNotification: vi.fn(),
  }),
}));

vi.mock("@/components/subscription/SubscriptionStatus", () => ({
  SubscriptionChip: () => <span>Free</span>,
}));

vi.mock("@/components/affiliate/AffiliateInviteCard", () => ({
  AffiliateInviteCard: () => <div />,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" className={className} onClick={onClick}>{children}</button>
  ),
  DropdownMenuLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

describe("NavbarProfileMenus notifications", () => {
  it("renders notification center inside the profile menu", async () => {
    const onNavigate = vi.fn();
    render(<NavbarDesktopProfileMenu {...baseProps({ onNavigate })} />);

    expect(screen.getByText("Notifiche")).toBeInTheDocument();
    expect(screen.getByText("1 nuova")).toBeInTheDocument();
    expect(screen.getByText("E' la Notte della Fondazione")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Apri il rito" }));

    expect(markRead).toHaveBeenCalledWith(9);
    expect(onNavigate).toHaveBeenCalledWith("/dashboard?ritual=notte-fondazione");
  });
});

function baseProps(overrides: Partial<React.ComponentProps<typeof NavbarDesktopProfileMenu>> = {}) {
  return {
    user: {
      id: 42,
      name: "Ada",
      email: "ada@example.com",
      testSessionId: null,
      journeyType: "autonomo",
    },
    displayName: "Ada",
    initial: "A",
    profileBannerUrl: null,
    activeLanguage: "it",
    theme: "system",
    insightsUnread: 0,
    affiliatePreview: { status: "idle", referralCode: null, referralLink: null },
    affiliateLinkCopied: false,
    applicationsLabel: "Candidature",
    logoutLabel: "Esci",
    onNavigate: vi.fn(),
    onCopyAffiliate: vi.fn(),
    onShareAffiliate: vi.fn(),
    onThemeChange: vi.fn(),
    onLanguageChange: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof NavbarDesktopProfileMenu>;
}
