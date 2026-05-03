import { Router, type IRouter } from "express";
import { OAuth2Client } from "google-auth-library";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { signToken } from "../lib/auth-jwt.js";

const router: IRouter = Router();

const GoogleTokenBody = z.object({
  credential: z.string().min(1),
});

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    testSessionId: user.testSessionId,
  };
}

router.post("/auth/google-token", async (req, res): Promise<void> => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google login non configurato. Contatta l'amministratore." });
    return;
  }

  const parsed = GoogleTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }

  const { credential } = parsed.data;

  let payload: { sub?: string; email?: string; name?: string; picture?: string; email_verified?: boolean } | null = null;

  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload() ?? null;
  } catch {
    res.status(401).json({ error: "Token Google non valido. Riprova." });
    return;
  }

  if (!payload?.email || !payload?.sub) {
    res.status(401).json({ error: "Impossibile ottenere i dati dal token Google." });
    return;
  }

  const { sub: googleId, email, name = email.split("@")[0], picture: avatarUrl } = payload;

  // Find existing user by googleId or email
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.googleId, googleId), eq(usersTable.email, email)));

  if (existing) {
    // Update google info if not already linked
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (!existing.googleId) updates.googleId = googleId;
    if (!existing.avatarUrl && avatarUrl) updates.avatarUrl = avatarUrl;
    if (!existing.emailVerified) updates.emailVerified = true;

    const [updated] = Object.keys(updates).length > 0
      ? await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning()
      : [existing];

    res.json({ ...safeUser(updated), token: signToken(updated.id) });
    return;
  }

  const [newUser] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      googleId,
      avatarUrl: avatarUrl ?? null,
      emailVerified: true,
      passwordHash: null,
    })
    .returning();

  res.status(201).json({ ...safeUser(newUser), token: signToken(newUser.id) });
});

export default router;
