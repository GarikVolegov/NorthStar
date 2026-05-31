import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LOGO_PRESETS } from "@workspace/api-zod/logo-presets";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoPicker } from "./LogoPicker";

const setLogoPresetMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useLogoPreset", async () => {
  const presets = await vi.importActual<typeof import("@workspace/api-zod/logo-presets")>(
    "@workspace/api-zod/logo-presets",
  );

  return {
    useLogoPreset: () => ({
      activePreset: presets.LOGO_PRESETS[0],
      presets: presets.LOGO_PRESETS,
      isLoading: false,
      isSaving: false,
      error: null,
      setLogoPreset: setLogoPresetMock,
    }),
  };
});

describe("LogoPicker", () => {
  beforeEach(() => {
    setLogoPresetMock.mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  it("renders the 12 official logo variants from the app catalog", () => {
    render(<LogoPicker />);

    expect(LOGO_PRESETS).toHaveLength(12);
    expect(screen.getByText("12 varianti del logo")).toBeInTheDocument();
    expect(screen.getByText("Attivo: 01")).toBeInTheDocument();

    for (const label of [
      "Icona Classica",
      "Minimal Flat",
      "Abstract Spark",
      "Constellation",
      "Lente Gold",
      "Compass Nav.",
      "Ethereal Glow",
      "Geometric",
      "Filigree",
      "Dynamic Motion",
      "Digital Glitch",
      "Dark Mode",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("saves the chosen preset id", async () => {
    const user = userEvent.setup();
    render(<LogoPicker />);

    await user.click(screen.getByRole("button", { name: /Digital Glitch/i }));

    expect(setLogoPresetMock).toHaveBeenCalledWith("digital-glitch");
  });
});
