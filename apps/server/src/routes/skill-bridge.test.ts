import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createMemorySkillBridgeStore,
  createSkillBridgeRouter,
  type SkillBridgeStore,
} from "./skill-bridge";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {},
    usersTable: { clerkId: "users.clerk_id" },
  };
});

function token(userId = 42) {
  return jwt.sign(
    {
      userId,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "dipendente",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store: SkillBridgeStore) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/user/skill-bridge", createSkillBridgeRouter({ store }));
  return instance;
}

describe("skill bridge routes", () => {
  it("requires authentication", async () => {
    await request(app(createMemorySkillBridgeStore()))
      .get("/api/user/skill-bridge")
      .expect(401);
  });

  it("returns a 3-ring profession map from aggregated user skills", async () => {
    const response = await request(app(createMemorySkillBridgeStore()))
      .get("/api/user/skill-bridge")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.center).toMatchObject({
      userId: 42,
      skills: ["SQL", "React", "Storytelling", "Python", "Dashboard"],
    });
    expect(response.body.professions.length).toBeGreaterThan(0);
    expect(response.body.professions.length).toBeLessThanOrEqual(30);
    for (const profession of response.body.professions) {
      expect([1, 2, 3]).toContain(profession.ring);
      expect(profession.overlapPercent).toBeGreaterThanOrEqual(0);
      expect(profession.overlapPercent).toBeLessThanOrEqual(100);
      expect(profession.learnTimeWeeks).toBe(profession.missingSkills.length * 4);
    }

    const analyst = response.body.professions.find((item: { title: string }) => item.title === "Data Analyst");
    expect(analyst).toMatchObject({
      overlapSkills: ["SQL", "Dashboard"],
      missingSkills: ["Statistics"],
      ring: 1,
      overlapPercent: 67,
    });
  });

  it("applies sector and salary filters", async () => {
    const response = await request(app(createMemorySkillBridgeStore()))
      .get("/api/user/skill-bridge?sectorId=2&minSalary=30000")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.filtersApplied).toEqual({
      sectorId: 2,
      minSalary: 30000,
    });
    expect(response.body.professions.map((item: { title: string }) => item.title)).toEqual(["Product Manager"]);
  });
});
