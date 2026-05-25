import { describe, expect, it } from "vitest";
import { dataUrlBytes, isUnderServerVariantLimit } from "./imageVariants";

describe("imageVariants", () => {
  it("measures data URL payloads against the server variant limit", () => {
    const tiny = `data:image/webp;base64,${"a".repeat(100)}`;
    const huge = `data:image/webp;base64,${"a".repeat(2_100_000)}`;

    expect(dataUrlBytes(tiny)).toBeGreaterThan(0);
    expect(isUnderServerVariantLimit(tiny)).toBe(true);
    expect(isUnderServerVariantLimit(huge)).toBe(false);
  });
});
