import { describe, expect, it } from "vitest";
import { resolveWebDevHttps, resolveWebPort } from "./dev-port";

describe("resolveWebPort", () => {
  it("ignores the generic API PORT and defaults the web dev server to 5173", () => {
    expect(resolveWebPort({ PORT: "3001" })).toBe(5173);
  });

  it("uses VITE_PORT when explicitly set", () => {
    expect(resolveWebPort({ PORT: "3001", VITE_PORT: "5174" })).toBe(5174);
  });
});

describe("resolveWebDevHttps", () => {
  it("defaults local web dev to HTTP to avoid browser certificate errors", () => {
    expect(resolveWebDevHttps({})).toBe(false);
  });

  it("enables HTTPS only when VITE_DEV_HTTPS is explicitly true", () => {
    expect(resolveWebDevHttps({ VITE_DEV_HTTPS: "true" })).toBe(true);
  });
});
