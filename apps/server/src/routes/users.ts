import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.patch("/onboarding", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  await db
    .update(usersTable)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ onboardingCompleted: true });
});

export default router;
