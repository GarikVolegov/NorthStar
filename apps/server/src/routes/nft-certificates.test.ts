import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCertificateIssuer,
  createMemoryCertificateStore,
  type CertificateStore,
} from "../services/certificates/certificate-issuer";
import { createNftCertificatesRouter } from "./nft-certificates";

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
      journeyType: "investitore",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(store: CertificateStore) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/nft-certificates", createNftCertificatesRouter({ store }));
  return instance;
}

async function issueSample(store: CertificateStore, isPublic = false) {
  const issuer = createCertificateIssuer({ store });
  const cert = await issuer.issueMilestoneCertificate({
    userId: 42,
    userName: "Ada Lovelace",
    objectiveId: 7,
    objectiveText: "Analizza 5 settori in crescita",
    category: "analisi",
    completedAt: new Date("2026-05-29T10:15:00.000Z"),
  });
  if (isPublic) {
    await store.setPublic(cert.certificateHash, true);
  }
  return cert;
}

describe("nft certificate routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the authenticated user's issued certificates as UI summaries", async () => {
    const store = createMemoryCertificateStore();
    const cert = await issueSample(store);

    const response = await request(app(store))
      .get("/api/nft-certificates/me")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.certificates).toEqual([
      expect.objectContaining({
        id: cert.id,
        objectiveText: "Analizza 5 settori in crescita",
        status: "issued",
        chain: "NorthStar Ledger",
        isPublic: false,
        certificateHash: cert.certificateHash,
        verifyUrl: `/certificato/${cert.certificateHash}`,
        imageUrl: `/api/nft-certificates/image/${cert.certificateHash}.svg`,
      }),
    ]);
  });

  it("verifies public certificates without authentication", async () => {
    const store = createMemoryCertificateStore();
    const cert = await issueSample(store, true);

    const response = await request(app(store))
      .get(`/api/nft-certificates/verify/${cert.certificateHash}`)
      .expect(200);

    expect(response.body).toMatchObject({
      valid: true,
      certificate: {
        objectiveText: "Analizza 5 settori in crescita",
        certificateHash: cert.certificateHash,
      },
    });
  });

  it("does not verify newly issued private or missing certificate hashes", async () => {
    const store = createMemoryCertificateStore();
    const privateCert = await issueSample(store);

    await request(app(store))
      .get(`/api/nft-certificates/verify/${privateCert.certificateHash}`)
      .expect(404);
    await request(app(store))
      .get("/api/nft-certificates/verify/missing")
      .expect(404);
  });

  it("renders a public certificate as SVG", async () => {
    const store = createMemoryCertificateStore();
    const cert = await issueSample(store, true);

    const response = await request(app(store))
      .get(`/api/nft-certificates/image/${cert.certificateHash}.svg`)
      .expect(200);

    expect(response.headers["content-type"]).toContain("image/svg+xml");
    const svg = response.text ?? response.body.toString("utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Analizza 5 settori in crescita");
    expect(svg).toContain(cert.certificateHash.slice(0, 16));
  });
});
