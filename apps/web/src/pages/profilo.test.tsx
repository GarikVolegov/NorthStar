import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profilo from "./profilo";

const authState = vi.hoisted(() => ({
  user: {
    id: 7,
    name: "Ada Lovelace",
    email: "ada@example.com",
    testSessionId: null,
    emailVerified: false,
    journeyType: "indeciso",
  },
}));

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
  patchJson: vi.fn(),
  deleteJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoggedIn: true,
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/components/LinkedInImportWizard", () => ({
  LinkedInImportWizard: () => null,
}));

vi.mock("@/components/profile/profile-sections", () => ({
  JourneySectionRenderer: () => null,
}));

vi.mock("@/components/user-background/BackgroundPicker", () => ({
  BackgroundPicker: () => null,
}));

vi.mock("@/components/profile/LogoPicker", () => ({
  LogoPicker: () => null,
}));

vi.mock("@/components/profile/NotificationSettings", () => ({
  NotificationSettings: () => null,
}));

vi.mock("@/components/profile/MonthlyRitualSettings", () => ({
  MonthlyRitualSettings: () => null,
}));

vi.mock("@/components/profile/DashboardNavigationSettings", () => ({
  DashboardNavigationSettings: () => null,
}));

vi.mock("@/components/NftCertificateGallery", () => ({
  NftCertificateGallery: () => null,
}));

vi.mock("@/components/profile/settings/PrivacyCard", () => ({
  PrivacyCard: () => null,
}));

vi.mock("@/components/profile/settings/ChangePasswordSection", () => ({
  ChangePasswordSection: () => null,
}));

vi.mock("@/contexts/AppAudioProvider", () => ({
  useAppAudio: () => ({
    snapshot: { supported: false, muted: true },
    setMuted: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLefty", () => ({
  useLefty: () => ({ isLefty: false, setIsLefty: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderProfilo() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Profilo />
    </QueryClientProvider>,
  );
}

describe("Profilo reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    getJsonMock.mockRejectedValue(new Error("profile unavailable"));
  });

  it("does not show email as verified when profile data fails and auth says it is unverified", async () => {
    renderProfilo();

    expect(await screen.findAllByText("Email non verificata")).not.toHaveLength(0);
    expect(screen.queryByText(/^Email verificata$/)).not.toBeInTheDocument();
  });

  it("shows a recoverable notice without replacing the profile page when profile details fail to load", async () => {
    renderProfilo();

    expect(await screen.findByText("Dettagli profilo non caricati")).toBeInTheDocument();
    expect(screen.getByText(/bio, citta, banner e preferenze/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova caricamento profilo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
  });
});
