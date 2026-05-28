import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettings } from "./ProfileSettings";

const patchJsonMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const setIsLeftyMock = vi.hoisted(() => vi.fn());
const setAudioMutedMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  patchJson: patchJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ updateUser: updateUserMock, user: { id: 42, journeyType: "dipendente" } }),
}));

vi.mock("@/hooks/useLefty", () => ({
  useLefty: () => ({ isLefty: false, setIsLefty: setIsLeftyMock }),
}));

vi.mock("@/contexts/AppAudioProvider", () => ({
  useAppAudio: () => ({
    setMuted: setAudioMutedMock,
    snapshot: {
      activated: false,
      ambientActive: true,
      muted: false,
      ritualPlayed: false,
      supported: true,
    },
  }),
}));

vi.mock("@/components/user-background/BackgroundPicker", () => ({
  BackgroundPicker: () => null,
}));

vi.mock("@/components/profile/settings/ChangePasswordSection", () => ({
  ChangePasswordSection: () => <div>Cambio password</div>,
}));

vi.mock("@/components/profile/settings/EditProfileInfoSection", () => ({
  EditProfileInfoSection: () => <div>Modifica profilo</div>,
}));

vi.mock("@/components/profile/settings/PrivacyCard", () => ({
  PrivacyCard: () => <div>Privacy card</div>,
}));

vi.mock("@/components/profile/MonthlyRitualSettings", () => ({
  MonthlyRitualSettings: () => <div>Monthly ritual settings</div>,
}));

vi.mock("@/components/profile/NotificationSettings", () => ({
  NotificationSettings: () => <div>Notification settings</div>,
}));

vi.mock("@/components/profile/LogoPicker", () => ({
  LogoPicker: () => <div>Logo dell'app</div>,
}));

vi.mock("@/components/profile/DashboardNavigationSettings", () => ({
  DashboardNavigationSettings: () => (
    <div>
      <p>Dashboard</p>
      <p>Barra superiore</p>
    </div>
  ),
}));

vi.mock("@/components/ui/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileSettings
        user={{
          id: 42,
          name: "Ada",
          email: "ada@example.com",
          testSessionId: null,
          avatarUrl: null,
          journeyType: "dipendente",
        }}
      />
    </QueryClientProvider>,
  );
}

describe("ProfileSettings dashboard and navigation controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hosts dashboard and top navigation personalization in profile settings", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /dashboard e navigazione/i }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Barra superiore")).toBeInTheDocument();
  });

  it("hosts logo personalization inside appearance settings", async () => {
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: /aspetto/i }));

    expect(await screen.findByText("Logo dell'app")).toBeInTheDocument();
  });
});
