/**
 * Test unitari per referralCodeService.ts
 * Esegui con: pnpm --filter @northstar/server test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del modulo db prima di importare il service
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("../referralService.js", () => ({
  confirmReferral: vi.fn().mockResolvedValue(undefined),
}));

import { resolveReferralCode, attachReferralToUser, processPostPaymentReferral } from "../referralCodeService.js";
import { db } from "@workspace/db";
import { confirmReferral } from "../referralService.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveReferralCode", () => {
  it("restituisce null per codici senza prefisso NS-A-", async () => {
    const result = await resolveReferralCode("INVALID-CODE");
    expect(result).toBeNull();
  });

  it("restituisce null per stringa vuota", async () => {
    const result = await resolveReferralCode("");
    expect(result).toBeNull();
  });

  it("normalizza il codice in uppercase prima della query", async () => {
    (db.limit as any).mockResolvedValueOnce([{ id: 42 }]);
    const result = await resolveReferralCode("ns-a-1234");
    expect(result).toBe(42);
  });

  it("restituisce null se il codice non esiste nel db", async () => {
    (db.limit as any).mockResolvedValueOnce([]);
    const result = await resolveReferralCode("NS-A-9999");
    expect(result).toBeNull();
  });
});

describe("attachReferralToUser", () => {
  it("non lancia se il codice è vuoto", async () => {
    await expect(attachReferralToUser(1, "")).resolves.toBeUndefined();
  });

  it("non propaga eccezioni — registrazione non deve fallire", async () => {
    (db.limit as any).mockRejectedValueOnce(new Error("db error"));
    await expect(attachReferralToUser(1, "NS-A-0001")).resolves.toBeUndefined();
  });

  it("scrive referredByCode + referredByAffiliateId se il codice è valido", async () => {
    // Prima chiamata: resolveReferralCode → affiliateId = 7
    (db.limit as any).mockResolvedValueOnce([{ id: 7 }]);
    // Seconda chiamata: update
    (db.where as any).mockResolvedValueOnce(undefined);

    await attachReferralToUser(99, "NS-A-0001");

    expect(db.update).toHaveBeenCalled();
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({
        referredByCode: "NS-A-0001",
        referredByAffiliateId: 7,
      })
    );
  });
});

describe("processPostPaymentReferral", () => {
  it("è idempotente se referralConvertedAt è già impostato", async () => {
    (db.limit as any).mockResolvedValueOnce([{
      referredByAffiliateId: 5,
      referredByCode: "NS-A-0001",
      referralConvertedAt: new Date(),
    }]);

    await processPostPaymentReferral(1);
    expect(confirmReferral).not.toHaveBeenCalled();
  });

  it("non fa nulla se l'utente non esiste", async () => {
    (db.limit as any).mockResolvedValueOnce([]);
    await processPostPaymentReferral(999);
    expect(confirmReferral).not.toHaveBeenCalled();
  });

  it("chiama confirmReferral se referredByAffiliateId è presente e non ancora convertito", async () => {
    (db.limit as any).mockResolvedValueOnce([{
      referredByAffiliateId: 3,
      referredByCode: "NS-A-0002",
      referralConvertedAt: null,
    }]);
    (db.where as any).mockResolvedValueOnce(undefined); // update referralConvertedAt

    await processPostPaymentReferral(42);

    expect(confirmReferral).toHaveBeenCalledWith(
      expect.objectContaining({ referrerId: 3, referredUserId: 42 })
    );
  });
});
