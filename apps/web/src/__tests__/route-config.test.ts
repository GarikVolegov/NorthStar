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

  it("keeps the legacy objectives route protected for diary redirects", () => {
    const route = routes.find((item) => item.path === "/obiettivi");

    expect(route).toMatchObject({
      path: "/obiettivi",
      guard: "protected",
      layout: "default",
      title: "Obiettivi",
    });
  });

  it("exposes subscription management as a protected route", () => {
    const route = routes.find((item) => item.path === "/abbonamento");

    expect(route).toMatchObject({
      path: "/abbonamento",
      guard: "protected",
      layout: "default",
      title: "Abbonamento",
    });
  });

  it("exposes the personal diary as a protected route", () => {
    const route = routes.find((item) => item.path === "/diario");

    expect(route).toMatchObject({
      path: "/diario",
      guard: "protected",
      layout: "default",
      title: "Diario",
    });
  });

  it("exposes social sections as protected deep-link routes", () => {
    const paths = new Map(routes.map((route) => [route.path, route]));

    for (const [path, title] of [
      ["/social/feed", "Social feed"],
      ["/social/leaderboard", "Leaderboard"],
      ["/social/chat", "Social chat"],
      ["/social/profilo", "Profilo social"],
    ] as const) {
      expect(paths.get(path)).toMatchObject({
        path,
        guard: "protected",
        layout: "default",
        title,
      });
    }
  });
});
