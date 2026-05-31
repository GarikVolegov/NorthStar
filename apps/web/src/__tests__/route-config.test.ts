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

  it("exposes the dedicated objectives page as a protected route", () => {
    const route = routes.find((item) => item.path === "/obiettivi");

    expect(route).toMatchObject({
      path: "/obiettivi",
      guard: "protected",
      layout: "default",
      title: "Obiettivi",
    });
  });

  it("registers dashboard-linked routines and mood tools as protected pages", () => {
    expect(routes.find((item) => item.path === "/routines")).toMatchObject({
      path: "/routines",
      guard: "protected",
      layout: "default",
      title: "Routine",
    });
    expect(routes.find((item) => item.path === "/mood")).toMatchObject({
      path: "/mood",
      guard: "protected",
      layout: "default",
      title: "Mood",
    });
  });

  it("keeps Italian CTA aliases wired to safe auth and premium destinations", () => {
    expect(routes.find((item) => item.path === "/accedi")).toMatchObject({
      path: "/accedi",
      guard: "publicOnly",
      layout: "default",
      title: "Accesso",
    });
    expect(routes.find((item) => item.path === "/registrati")).toMatchObject({
      path: "/registrati",
      guard: "publicOnly",
      layout: "default",
      title: "Registrazione",
    });
    expect(routes.find((item) => item.path === "/abbonamento")).toMatchObject({
      path: "/abbonamento",
      guard: "public",
      layout: "default",
      title: "Abbonamento",
    });
  });
});
