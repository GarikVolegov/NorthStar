import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundPicker } from "./BackgroundPicker";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useUserBackground", () => ({
  useUserBackground: hookMock,
}));

describe("BackgroundPicker", () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("renders presets and can set active background", async () => {
    const setActiveBackground = vi.fn().mockResolvedValue(undefined);
    hookMock.mockReturnValue({
      presets: [
        {
          id: "preset:aurora",
          name: "Aurora",
          description: "Luce",
          previewClassName: "bg-info-surface",
        },
      ],
      library: [],
      activeBackgroundId: null,
      loading: false,
      saving: false,
      uploading: false,
      error: null,
      serverError: null,
      persistenceUnavailable: false,
      imageTooLarge: false,
      appearance: {
        mode: "auto",
        glassOpacity: 0.72,
        blur: 18,
        overlay: 0.32,
        saturation: 1.08,
        desktopPosition: "center",
        mobilePosition: "center",
      },
      previewBackgroundId: null,
      setPreviewBackground: vi.fn(),
      updateAppearance: vi.fn(),
      setActiveBackground,
      uploadBackground: vi.fn(),
      deleteBackground: vi.fn(),
    });

    render(<BackgroundPicker userId={7} open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Personalizza sfondo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Anteprima Aurora/i }));
    fireEvent.click(screen.getByRole("button", { name: /Imposta/i }));

    await waitFor(() => {
      expect(setActiveBackground).toHaveBeenCalledWith("preset:aurora");
    });
  });

  it("shows library full state without crashing", async () => {
    const user = userEvent.setup();
    hookMock.mockReturnValue({
      presets: [],
      library: Array.from({ length: 5 }, (_, index) => ({
        id: String(index),
        dataUrl: "data:image/png;base64,desktop",
        dataUrlMobile: "data:image/png;base64,mobile",
        createdAt: "2026-05-25T00:00:00.000Z",
      })),
      activeBackgroundId: null,
      loading: false,
      saving: false,
      uploading: false,
      error: "Hai raggiunto il massimo (5).",
      serverError: "Hai raggiunto il massimo (5).",
      persistenceUnavailable: false,
      imageTooLarge: false,
      appearance: {
        mode: "auto",
        glassOpacity: 0.72,
        blur: 18,
        overlay: 0.32,
        saturation: 1.08,
        desktopPosition: "center",
        mobilePosition: "center",
      },
      previewBackgroundId: null,
      setPreviewBackground: vi.fn(),
      updateAppearance: vi.fn(),
      setActiveBackground: vi.fn(),
      uploadBackground: vi.fn(),
      deleteBackground: vi.fn(),
    });

    render(<BackgroundPicker userId={7} open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: /Foto/i }));

    expect(screen.getAllByText(/massimo/i).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /Carica foto/i })).toBeDisabled();
  });

  it("keeps presets available when background persistence is unavailable", () => {
    const setPreviewBackground = vi.fn();
    hookMock.mockReturnValue({
      presets: [
        {
          id: "preset:focus",
          name: "Focus",
          description: "Neutro",
          previewClassName: "bg-muted",
        },
      ],
      library: [],
      activeBackgroundId: null,
      loading: false,
      saving: false,
      uploading: false,
      error: null,
      serverError: "Persistenza non disponibile",
      persistenceUnavailable: true,
      imageTooLarge: false,
      appearance: {
        mode: "auto",
        glassOpacity: 0.72,
        blur: 18,
        overlay: 0.32,
        saturation: 1.08,
        desktopPosition: "center",
        mobilePosition: "center",
      },
      previewBackgroundId: null,
      setPreviewBackground,
      updateAppearance: vi.fn(),
      setActiveBackground: vi.fn(),
      uploadBackground: vi.fn(),
      deleteBackground: vi.fn(),
    });

    render(<BackgroundPicker userId={7} open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Anteprima Focus/i }));
    expect(setPreviewBackground).toHaveBeenCalledWith("preset:focus");
    expect(screen.getByText(/salveremo appena la persistenza/i)).toBeInTheDocument();
  });

  it("exposes liquid glass appearance controls", async () => {
    const user = userEvent.setup();
    const updateAppearance = vi.fn().mockResolvedValue(undefined);
    hookMock.mockReturnValue({
      presets: [],
      library: [],
      activeBackgroundId: null,
      loading: false,
      saving: false,
      uploading: false,
      error: null,
      serverError: null,
      persistenceUnavailable: false,
      imageTooLarge: false,
      appearance: {
        mode: "auto",
        glassOpacity: 0.72,
        blur: 18,
        overlay: 0.32,
        saturation: 1.08,
        desktopPosition: "center",
        mobilePosition: "center",
      },
      previewBackgroundId: null,
      setPreviewBackground: vi.fn(),
      updateAppearance,
      setActiveBackground: vi.fn(),
      uploadBackground: vi.fn(),
      deleteBackground: vi.fn(),
    });

    render(<BackgroundPicker userId={7} open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("tab", { name: /Aspetto/i }));
    await user.click(await screen.findByRole("button", { name: /Manuale/i }));

    await waitFor(() => {
      expect(updateAppearance).toHaveBeenCalledWith(expect.objectContaining({ mode: "manual" }));
    });
  });
});
