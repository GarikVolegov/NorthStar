import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, nftCertificatesTable } from "@workspace/db";
import { sendOptionalReadFallback } from "../lib/persistence";

const router = Router();

/* ─── GET /api/nft-certificates/me ─── */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const certs = await db
      .select()
      .from(nftCertificatesTable)
      .where(eq(nftCertificatesTable.userId, req.user!.id));
    res.json(certs);
  } catch (err) {
    req.log?.error?.({ err }, "nft-certificates error");
    if (sendOptionalReadFallback(req, res, err, "nft-certificates.mine", [])) return;
    res.json([]);
  }
});

export default router;
