import { render, screen } from "@testing-library/react";
import type { AuthUser } from "@/contexts/AuthContext";
import { describe, expect, it, vi } from "vitest";
import { NavbarMobileProfileMenu } from "./NavbarProfileMenus";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("@/components/affiliate/AffiliateInviteCard", () => ({
  AffiliateInviteCard: () => null,
}));

vi.mock("@/components/subscription/SubscriptionStatus", () => ({
  SubscriptionChip: () => null,
}));

const user: AuthUser = {
  id: 42,
  email: "ada@example.com",
  name: "Ada",
  testSessionId: null,
  avatarUrl: null,
  journeyType: null,
};

function renderMobileProfileMenu() {
  return render(
    <NavbarMobileProfileMenu
      user={user}
      displayName="Ada"
      initial="A"
      profileBannerUrl={null}
      activeLanguage="en"
      theme="system"
      insightsUnread={2}
      affiliatePreview={{ status: "idle", referralCode: null, referralLink: null }}
      affiliateLinkCopied={false}
      applicationsLabel="dynamic:nav.applications"
      logoutLabel="dynamic:nav.logout"
      onNavigate={vi.fn()}
      onCopyAffiliate={vi.fn()}
      onShareAffiliate={vi.fn()}
      onThemeChange={vi.fn()}
      onLanguageChange={vi.fn()}
      onSignOut={vi.fn()}
    />,
  );
}

describe("NavbarProfileMenus", () => {
  it("uses dynamic translations for mobile profile menu copy", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

    renderMobileProfileMenu();

    expect(screen.getByRole("button", { name: "dynamic:nav.profileMenu.settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:nav.profileMenu.wendyInsight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:nav.profileMenu.setJourney" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:nav.applications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:nav.profileMenu.memoryShort" })).toBeInTheDocument();
    expect(screen.getByText("dynamic:nav.profileMenu.theme")).toBeInTheDocument();
    expect(screen.getByText("dynamic:nav.profileMenu.language")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:nav.logout" })).toBeInTheDocument();
  });
});
