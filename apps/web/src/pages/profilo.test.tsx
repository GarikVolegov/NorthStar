import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Profilo from "./profilo";

const getJsonMock = vi.hoisted(() => vi.fn());
const patchJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());
const useAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
  patchJson: patchJsonMock,
  deleteJson: deleteJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: useAuthMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/hooks/usePageModule", () => ({ usePageModule: vi.fn() }));
vi.mock("@/hooks/useWendyPageContext", () => ({ useWendyPageContext: vi.fn() }));
vi.mock("@/components/LinkedInImportWizard", () => ({
  LinkedInImportWizard: () => <div data-testid="linkedin-wizard" />,
}));
vi.mock("@/components/profile/ProfileSettings", () => ({
  ProfileSettings: () => <div>Impostazioni account esistenti</div>,
}));
vi.mock("@/components/profile/profile-sections", () => ({
  JourneySectionRenderer: () => <div>Sezioni percorso esistenti</div>,
}));
vi.mock("@/components/profile/PsychologicalProfileCard", () => ({
  PsychologicalProfileCard: () => <div>Card profilo psicologico</div>,
}));
vi.mock("@/components/profile/ProfilingConsentManager", () => ({
  ProfilingConsentManager: () => <div>Gestione consensi profiling</div>,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Profilo />
    </QueryClientProvider>,
  );
}

describe("Profilo page psychological tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      isLoggedIn: true,
      logout: vi.fn(),
      updateUser: vi.fn(),
      user: {
        id: 42,
        name: "Ada",
        email: "ada@example.com",
        avatarUrl: null,
        journeyType: "indeciso",
      },
    });
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("/api/profile/psychological-profile")) {
        return Promise.resolve({ profile: {}, consents: [] });
      }
      if (url.includes("/api/profile/42")) {
        return Promise.resolve({
          id: 42,
          name: "Ada",
          email: "ada@example.com",
          emailVerified: true,
          createdAt: "2026-05-20T00:00:00.000Z",
        });
      }
      if (url.includes("/api/completion/me")) {
        return Promise.resolve(null);
      }
      return Promise.resolve({});
    });
  });

  it("adds a dedicated psychological profile tab without removing overview content", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Impostazioni account esistenti")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /panoramica/i })).toBeInTheDocument();
    const psychologicalTab = screen.getByRole("tab", { name: /profilo psicologico/i });

    await user.click(psychologicalTab);

    expect(await screen.findByText("Card profilo psicologico")).toBeInTheDocument();
    expect(screen.getByText("Gestione consensi profiling")).toBeInTheDocument();
  });
});
