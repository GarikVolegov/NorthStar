import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createProfileNavigationLayoutRouter,
  type NavigationPreferencesStore,
  type TopNavigationLayoutItem,
} from "./profile-navigation-layout";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token(journeyType = "dipendente") {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store = createMemoryStore()) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/profile", createProfileNavigationLayoutRouter({ store }));
  return instance;
}

describe("profile navigation layout routes", () => {
  it("requires authentication", async () => {
    await request(app()).get("/api/profile/navigation-layout").expect(401);
  });

  it("returns journey defaults for a user without saved preferences", async () => {
    const response = await request(app())
      .get("/api/profile/navigation-layout")
      .set("Authorization", `Bearer ${token("autonomo")}`)
      .expect(200);

    expect(response.body.isDefault).toBe(true);
    expect(response.body.layout.slice(0, 2)).toEqual([
      { id: "dashboard", position: 0, visible: true },
      { id: "idea-validator", position: 1, visible: true },
    ]);
    expect(response.body.availableItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dashboard", locked: true }),
        expect.objectContaining({ id: "growth", label: "Crescita personale" }),
      ]),
    );
  });

  it("persists a valid custom layout", async () => {
    const store = createMemoryStore();
    const layout: TopNavigationLayoutItem[] = [
      { id: "dashboard", position: 0, visible: true },
      { id: "growth", position: 1, visible: true },
      { id: "coach", position: 2, visible: false },
    ];

    const response = await request(app(store))
      .put("/api/profile/navigation-layout")
      .set("Authorization", `Bearer ${token("dipendente")}`)
      .send({ layout })
      .expect(200);

    expect(response.body.isDefault).toBe(false);
    expect(response.body.layout).toEqual(layout);
    expect(await store.getNavigationLayout(42)).toEqual(layout);
  });

  it("rejects hidden locked items and too many visible items", async () => {
    await request(app())
      .put("/api/profile/navigation-layout")
      .set("Authorization", `Bearer ${token("dipendente")}`)
      .send({ layout: [{ id: "dashboard", position: 0, visible: false }] })
      .expect(400);

    await request(app())
      .put("/api/profile/navigation-layout")
      .set("Authorization", `Bearer ${token("dipendente")}`)
      .send({
        layout: [
          { id: "dashboard", position: 0, visible: true },
          { id: "jobs", position: 1, visible: true },
          { id: "coach", position: 2, visible: true },
          { id: "growth", position: 3, visible: true },
          { id: "social", position: 4, visible: true },
          { id: "news", position: 5, visible: true },
          { id: "sectors", position: 6, visible: true },
        ],
      })
      .expect(400);
  });

  it("resets to journey defaults", async () => {
    const store = createMemoryStore([
      { id: "dashboard", position: 0, visible: true },
      { id: "growth", position: 1, visible: true },
    ]);

    const response = await request(app(store))
      .post("/api/profile/navigation-layout/reset")
      .set("Authorization", `Bearer ${token("azienda")}`)
      .expect(200);

    expect(response.body.isDefault).toBe(true);
    expect(response.body.layout.slice(0, 2)).toEqual([
      { id: "dashboard", position: 0, visible: true },
      { id: "sectors", position: 1, visible: true },
    ]);
    expect(await store.getNavigationLayout(42)).toBeNull();
  });
});

function createMemoryStore(
  initial: TopNavigationLayoutItem[] | null = null,
): NavigationPreferencesStore {
  let saved = initial;
  return {
    async getNavigationLayout() {
      return saved;
    },
    async saveNavigationLayout(_userId, layout) {
      saved = layout;
      return layout;
    },
    async resetNavigationLayout() {
      saved = null;
    },
  };
}
