import { Router, type IRouter, type Request, type Response } from "express";
import { db, notificationsLogTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();
router.use("/notifications", authMiddleware);

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get("/notifications", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const unreadOnly = req.query.unread === "true";
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);

  const conditions: Parameters<typeof and> = [eq(notificationsLogTable.userId, userId)];
  if (unreadOnly) conditions.push(eq(notificationsLogTable.isRead, false));

  const notifications = await db
    .select()
    .from(notificationsLogTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsLogTable.sentAt))
    .limit(limit);

  const allUnread = await db
    .select({ id: notificationsLogTable.id })
    .from(notificationsLogTable)
    .where(and(
      eq(notificationsLogTable.userId, userId),
      eq(notificationsLogTable.isRead, false),
    ));

  res.json({ notifications, unreadCount: allUnread.length });
});

// ── POST /api/notifications/:id/read ─────────────────────────────────────────
router.post("/notifications/:id/read", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [existing] = await db
    .select({ userId: notificationsLogTable.userId })
    .from(notificationsLogTable)
    .where(and(eq(notificationsLogTable.id, id), eq(notificationsLogTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Notifica non trovata" }); return; }

  await db
    .update(notificationsLogTable)
    .set({ isRead: true, openedAt: new Date() })
    .where(eq(notificationsLogTable.id, id));

  res.json({ success: true });
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
router.post("/notifications/read-all", async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.userId as number;

  await db
    .update(notificationsLogTable)
    .set({ isRead: true, openedAt: new Date() })
    .where(and(
      eq(notificationsLogTable.userId, userId),
      eq(notificationsLogTable.isRead, false),
    ));

  res.json({ success: true });
});

export default router;
