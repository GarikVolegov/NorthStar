import { describe, expect, it } from "vitest";
import {
  createCertificateIssuer,
  createMemoryCertificateStore,
} from "./certificate-issuer";

const COMPLETED_AT = new Date("2026-05-29T10:15:00.000Z");

function milestoneInput() {
  return {
    userId: 42,
    userName: "Ada Lovelace",
    objectiveId: 7,
    objectiveText: "Completa il percorso investitore",
    category: "analisi",
    completedAt: COMPLETED_AT,
  };
}

describe("certificate issuer", () => {
  it("issues an off-chain certificate with deterministic SHA-256 metadata", async () => {
    const issuer = createCertificateIssuer({
      store: createMemoryCertificateStore(),
    });

    const first = await issuer.issueMilestoneCertificate(milestoneInput());
    const second = await issuer.issueMilestoneCertificate(milestoneInput());

    expect(first.certificateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.certificateHash).toBe(second.certificateHash);
    expect(first.status).toBe("issued");
    expect(first.chain).toBe("NorthStar Ledger");
    expect(first.txHash).toBeNull();
    expect(first.metadata).toMatchObject({
      version: 1,
      objectiveId: 7,
      category: "analisi",
      issuedReason: "objective_completed",
      completedAt: COMPLETED_AT.toISOString(),
    });
  });

  it("keeps one certificate per user/objective pair", async () => {
    const store = createMemoryCertificateStore();
    const issuer = createCertificateIssuer({ store });

    await issuer.issueMilestoneCertificate(milestoneInput());
    await issuer.issueMilestoneCertificate({
      ...milestoneInput(),
      objectiveText: "Titolo aggiornato dopo il completamento",
    });

    expect(await store.listByUser(42)).toHaveLength(1);
  });
});
