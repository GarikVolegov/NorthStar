import { describe, expect, it } from "vitest";

import { buildCorsAllowlist, isCorsOriginAllowed } from "./cors-origin";

describe("CORS origin allowlist", () => {
  it("allows the current Vercel deployment origin in production", () => {
    const env = {
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_URL: "appsweb-e63944sn1-volegovgarik9-9928s-projects.vercel.app",
    };

    expect(
      isCorsOriginAllowed(
        "https://appsweb-e63944sn1-volegovgarik9-9928s-projects.vercel.app",
        env,
      ),
    ).toBe(true);
  });

  it("includes configured public app URLs without trailing slash mismatches", () => {
    const allowlist = buildCorsAllowlist({
      PUBLIC_APP_URL: "https://ainorthstar.vercel.app/",
      ALLOWED_ORIGINS: "https://web-production-91c8.up.railway.app/",
    });

    expect(allowlist.has("https://ainorthstar.vercel.app")).toBe(true);
    expect(allowlist.has("https://web-production-91c8.up.railway.app")).toBe(true);
  });

  it("keeps unrelated production origins blocked", () => {
    expect(
      isCorsOriginAllowed("https://example.com", {
        NODE_ENV: "production",
        VERCEL: "1",
        VERCEL_URL: "appsweb-e63944sn1-volegovgarik9-9928s-projects.vercel.app",
      }),
    ).toBe(false);
  });

  it("allows same-origin production requests even when the alias is not configured", () => {
    expect(
      isCorsOriginAllowed(
        "https://ainorthstar.vercel.app",
        { NODE_ENV: "production" },
        new Set(),
        "https://ainorthstar.vercel.app",
      ),
    ).toBe(true);
  });
});
