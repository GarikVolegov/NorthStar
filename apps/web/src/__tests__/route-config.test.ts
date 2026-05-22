import { describe, expect, it } from "vitest";
import { routes } from "../route-config";

describe("frontend route config", () => {
  it("exposes standalone admin pages used by navigation and smoke tests", () => {
    const paths = new Set(routes.map((route) => route.path));

    expect(paths.has("/admin-metriche")).toBe(true);
    expect(paths.has("/admin-cataloghi")).toBe(true);
    expect(paths.has("/admin-status")).toBe(true);
    expect(paths.has("/admin-rag")).toBe(true);
  });
});
