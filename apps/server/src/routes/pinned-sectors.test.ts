import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createMemoryPinnedSectorsStore,
  createPinnedSectorsRouter,
} from "./pinned-sectors";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "investitore",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/pinned-sectors", createPinnedSectorsRouter({ store: createMemoryPinnedSectorsStore() }));
  return instance;
}

describe("pinned sectors routes", () => {
  it("requires authentication", async () => {
    await request(app()).get("/api/pinned-sectors").expect(401);
  });

  it("pins, lists and unpins sectors for the current user", async () => {
    const server = app();

    await request(server)
      .post("/api/pinned-sectors")
      .set("Authorization", `Bearer ${token()}`)
      .send({ sectorId: 7 })
      .expect(201);

    const listResponse = await request(server)
      .get("/api/pinned-sectors")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);
    expect(listResponse.body.pinnedSectors).toMatchObject([{ sectorId: 7 }]);

    await request(server)
      .delete("/api/pinned-sectors/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    const emptyResponse = await request(server)
      .get("/api/pinned-sectors")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);
    expect(emptyResponse.body.pinnedSectors).toEqual([]);
  });

  it("rejects a fourth pinned sector", async () => {
    const server = app();
    for (const sectorId of [1, 2, 3]) {
      await request(server)
        .post("/api/pinned-sectors")
        .set("Authorization", `Bearer ${token()}`)
        .send({ sectorId })
        .expect(201);
    }

    await request(server)
      .post("/api/pinned-sectors")
      .set("Authorization", `Bearer ${token()}`)
      .send({ sectorId: 4 })
      .expect(409);
  });
});
