import { describe, expect, it } from "vitest";
import { resolveWebHttps, resolveWebPort } from "./dev-port";

describe("resolveWebPort", () => {
  it("ignores the generic API PORT and defaults the web dev server to 5173", () => {
    expect(resolveWebPort({ PORT: "3001" })).toBe(5173);
  });

  it("uses VITE_PORT when explicitly set", () => {
    expect(resolveWebPort({ PORT: "3001", VITE_PORT: "5174" })).toBe(5174);
  });
});

describe("resolveWebHttps", () => {
  it("serves localhost over HTTP by default", () => {
    expect(resolveWebHttps({})).toBe(false);
  });

  it("enables HTTPS only when explicitly requested", () => {
    expect(resolveWebHttps({ VITE_HTTPS: "true" })).toBe(true);
  });
});
