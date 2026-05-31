import { describe, expect, it } from "vitest";
import { resolveClerkJwksUrl } from "./clerk-jwks-url";

describe("resolveClerkJwksUrl", () => {
  it("uses explicit CLERK_JWKS_URL when configured", () => {
    expect(resolveClerkJwksUrl({
      CLERK_JWKS_URL: "https://clerk.example/.well-known/jwks.json",
    } as NodeJS.ProcessEnv)).toBe("https://clerk.example/.well-known/jwks.json");
  });

  it("derives the JWKS URL from the Clerk frontend API URL", () => {
    expect(resolveClerkJwksUrl({
      CLERK_FRONTEND_API_URL: "saving-possum-85.clerk.accounts.dev/",
    } as NodeJS.ProcessEnv)).toBe("https://saving-possum-85.clerk.accounts.dev/.well-known/jwks.json");
  });

  it("derives the JWKS URL from the publishable key frontend API payload", () => {
    const frontendApi = "saving-possum-85.clerk.accounts.dev$";
    const key = `pk_test_${Buffer.from(frontendApi).toString("base64")}`;

    expect(resolveClerkJwksUrl({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: key,
    } as NodeJS.ProcessEnv)).toBe("https://saving-possum-85.clerk.accounts.dev/.well-known/jwks.json");
  });
});
