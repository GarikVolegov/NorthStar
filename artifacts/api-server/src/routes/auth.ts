import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const RegisterBody = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  testSessionId: z.number().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    testSessionId: user.testSessionId,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { name, email, password, testSessionId } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email già registrata" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, testSessionId: testSessionId ?? null })
    .returning();

  res.status(201).json(safeUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.status(401).json({ error: "Email o password non corretti" });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "Account creato senza password. Usa la registrazione." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email o password non corretti" });
    return;
  }

  res.json(safeUser(user));
});

export default router;
