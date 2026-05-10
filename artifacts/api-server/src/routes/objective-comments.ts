import { Router } from "express";
import { db, usersTable, userObjectivesTable } from "@workspace/db";
import { objectiveCommentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();

router.get("/objectives/:id/comments", async (req, res): Promise<void> => {
  const objectiveId = parseInt(req.params.id, 10);
  const comments = await db
    .select()
    .from(objectiveCommentsTable)
    .where(eq(objectiveCommentsTable.objectiveId, objectiveId))
    .orderBy(desc(objectiveCommentsTable.createdAt));

  const withAuthors = await Promise.all(
    comments.map(async (c) => {
      const [author] = await db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable).where(eq(usersTable.id, c.authorId));
      return { ...c, authorName: author?.name ?? "Utente" };
    })
  );
  res.json(withAuthors);
});

router.post("/objectives/:id/comments", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const objectiveId = parseInt(req.params.id, 10);
  const { content, reaction } = req.body as { content: string; reaction?: string };

  if (!content?.trim()) {
    res.status(400).json({ error: "Commento obbligatorio" }); return;
  }
  const [obj] = await db.select().from(userObjectivesTable).where(eq(userObjectivesTable.id, objectiveId));
  if (!obj) { res.status(404).json({ error: "Obiettivo non trovato" }); return; }

  const [comment] = await db.insert(objectiveCommentsTable).values({
    objectiveId,
    authorId: userId,
    content: content.trim(),
    reaction: reaction ?? null,
  }).returning();
  res.status(201).json(comment);
});

router.delete("/objectives/:objectiveId/comments/:commentId", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const commentId = parseInt(req.params.commentId, 10);
  const [comment] = await db.select().from(objectiveCommentsTable).where(eq(objectiveCommentsTable.id, commentId));
  if (!comment || comment.authorId !== userId) {
    res.status(403).json({ error: "Non autorizzato" }); return;
  }
  await db.delete(objectiveCommentsTable).where(eq(objectiveCommentsTable.id, commentId));
  res.json({ ok: true });
});

export default router;
