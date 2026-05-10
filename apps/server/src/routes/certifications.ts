import { Router } from "express";
import { db } from "@workspace/db";
import { certificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();

router.get("/certifications", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const certs = await db
    .select()
    .from(certificationsTable)
    .where(eq(certificationsTable.userId, userId))
    .orderBy(desc(certificationsTable.issuedDate));
  res.json(certs);
});

router.get("/certifications/public/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  const certs = await db
    .select()
    .from(certificationsTable)
    .where(eq(certificationsTable.userId, userId))
    .orderBy(desc(certificationsTable.issuedDate));
  res.json(certs);
});

router.post("/certifications", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const { name, issuer, issuedDate, expiryDate, credentialUrl, credentialId, sector, skills } = req.body as {
    name: string; issuer: string; issuedDate?: string; expiryDate?: string;
    credentialUrl?: string; credentialId?: string; sector?: string; skills?: string[];
  };
  if (!name?.trim() || !issuer?.trim()) {
    res.status(400).json({ error: "name e issuer obbligatori" }); return;
  }
  const [cert] = await db.insert(certificationsTable).values({
    userId, name, issuer,
    issuedDate: issuedDate || null,
    expiryDate: expiryDate || null,
    credentialUrl: credentialUrl || null,
    credentialId: credentialId || null,
    sector: sector || null,
    skills: skills || [],
  }).returning();
  res.status(201).json(cert);
});

router.patch("/certifications/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(certificationsTable).where(eq(certificationsTable.id, id));
  if (!existing || existing.userId !== userId) { res.status(404).json({ error: "Non trovata" }); return; }
  const { name, issuer, issuedDate, expiryDate, credentialUrl, credentialId, sector, skills, status } = req.body;
  await db.update(certificationsTable).set({
    ...(name && { name }),
    ...(issuer && { issuer }),
    ...(issuedDate !== undefined && { issuedDate }),
    ...(expiryDate !== undefined && { expiryDate }),
    ...(credentialUrl !== undefined && { credentialUrl }),
    ...(credentialId !== undefined && { credentialId }),
    ...(sector !== undefined && { sector }),
    ...(skills && { skills }),
    ...(status && { status }),
    updatedAt: new Date(),
  }).where(eq(certificationsTable.id, id));
  res.json({ ok: true });
});

router.delete("/certifications/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [existing] = await db.select().from(certificationsTable).where(eq(certificationsTable.id, id));
  if (!existing || existing.userId !== userId) { res.status(404).json({ error: "Non trovata" }); return; }
  await db.delete(certificationsTable).where(eq(certificationsTable.id, id));
  res.json({ ok: true });
});

export default router;
