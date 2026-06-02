import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_STORAGE_KEY } from "@/lib/storage-keys";
import { useWendyOpenAITTS } from "./useWendyOpenAITTS";

describe("useWendyOpenAITTS", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("sends the session token to the Wendy voice endpoint", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "voice-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "TTS non disponibile" }),
    } as Response);

    const { result } = renderHook(() => useWendyOpenAITTS());

    await act(async () => {
      await result.current.play("Leggi questa risposta").catch(() => undefined);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/wendy/voice",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer voice-token",
        },
      }),
    );
  });

  it("rejects failed voice requests after exposing the error state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "Voce Wendy non disponibile" }),
    } as Response);

    const { result } = renderHook(() => useWendyOpenAITTS());

    let error: unknown;
    await act(async () => {
      try {
        await result.current.play("Leggi questa risposta");
      } catch (err) {
        error = err;
      }
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Voce Wendy non disponibile");
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Voce Wendy non disponibile");
  });
});
