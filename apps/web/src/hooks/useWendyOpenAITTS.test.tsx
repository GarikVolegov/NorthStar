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
      await result.current.play("Leggi questa risposta");
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
});
