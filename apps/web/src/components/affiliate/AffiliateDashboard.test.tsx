import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { AffiliateDashboard } from "./AffiliateDashboard";
import { apiFetch } from "@/lib/api-fetch";

const dashboardHook = vi.hoisted(() => vi.fn());
const withdrawHook = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useAffiliateDashboard", () => ({
  formatCents: (cents: number) => `EUR ${(cents / 100).toFixed(2)}`,
  useAffiliateDashboard: dashboardHook,
  useAffiliateCopyLink: () => vi.fn().mockResolvedValue(undefined),
  useAffiliateWithdraw: withdrawHook,
}));

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: PropsWithChildren) => <>{children}</>,
  DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogDescription: ({ children }: PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
}));

const dashboardData = {
  balance: 0,
  pendingBalance: 0,
  totalEarned: 0,
  referralCode: "ADA42",
  referralLink: "https://northstar.test/sign-up?ref=ADA42",
  qrCodeUrl: "/api/affiliate/qr",
  referrals: [],
  subscription: {
    plan: "free",
    status: "active",
    currentPeriodEnd: null,
  },
  minWithdrawAmount: 900,
};

describe("AffiliateDashboard", () => {
  beforeEach(() => {
    dashboardHook.mockReturnValue({
      data: dashboardData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    withdrawHook.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    vi.mocked(apiFetch).mockResolvedValue({ ok: false } as Response);
    Object.assign(navigator, { clipboard: undefined });
    document.execCommand = vi.fn(() => false);
  });

  it("does not claim the referral link was copied when all copy methods fail", async () => {
    render(<AffiliateDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /^copia$/i }));

    await waitFor(() => {
      expect(screen.getByText(/non siamo riusciti a copiare/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /copiato/i })).not.toBeInTheDocument();
  });

  it("shows a retryable QR error when the authenticated QR request fails", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: false } as Response);

    render(<AffiliateDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/qr non disponibile/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /riprova qr/i })).toBeInTheDocument();
  });
});
