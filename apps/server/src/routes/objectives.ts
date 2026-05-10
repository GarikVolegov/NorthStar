import { Router, type IRouter } from "express";
import { db, userObjectivesTable, calendarEventsTable, nftCertificatesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt";
import { createHash } from "crypto";

const HASH_SECRET = process.env.JWT_SECRET ?? "northstar-nft-secret-2025";

function generateCertHash(userId: number, objectiveId: number, mintedAt: Date): string {
  const payload = `${userId}:${objectiveId}:${mintedAt.getTime()}:${HASH_SECRET}`;
  return createHash("sha256").update(payload).digest("hex");
}

async function autoMintNft(userId: number, obj: { id: number; text: string; category: string }): Promise<void> {
  try {
    const existing = await db.select({ id: nftCertificatesTable.id })
      .from(nftCertificatesTable)
      .where(and(
        eq(nftCertificatesTable.userId, userId),
        eq(nftCertificatesTable.objectiveId, obj.id),
      ))
      .limit(1);
    if (existing.length > 0) return;

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    const mintedAt = new Date();
    const hash = generateCertHash(userId, obj.id, mintedAt);

    await db.insert(nftCertificatesTable).values({
      userId,
      objectiveId: obj.id,
      objectiveText: obj.text,
      userName: user?.name ?? "Utente NorthStar",
      category: obj.category,
      certificateHash: hash,
      metadata: {
        objectiveCategory: obj.category,
        completedAt: mintedAt.toISOString(),
        mintedAt: mintedAt.toISOString(),
        chain: "northstar-chain",
        version: "1.0",
        autoMinted: true,
      },
      mintedAt,
    });
  } catch (err) {
    /* non bloccante — non interrompiamo il completamento obiettivo */
    console.warn("[nft-auto-mint] error:", err);
  }
}

async function syncCalendarEvent(
  userId: number,
  objectiveId: number,
  text: string,
  dueDate: string,
): Promise<void> {
  try {
    const start = new Date(dueDate);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(9, 30, 0, 0);
    await db.insert(calendarEventsTable).values({
      userId,
      title: `Scadenza: ${text}`,
      startAt: start,
      endAt: end,
      allDay: true,
      category: "task",
      priority: "medium",
      status: "todo",
      linkedGoal: `objective:${objectiveId}`,
      tags: [],
      linkedContentIds: [],
    });
  } catch {
    /* non bloccante */
  }
}

async function deleteLinkedCalendarEvent(objectiveId: number): Promise<void> {
  try {
    await db
      .delete(calendarEventsTable)
      .where(eq(calendarEventsTable.linkedGoal, `objective:${objectiveId}`));
  } catch {
    /* non bloccante */
  }
}

const router: IRouter = Router();

router.get("/objectives/me", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const objectives = await db
    .select()
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId));
  res.json(objectives);
});

router.get("/objectives/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const objectives = await db
    .select()
    .from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId));

  res.json(objectives);
});

router.post("/objectives", async (req, res): Promise<void> => {
  const { userId, text, category, dueDate } = req.body;
  if (!userId || !text?.trim()) { res.status(400).json({ error: "userId e text richiesti" }); return; }

  const [obj] = await db.insert(userObjectivesTable).values({
    userId,
    text: text.trim(),
    category: category ?? "altro",
    dueDate: dueDate ?? null,
    progress: 0,
  }).returning();

  if (dueDate && obj) {
    await syncCalendarEvent(userId, obj.id, obj.text, dueDate);
  }

  res.status(201).json(obj);
});

router.patch("/objectives/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { completed, progress, text, category, dueDate } = req.body;

  const updates: Record<string, unknown> = {};
  if (typeof completed === "boolean") {
    updates.completed = completed;
    updates.completedAt = completed ? new Date() : null;
    if (completed) updates.progress = 100;
  }
  if (typeof progress === "number") updates.progress = Math.min(100, Math.max(0, progress));
  if (typeof text === "string" && text.trim()) updates.text = text.trim();
  if (typeof category === "string") updates.category = category;
  if (dueDate !== undefined) updates.dueDate = dueDate ?? null;

  const [obj] = await db
    .update(userObjectivesTable)
    .set(updates)
    .where(eq(userObjectivesTable.id, id))
    .returning();

  if (!obj) { res.status(404).json({ error: "Obiettivo non trovato" }); return; }

  // Auto-mint NFT certificate when objective is marked as completed
  if (updates.completed === true && obj.userId) {
    autoMintNft(obj.userId, { id: obj.id, text: obj.text, category: obj.category });
  }

  res.json(obj);
});

router.delete("/objectives/:id", async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await deleteLinkedCalendarEvent(id);
  await db.delete(userObjectivesTable).where(eq(userObjectivesTable.id, id));
  res.json({ ok: true });
});

export default router;
