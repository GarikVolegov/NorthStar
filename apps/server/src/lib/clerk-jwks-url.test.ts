import { describe, expect, it } from "vitest";
import { resolveClerkJwksUrl, resolveClerkJwtVerifyOptions } from "./clerk-jwks-url";

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

  it("derives issuer verification from the Clerk frontend API", () => {
    expect(resolveClerkJwtVerifyOptions({
      CLERK_FRONTEND_API: "saving-possum-85.clerk.accounts.dev",
    } as NodeJS.ProcessEnv)).toMatchObject({
      issuer: "https://saving-possum-85.clerk.accounts.dev",
    });
  });

  it("uses explicit issuer and audience verification when configured", () => {
    expect(resolveClerkJwtVerifyOptions({
      CLERK_JWT_ISSUER: "https://issuer.example",
      CLERK_JWT_AUDIENCE: "northstar-web,northstar-mobile",
    } as NodeJS.ProcessEnv)).toMatchObject({
      issuer: "https://issuer.example",
      audience: ["northstar-web", "northstar-mobile"],
    });
  });
});
