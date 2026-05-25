import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { WendyProvider, useWendy } from "./WendyProvider";

const play = vi.fn();

vi.mock("../hooks/useWendyOpenAITTS", () => ({
  useWendyOpenAITTS: () => ({ play }),
}));

vi.mock("../hooks/useBrowserTTS", () => ({
  useBrowserTTS: () => ({
    isSupported: true,
    play,
  }),
}));

function SpeakOnMount() {
  const { speak } = useWendy();
  useEffect(() => {
    speak("ciao");
  }, [speak]);
  return null;
}

describe("WendyProvider", () => {
  it("speaks through an internal bridge without window globals", async () => {
    render(
      <WendyProvider>
        <SpeakOnMount />
      </WendyProvider>,
    );

    await waitFor(() =>
      expect(play).toHaveBeenCalledWith("ciao", expect.any(String)),
    );
    expect(
      (window as unknown as { __wendySpeak?: unknown }).__wendySpeak,
    ).toBeUndefined();
  });
});
