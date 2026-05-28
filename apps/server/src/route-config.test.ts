import { describe, expect, it } from "vitest";
import { routeConfig } from "./route-config";

describe("server route config", () => {
  it("mounts communities as an authenticated API domain", () => {
    expect(routeConfig.find((route) => route.path === "/api/communities")).toMatchObject({
      path: "/api/communities",
      auth: "authenticated",
      description: "Comunita social",
    });
  });

  it("mounts diary as an authenticated API domain", () => {
    expect(routeConfig.find((route) => route.path === "/api/diary")).toMatchObject({
      path: "/api/diary",
      auth: "authenticated",
      description: "Diario personale",
    });
  });
});
