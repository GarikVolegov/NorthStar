import { Router, type IRouter } from "express";
import { db, usersTable, testSessionsTable } from "@workspace/db";
import { RegisterUserBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/auth-jwt.js";

const router: IRouter = Router();

router.post("/users", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, testSessionId, workPreference } = parsed.data;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existing.length > 0) {
    res.status(400).json({ error: "Email già registrata" });
    return;
  }

  const validWorkModes = ["dipendente", "autonomo", "ibrido", "unknown"];
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      testSessionId: testSessionId ?? null,
      workPreference: workPreference && validWorkModes.includes(workPreference) ? workPreference : "unknown",
    })
    .returning();

  if (testSessionId) {
    await db
      .update(testSessionsTable)
      .set({ userId: user.id })
      .where(eq(testSessionsTable.id, testSessionId));
  }

  const token = signToken(user.id);

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    testSessionId: user.testSessionId,
    workPreference: user.workPreference,
    emailVerified: user.emailVerified,
    stripeSubscriptionId: user.stripeSubscriptionId ?? null,
    createdAt: user.createdAt.toISOString(),
    token,
  });
});

export default router;
