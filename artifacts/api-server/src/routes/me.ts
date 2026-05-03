import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt";

const router: IRouter = Router();

const PatchMeBody = z.object({
  timezone: z.string().min(1).max(100).optional(),
});

router.patch("/me", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = PatchMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.timezone) updates.timezone = parsed.data.timezone;

  if (Object.keys(updates).length > 0) {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  }

  res.json({ ok: true });
});

export default router;
