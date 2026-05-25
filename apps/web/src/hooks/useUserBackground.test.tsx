import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserBackground } from "./useUserBackground";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
const patchJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());
const createVariantsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly body: unknown,
    ) {
      super(message);
      this.name = "ApiClientError";
    }
  },
  getJson: getJsonMock,
  postJson: postJsonMock,
  patchJson: patchJsonMock,
  deleteJson: deleteJsonMock,
}));

vi.mock("@/features/user-background/imageVariants", () => ({
  createUserBackgroundVariants: createVariantsMock,
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useUserBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createVariantsMock.mockResolvedValue({
      dataUrl: "data:image/png;base64,desktop",
      dataUrlMobile: "data:image/png;base64,mobile",
    });
  });

  it("loads active preset and exposes presets", async () => {
    getJsonMock.mockResolvedValue({ activeBackgroundId: "preset:aurora", library: [] });

    const { result } = renderHook(() => useUserBackground(7), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getJsonMock).toHaveBeenCalledWith("/api/profile/me/backgrounds");
    expect(result.current.presets.length).toBeGreaterThan(0);
    expect(result.current.activeBackground?.kind).toBe("preset");
  });

  it("sets active preset", async () => {
    getJsonMock.mockResolvedValue({ activeBackgroundId: null, library: [] });
    patchJsonMock.mockResolvedValue({ activeBackgroundId: "preset:focus" });

    const { result } = renderHook(() => useUserBackground(7), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setActiveBackground("preset:focus");
    });

    expect(patchJsonMock).toHaveBeenCalledWith("/api/profile/me/backgrounds/active", {
      id: "preset:focus",
    });
  });

  it("rolls back optimistic active preset when persistence fails", async () => {
    getJsonMock.mockResolvedValue({ activeBackgroundId: "preset:aurora", library: [] });
    patchJsonMock.mockRejectedValue(new Error("Persistenza non disponibile"));

    const { result } = renderHook(() => useUserBackground(7), { wrapper });
    await waitFor(() => expect(result.current.activeBackgroundId).toBe("preset:aurora"));

    await expect(
      act(async () => {
        await result.current.setActiveBackground("preset:focus");
      }),
    ).rejects.toThrow("Persistenza non disponibile");

    expect(result.current.activeBackgroundId).toBe("preset:aurora");
    await waitFor(() => {
      expect(result.current.serverError).toBe("Persistenza non disponibile");
    });
  });

  it("uploads image variants and stores returned entry", async () => {
    getJsonMock.mockResolvedValue({ activeBackgroundId: null, library: [] });
    postJsonMock.mockResolvedValue({
      entry: {
        id: "abc",
        dataUrl: "data:image/png;base64,desktop",
        dataUrlMobile: "data:image/png;base64,mobile",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
      library: [],
    });

    const { result } = renderHook(() => useUserBackground(7), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.uploadBackground({
        file: new File(["x"], "bg.png", { type: "image/png" }),
        label: "Studio",
      });
    });

    const postCalls = postJsonMock.mock.calls as Array<
      [string, { dataUrl: string; dataUrlMobile: string; label?: string }]
    >;
    expect(postCalls[0]?.[0]).toBe("/api/profile/me/backgrounds");
    expect(postCalls[0]?.[1].dataUrl).toMatch(/^data:image\//);
    expect(postCalls[0]?.[1].dataUrlMobile).toMatch(/^data:image\//);
    expect(postCalls[0]?.[1].label).toBe("Studio");
  });

  it("deletes active user background and refreshes state", async () => {
    getJsonMock.mockResolvedValue({
      activeBackgroundId: "user:abc",
      library: [
        {
          id: "abc",
          dataUrl: "data:image/png;base64,desktop",
          dataUrlMobile: "data:image/png;base64,mobile",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
      ],
    });
    deleteJsonMock.mockResolvedValue({ activeBackgroundId: null, library: [] });

    const { result } = renderHook(() => useUserBackground(7), { wrapper });
    await waitFor(() => expect(result.current.activeBackground?.kind).toBe("user"));

    await act(async () => {
      await result.current.deleteBackground("abc");
    });

    expect(deleteJsonMock).toHaveBeenCalledWith("/api/profile/me/backgrounds/abc");
  });

  it("updates liquid glass appearance settings", async () => {
    getJsonMock.mockResolvedValue({ activeBackgroundId: null, library: [] });
    patchJsonMock.mockResolvedValue({
      appearance: {
        mode: "manual",
        glassOpacity: 0.58,
        blur: 20,
        overlay: 0.32,
        saturation: 1.15,
        desktopPosition: "center",
        mobilePosition: "top",
      },
    });

    const { result } = renderHook(() => useUserBackground(7), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateAppearance({
        mode: "manual",
        glassOpacity: 0.58,
        blur: 20,
      });
    });

    expect(patchJsonMock).toHaveBeenCalledWith("/api/profile/me/backgrounds/appearance", {
      mode: "manual",
      glassOpacity: 0.58,
      blur: 20,
    });
    expect(result.current.appearance.mode).toBe("manual");
    expect(result.current.appearance.blur).toBe(20);
  });
});
