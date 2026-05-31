import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

import grafoRouter from "./grafo";

function token() {
  return jwt.sign(
    {
      userId: 42,
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

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/grafo", grafoRouter);
  return instance;
}

describe("legacy grafo routes", () => {
  it("requires authentication", async () => {
    await request(app()).get("/api/grafo/7").expect(401);
  });

  it("returns graph data with nodes and edges for a sector id", async () => {
    const response = await request(app())
      .get("/api/grafo/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      nodes: expect.any(Array),
      edges: expect.any(Array),
    });
    expect(response.body.nodes[0]).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      type: expect.stringMatching(/^(role|skill|tool|certification)$/),
      description: expect.any(String),
    });
  });

  it("streams a compatible SSE chat response", async () => {
    const response = await request(app())
      .post("/api/grafo/7/chat")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        messages: [{ role: "user", content: "Che competenze servono?" }],
        nodes: [{ id: "skill-1", label: "Analisi dati", type: "skill", description: "Base" }],
        edges: [],
        sectorName: "Data",
      })
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.text).toContain("data: ");
    expect(response.text).toContain("[DONE]");
  });

  it("rejects chat requests with an invalid sector id", async () => {
    await request(app())
      .post("/api/grafo/not-a-sector/chat")
      .set("Authorization", `Bearer ${token()}`)
      .send({ messages: [{ role: "user", content: "Che competenze servono?" }] })
      .expect(400, { error: "Settore non valido" });
  });
});
