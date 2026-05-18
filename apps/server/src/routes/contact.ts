import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { contactMessagesTable, db } from "@workspace/db";
import { requireAdminAccess } from "../middleware/auth";

const router = Router();

router.use("/messages", requireAdminAccess);

router.get("/messages", async (req, res) => {
  const messages = await db
    .select()
    .from(contactMessagesTable)
    .where(isNull(contactMessagesTable.deletedAt))
    .orderBy(desc(contactMessagesTable.createdAt))
    .limit(100);

  res.json(messages);
});

router.patch("/messages/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const [message] = await db
    .update(contactMessagesTable)
    .set({ read: true })
    .where(and(eq(contactMessagesTable.id, id), isNull(contactMessagesTable.deletedAt)))
    .returning();

  if (!message) {
    res.status(404).json({ error: "Messaggio non trovato" });
    return;
  }

  res.json(message);
});

export default router;
