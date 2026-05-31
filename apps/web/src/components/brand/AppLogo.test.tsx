import { render, screen } from "@testing-library/react";
import { LOGO_PRESETS } from "@workspace/api-zod/logo-presets";
import { describe, expect, it, vi } from "vitest";
import { AppLogo } from "./AppLogo";

vi.mock("@/hooks/useLogoPreset", () => ({
  useLogoPreset: () => ({
    activePreset: LOGO_PRESETS.find((preset) => preset.id === "digital-glitch")!,
  }),
}));

describe("AppLogo", () => {
  it("renders the active user-selected logo preset", () => {
    render(<AppLogo alt="NorthStar" className="h-8 w-8" />);

    const logo = screen.getByRole("img", { name: "NorthStar" });
    expect(logo).toHaveAttribute("src", "/brand/logo-digital-glitch.svg");
    expect(logo).toHaveClass("h-8", "w-8");
  });
});
