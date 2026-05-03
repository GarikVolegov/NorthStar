import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt";

const router: IRouter = Router();

const PatchMeBody = z.object({
  timezone: z.string().min(1).max(100).optional(),
});

const PatchWorkPreferenceBody = z.object({
  workPreference: z.enum(["dipendente", "autonomo", "ibrido", "unknown"]),
  autonomyPreference: z.number().int().min(1).max(10).optional(),
  stabilityPreference: z.number().int().min(1).max(10).optional(),
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

router.patch("/users/me/work-preference", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = PatchWorkPreferenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {
    workPreference: parsed.data.workPreference,
  };
  if (parsed.data.autonomyPreference != null) {
    updates.autonomyPreference = parsed.data.autonomyPreference;
  }
  if (parsed.data.stabilityPreference != null) {
    updates.stabilityPreference = parsed.data.stabilityPreference;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      workPreference: usersTable.workPreference,
      autonomyPreference: usersTable.autonomyPreference,
      stabilityPreference: usersTable.stabilityPreference,
    });

  res.json({ ok: true, ...updated });
});

router.get("/users/me/work-preference", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [user] = await db
    .select({
      id: usersTable.id,
      workPreference: usersTable.workPreference,
      autonomyPreference: usersTable.autonomyPreference,
      stabilityPreference: usersTable.stabilityPreference,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  res.json(user);
});

export default router;
