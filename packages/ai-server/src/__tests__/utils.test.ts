import { describe, expect, it } from "vitest";
import { withTimeout } from "../utils";

describe("withTimeout", () => {
  it("resolves fast operations", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 10, "test")).resolves.toBe("ok");
  });

  it("rejects slow operations with the service name", async () => {
    await expect(
      withTimeout(new Promise((resolve) => setTimeout(resolve, 25)), 1, "embedder"),
    ).rejects.toThrow(/embedder timeout/);
  });
});
