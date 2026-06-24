import { describe, expect, it } from "vitest";
import { resolveWebPort } from "./dev-port";

describe("resolveWebPort", () => {
  it("ignores the generic API PORT and defaults the web dev server to 5273", () => {
    expect(resolveWebPort({ PORT: "3001" })).toBe(5273);
  });

  it("uses VITE_PORT when explicitly set", () => {
    expect(resolveWebPort({ PORT: "3001", VITE_PORT: "5174" })).toBe(5174);
  });
});
