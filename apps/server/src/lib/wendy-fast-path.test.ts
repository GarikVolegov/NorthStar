import { describe, expect, it } from "vitest";

import {
  buildFastPathFallback,
  readPositiveInt,
  withRouteTimeout,
} from "./wendy-fast-path";

describe("wendy fast path safeguards", () => {
  it("uses a local greeting fallback when the model is unavailable", () => {
    expect(buildFastPathFallback("ciao")).toContain("Ciao");
  });

  it("uses a generic recovery message for unknown simple questions", () => {
    expect(buildFastPathFallback("mi spieghi una cosa?")).toContain(
      "modello sta rispondendo troppo lentamente",
    );
  });

  it("normalizes positive integer env values", () => {
    expect(readPositiveInt("2500", 8000)).toBe(2500);
    expect(readPositiveInt("0", 8000)).toBe(8000);
    expect(readPositiveInt("nope", 8000)).toBe(8000);
    expect(readPositiveInt(undefined, 8000)).toBe(8000);
  });

  it("rejects slow model work with a labelled timeout", async () => {
    await expect(
      withRouteTimeout(
        new Promise<string>((resolve) => setTimeout(() => resolve("late"), 50)),
        5,
        "wendy fast path",
      ),
    ).rejects.toThrow("wendy fast path timeout after 5ms");
  });
});
