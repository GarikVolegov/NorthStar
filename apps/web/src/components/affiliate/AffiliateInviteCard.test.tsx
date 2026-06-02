import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliateInviteCard } from "./AffiliateInviteCard";
import type { AffiliateInvitePreview } from "@/hooks/useAffiliateInvitePreview";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      resolvedLanguage: "en-US",
      language: "it",
    },
  }),
}));

const handlers = {
  onCopy: vi.fn(),
  onShare: vi.fn(),
  onOpenDashboard: vi.fn(),
};

function renderCard(preview: AffiliateInvitePreview, props: Partial<React.ComponentProps<typeof AffiliateInviteCard>> = {}) {
  return render(
    <AffiliateInviteCard
      preview={preview}
      copied={false}
      {...handlers}
      {...props}
    />,
  );
}

describe("AffiliateInviteCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("uses dynamic translations for full ready-state UI copy without translating referral data", () => {
    renderCard({
      status: "ready",
      referralCode: "REF-ADA-42",
      referralLink: "https://northstar.test/ref/REF-ADA-42",
    });

    expect(screen.getByText("dynamic:affiliate.invite.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:affiliate.invite.description")).toBeInTheDocument();
    expect(screen.getByText("dynamic:affiliate.invite.codeLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:affiliate.invite.copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:affiliate.invite.share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dynamic:affiliate.invite.dashboard" })).toBeInTheDocument();
    expect(screen.getByText("REF-ADA-42")).toBeInTheDocument();

    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en",
      source: "Invita amici",
      key: "affiliate.invite.title",
    }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({
      source: "REF-ADA-42",
    }));
  });

  it("uses dynamic translations for compact and status-specific copy", () => {
    renderCard({
      status: "loading",
      referralCode: null,
      referralLink: null,
    }, { compact: true });

    expect(screen.getByText("dynamic:affiliate.invite.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:affiliate.invite.loadingAction")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:affiliate.invite.dashboardShort/ })).toBeInTheDocument();
  });

  it("uses dynamic translations for fallback and copied action labels", () => {
    const { rerender } = renderCard({
      status: "unavailable",
      referralCode: null,
      referralLink: null,
    });

    expect(screen.getByRole("button", { name: "dynamic:affiliate.invite.activateAction" })).toBeInTheDocument();

    rerender(
      <AffiliateInviteCard
        preview={{
          status: "ready",
          referralCode: null,
          referralLink: "https://northstar.test/ref/link-only",
        }}
        copied
        {...handlers}
      />,
    );

    expect(screen.getByRole("button", { name: "dynamic:affiliate.invite.copied" })).toBeInTheDocument();
    expect(screen.getByText("https://northstar.test/ref/link-only")).toBeInTheDocument();
  });
});
