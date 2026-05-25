import { beforeAll, describe, expect, it } from "vitest";
import type { validateJwtSecret as validateJwtSecretType } from "./jwt-secret";

let validateJwtSecret: typeof validateJwtSecretType;

describe("validateJwtSecret", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    ({ validateJwtSecret } = await import("./jwt-secret"));
  });

  it("allows any configured value in test", () => {
    expect(validateJwtSecret("short", "test")).toBe("short");
  });

  it("rejects missing, weak, and placeholder secrets outside test", () => {
    expect(() => validateJwtSecret(undefined, "production")).toThrow(
      "not configured",
    );
    expect(() => validateJwtSecret("short", "production")).toThrow(
      "at least 32",
    );
    expect(() =>
      validateJwtSecret("test-secret-value-with-enough-length!", "production"),
    ).toThrow("placeholder");
    expect(() =>
      validateJwtSecret("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "production"),
    ).toThrow("variety");
  });

  it("accepts strong production secrets", () => {
    expect(validateJwtSecret("A-very-long-prod-key-1234567890!!", "production")).toBe(
      "A-very-long-prod-key-1234567890!!",
    );
  });
});
