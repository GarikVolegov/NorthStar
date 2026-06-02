import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());
const i18nState = vi.hoisted(() => ({
  language: "it",
  resolvedLanguage: "it",
}));
const authState = vi.hoisted(() => ({
  isLoggedIn: true,
  user: { journeyType: "dipendente" as string | null },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
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

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { ...i18nState },
  }),
}));

vi.mock("@/hooks/useLogoPreset", async () => {
  const presets = await vi.importActual<typeof import("@workspace/api-zod/logo-presets")>(
    "@workspace/api-zod/logo-presets",
  );

  return {
    useLogoPreset: () => ({
      activePreset: presets.LOGO_PRESETS.find((preset) => preset.id === "digital-glitch")!,
    }),
  };
});

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/dashboard"],
}));

describe("MobileBottomNav", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
    i18nState.language = "it";
    i18nState.resolvedLanguage = "it";
    authState.isLoggedIn = true;
    authState.user = { journeyType: "dipendente" };
  });

  it("shows Crescita personale in the top nav and does not expose Wendy", () => {
    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Crescita personale")).toHaveAttribute("href", "/crescita");
    expect(screen.queryByLabelText(/Apri Wendy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Wendy")).not.toBeInTheDocument();
    expect(screen.getByLabelText("NorthStar").querySelector("img")).toHaveAttribute(
      "src",
      "/brand/logo-digital-glitch.svg",
    );
  });

  it("uses dynamic translations for visible navigation labels", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    render(<MobileBottomNav />);

    expect(screen.getByLabelText("dynamic:nav.northStar")).toHaveAttribute("href", "/dashboard");
    expect(screen.getByLabelText("dynamic:nav.jobs")).toHaveAttribute("href", "/lavori");
    expect(screen.getByLabelText("dynamic:nav.growthPersonal")).toHaveAttribute("href", "/crescita");
    expect(screen.getByLabelText("dynamic:nav.social")).toHaveAttribute("href", "/social");
  });

  it("does not split sector and role exploration for indeciso users", () => {
    authState.user = { journeyType: "indeciso" };

    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Settore+ruolo")).toHaveAttribute("href", "/settori");
    expect(screen.queryByLabelText("Offerte")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ruoli")).not.toBeInTheDocument();
  });
});
