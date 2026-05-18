import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, certificationsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const certificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().min(1).max(200),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialUrl: z.string().url().optional(),
  credentialId: z.string().trim().max(200).optional(),
  sector: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).default([]),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const items = await db
      .select()
      .from(certificationsTable)
      .where(and(
        eq(certificationsTable.userId, userId),
        isNull(certificationsTable.deletedAt),
      ))
      .orderBy(desc(certificationsTable.issuedDate), desc(certificationsTable.createdAt));

    res.json(items);
  } catch (err) {
    req.log?.error?.({ err }, "certifications list error");
    res.status(500).json({ error: "Errore nel caricamento delle certificazioni" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = certificationSchema.parse(req.body);

    const [item] = await db
      .insert(certificationsTable)
      .values({
        userId,
        name: data.name,
        issuer: data.issuer,
        issuedDate: data.issuedDate || null,
        expiryDate: data.expiryDate || null,
        credentialUrl: data.credentialUrl || null,
        credentialId: data.credentialId || null,
        sector: data.sector || null,
        skills: data.skills,
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Dati certificazione non validi" });
      return;
    }
    req.log?.error?.({ err }, "certification create error");
    res.status(500).json({ error: "Errore nel salvataggio della certificazione" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const [deleted] = await db
      .update(certificationsTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(certificationsTable.id, id),
        eq(certificationsTable.userId, userId),
        isNull(certificationsTable.deletedAt),
      ))
      .returning({ id: certificationsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Certificazione non trovata" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    req.log?.error?.({ err }, "certification delete error");
    res.status(500).json({ error: "Errore nell'eliminazione della certificazione" });
  }
});

export default router;
