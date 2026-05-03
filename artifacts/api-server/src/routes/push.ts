import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();
router.use(authMiddleware);

router.post("/push/subscribe", async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const { endpoint, p256dh, auth } = parsed.data;

  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, endpoint)));

  if (existing.length === 0) {
    await db.insert(pushSubscriptionsTable).values({ userId, endpoint, p256dh, auth });
  }

  res.status(201).json({ success: true });
});

router.delete("/push/unsubscribe", async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = z.object({ endpoint: z.string() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  await db
    .delete(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.userId, userId), eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint)));

  res.json({ success: true });
});

export default router;
