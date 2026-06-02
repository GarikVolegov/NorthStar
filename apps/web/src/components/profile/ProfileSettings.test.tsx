import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettings } from "./ProfileSettings";

const patchJsonMock = vi.hoisted(() => vi.fn());
const getJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());
const setMutedMock = vi.hoisted(() => vi.fn());
const setIsLeftyMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return {
    ...actual,
    deleteJson: deleteJsonMock,
    getJson: getJsonMock,
    patchJson: patchJsonMock,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: logoutMock,
    updateUser: updateUserMock,
  }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/profilo", navigateMock],
}));

vi.mock("@/contexts/AppAudioProvider", () => ({
  useAppAudio: () => ({
    snapshot: { supported: true, muted: true },
    setMuted: setMutedMock,
  }),
}));

vi.mock("@/hooks/useLefty", () => ({
  useLefty: () => ({ isLefty: false, setIsLefty: setIsLeftyMock }),
}));

vi.mock("@/components/profile/settings/ChangePasswordSection", () => ({
  ChangePasswordSection: () => <div />,
}));

vi.mock("@/components/profile/settings/EditProfileInfoSection", () => ({
  EditProfileInfoSection: () => <div />,
}));

vi.mock("@/components/profile/settings/PrivacyCard", () => ({
  PrivacyCard: () => <div />,
}));

vi.mock("@/components/profile/DashboardNavigationSettings", () => ({
  DashboardNavigationSettings: () => <div />,
}));

vi.mock("@/components/profile/LogoPicker", () => ({
  LogoPicker: () => <div />,
}));

vi.mock("@/components/profile/MonthlyRitualSettings", () => ({
  MonthlyRitualSettings: () => <div />,
}));

vi.mock("@/components/profile/NotificationSettings", () => ({
  NotificationSettings: () => <div />,
}));

vi.mock("@/components/user-background/BackgroundPicker", () => ({
  BackgroundPicker: () => <div />,
}));

vi.mock("@/components/NftCertificateGallery", () => ({
  NftCertificateGallery: () => <div />,
}));

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("ProfileSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        value: vi.fn(() => "blob:account-export"),
        configurable: true,
      });
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:account-export");
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        value: vi.fn(),
        configurable: true,
      });
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    }
    vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild");
  });

  it("shows profile fields when async profile data arrives after mount", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const user = {
      id: 7,
      name: "Ada",
      email: "ada@example.com",
      testSessionId: null,
      emailVerified: true,
    };

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ProfileSettings user={user} />
      </QueryClientProvider>,
    );

    expect(screen.queryByText("Costruisco strumenti affidabili per crescere.")).not.toBeInTheDocument();
    expect(screen.queryByText("Milano")).not.toBeInTheDocument();
    expect(screen.queryByText("ada-lovelace")).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <ProfileSettings
          user={user}
          bio="Costruisco strumenti affidabili per crescere."
          city="Milano"
          username="ada-lovelace"
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Costruisco strumenti affidabili per crescere.")).toBeInTheDocument();
    expect(screen.getByText("Milano")).toBeInTheDocument();
    expect(screen.getByText("ada-lovelace")).toBeInTheDocument();
  });

  it("reports Wendy tone save failures and keeps the previous tone selected", async () => {
    patchJsonMock.mockRejectedValue(new Error("Persistenza non disponibile"));
    const user = userEvent.setup();

    renderWithClient(
      <ProfileSettings
        user={{
          id: 7,
          name: "Ada",
          email: "ada@example.com",
          testSessionId: null,
          emailVerified: true,
        }}
        wendyTonePreference="auto"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aspetto/i }));
    await user.click(screen.getByRole("button", { name: /Conciso/i }));

    await waitFor(() => {
      expect(patchJsonMock).toHaveBeenCalledWith("/api/profile/7/tone", { tone: "concise" });
    });
    expect(
      await screen.findByText("Impossibile salvare il tono di Wendy. Riprova tra poco."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Automatico/i })).toHaveClass("border-primary/40");
    expect(screen.getByRole("button", { name: /Conciso/i })).not.toHaveClass("border-primary/40");
  });

  it("reports account export failures without creating a download", async () => {
    getJsonMock.mockRejectedValue(new Error("Export account non disponibile"));
    const user = userEvent.setup();

    renderWithClient(
      <ProfileSettings
        user={{
          id: 7,
          name: "Ada",
          email: "ada@example.com",
          testSessionId: null,
          emailVerified: true,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Privacy/i }));
    await user.click(screen.getByRole("button", { name: "Esporta dati account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Export account non disponibile");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Esporta dati account" })).toBeEnabled();
  });

  it("reports account delete failures and says the account was not changed", async () => {
    deleteJsonMock.mockRejectedValue(new Error("Eliminazione account non disponibile"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    renderWithClient(
      <ProfileSettings
        user={{
          id: 7,
          name: "Ada",
          email: "ada@example.com",
          testSessionId: null,
          emailVerified: true,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Privacy/i }));
    await user.click(screen.getByRole("button", { name: "Richiedi eliminazione account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nessuna modifica all'account");
    expect(screen.getByRole("button", { name: "Richiedi eliminazione account" })).toBeEnabled();
  });

  it("clears the current session and navigates to sign-in after account deletion succeeds", async () => {
    deleteJsonMock.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    renderWithClient(
      <ProfileSettings
        user={{
          id: 7,
          name: "Ada",
          email: "ada@example.com",
          testSessionId: null,
          emailVerified: true,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Privacy/i }));
    await user.click(screen.getByRole("button", { name: "Richiedi eliminazione account" }));

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith("/sign-in", { replace: true });
  });
});
