import { render, screen } from "@testing-library/react";
import { NAV_LABELS } from "@/lib/constants";
import { describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "./MobileBottomNav";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    user: { journeyType: "dipendente" },
  }),
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
  it("shows Crescita personale in the top nav and does not expose Wendy", () => {
    render(<MobileBottomNav />);

    expect(screen.getByLabelText("Crescita personale")).toHaveAttribute("href", "/crescita");
    expect(screen.queryByLabelText(/Apri Wendy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Wendy")).not.toBeInTheDocument();
    expect(screen.getByLabelText(NAV_LABELS.northStar).querySelector("img")).toHaveAttribute(
      "src",
      "/brand/logo-digital-glitch.svg",
    );
  });
});
