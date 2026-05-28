import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSettings } from "./ProfileSettings";

const patchJsonMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const setIsLeftyMock = vi.hoisted(() => vi.fn());
const setAudioMutedMock = vi.hoisted(() => vi.fn());

let audioMuted = false;

vi.mock("@/lib/apiClient", () => ({
  patchJson: patchJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ updateUser: updateUserMock }),
}));

vi.mock("@/hooks/useLefty", () => ({
  useLefty: () => ({ isLefty: false, setIsLefty: setIsLeftyMock }),
}));

vi.mock("@/contexts/AppAudioProvider", () => ({
  useAppAudio: () => ({
    setMuted: setAudioMutedMock,
    snapshot: {
      activated: false,
      ambientActive: !audioMuted,
      muted: audioMuted,
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
          journeyType: "indeciso",
        }}
      />
    </QueryClientProvider>,
  );
}

function openAppearanceSettings() {
  fireEvent.click(screen.getByRole("button", { name: /aspetto/i }));
}

describe("ProfileSettings audio controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioMuted = false;
  });

  it("shows the soundscape switch as enabled when global audio is not muted", () => {
    renderSettings();
    openAppearanceSettings();

    expect(screen.getByText("Atmosfera sonora")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /atmosfera sonora/i })).toBeChecked();
  });

  it("mutes the global soundscape from the profile switch", () => {
    renderSettings();
    openAppearanceSettings();

    fireEvent.click(screen.getByRole("switch", { name: /atmosfera sonora/i }));

    expect(setAudioMutedMock).toHaveBeenCalledWith(true);
  });
});
