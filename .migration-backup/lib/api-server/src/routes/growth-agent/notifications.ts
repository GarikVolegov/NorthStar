/**
 * Notification routes for the growth coach.
 *
 * GET  /api/growth-agent/notifications
 *   Returns last 10 unread notifications for the authenticated user.
 *   Response: { notifications: Notification[] }
 *
 * POST /api/growth-agent/notifications/:id/read
 *   Marks a notification as read (sets read_at = NOW()).
 *   Response: { ok: true }
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { coachNotificationsTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";

const router = Router();

// GET /api/growth-agent/notifications
router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;
  try {
    const notifications = await db
      .select()
      .from(coachNotificationsTable)
      .where(
        and(
          eq(coachNotificationsTable.userId, userId),
          isNull(coachNotificationsTable.readAt),
        ),
      )
      .orderBy(desc(coachNotificationsTable.createdAt))
      .limit(10);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/growth-agent/notifications/:id/read
router.post("/:id/read", async (req, res) => {
  const userId: number = (req as any).user.id;
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    await db
      .update(coachNotificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(coachNotificationsTable.id, id),
          eq(coachNotificationsTable.userId, userId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
