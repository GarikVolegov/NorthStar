import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createMemorySimulatedDaysStore,
  createSimulatedDaysRouter,
  type SimulatedDaysStore,
} from "./simulated-days";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token(userId = 42) {
  return jwt.sign(
    {
      userId,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store: SimulatedDaysStore) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/simulated-days", createSimulatedDaysRouter({ store }));
  return instance;
}

describe("simulated-days routes", () => {
  it("requires authentication for generation", async () => {
    await request(app(createMemorySimulatedDaysStore())).post("/api/simulated-days/generate").send({ professionId: 7 }).expect(401);
  });

  it("generates a saved three-scene simulation for the current user", async () => {
    const response = await request(app(createMemorySimulatedDaysStore()))
      .post("/api/simulated-days/generate")
      .set("Authorization", `Bearer ${token()}`)
      .send({ professionId: 7 })
      .expect(200);

    expect(response.body).toMatchObject({
      simulationId: 1,
      professionId: 7,
      roleTitle: "Data Analyst",
      completedAt: null,
    });
    expect(response.body.scenes).toHaveLength(3);
    expect(response.body.scenes[0].timeBlock).toBe("morning");
  });

  it("completes only simulations owned by the current user", async () => {
    const store = createMemorySimulatedDaysStore();
    const generated = await request(app(store))
      .post("/api/simulated-days/generate")
      .set("Authorization", `Bearer ${token(42)}`)
      .send({ professionId: 7 })
      .expect(200);

    await request(app(store))
      .post(`/api/simulated-days/${generated.body.simulationId}/complete`)
      .set("Authorization", `Bearer ${token(99)}`)
      .send({ responses: {} })
      .expect(404);

    const response = await request(app(store))
      .post(`/api/simulated-days/${generated.body.simulationId}/complete`)
      .set("Authorization", `Bearer ${token(42)}`)
      .send({
        responses: {
          morning: { choiceId: "investigate", emotion: 5 },
          afternoon: { orderedIds: ["customer", "quality", "speed"], emotion: 4 },
          evening: { comfort: 80, emotion: 4 },
        },
      })
      .expect(200);

    expect(response.body.debrief.radar.energy).toBeGreaterThan(70);
    expect(response.body.completedAt).toBeTruthy();
  });

  it("returns the latest completed state by profession", async () => {
    const store = createMemorySimulatedDaysStore();
    const generated = await request(app(store))
      .post("/api/simulated-days/generate")
      .set("Authorization", `Bearer ${token(42)}`)
      .send({ professionId: 7 })
      .expect(200);

    await request(app(store))
      .post(`/api/simulated-days/${generated.body.simulationId}/complete`)
      .set("Authorization", `Bearer ${token(42)}`)
      .send({ responses: { evening: { comfort: 70, emotion: 4 } } })
      .expect(200);

    const response = await request(app(store))
      .get("/api/simulated-days/by-profession/7")
      .set("Authorization", `Bearer ${token(42)}`)
      .expect(200);

    expect(response.body).toMatchObject({
      completed: true,
      simulationId: 1,
      roleTitle: "Data Analyst",
    });
  });
});
