/**
 * Admin — Student Directory
 *
 * GET  /api/admin/users          → lista paginata utenti (search, page, limit)
 * GET  /api/admin/users/:id      → dettaglio singolo utente
 * PATCH /api/admin/users/:id     → aggiorna campi admin-only (userMode, journeyType, emailVerified)
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike, or, desc, sql } from "drizzle-orm";

const router = Router();

// ── GET / — lista paginata ──────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1"),  10));
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"), 10)));
  const search = String(req.query["search"] ?? "").trim();
  const offset = (page - 1) * limit;

  try {
    const where = search
      ? or(
          ilike(usersTable.name,  `%${search}%`),
          ilike(usersTable.email, `%${search}%`),
        )
      : undefined;

    const [users, [{ total }]] = await Promise.all([
      db
        .select({
          id:            usersTable.id,
          name:          usersTable.name,
          email:         usersTable.email,
          avatarUrl:     usersTable.avatarUrl,
          userMode:      usersTable.userMode,
          journeyType:   usersTable.journeyType,
          emailVerified: usersTable.emailVerified,
          streakDays:    usersTable.streakDays,
          lastActiveAt:  usersTable.lastActiveAt,
          createdAt:     usersTable.createdAt,
        })
        .from(usersTable)
        .where(where)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(where),
    ]);

    res.json({
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[admin/users]", err);
    res.status(500).json({ error: "DB error" });
  }
});

// ── GET /:id — dettaglio ────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    // Rimuovi campi sensibili prima di rispondere
    const { passwordHash, verificationCode, resetToken, ...safeUser } = user;
    void passwordHash; void verificationCode; void resetToken;
    res.json({ user: safeUser });
  } catch (err) {
    console.error("[admin/users/:id]", err);
    res.status(500).json({ error: "DB error" });
  }
});

// ── PATCH /:id — aggiorna campi admin ───────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const allowed = ["userMode", "journeyType", "emailVerified", "isPublic", "streakDays"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  if (!Object.keys(update).length) {
    res.status(400).json({ error: "Nessun campo aggiornabile fornito" });
    return;
  }
  update.updatedAt = new Date();

  try {
    const [updated] = await db
      .update(usersTable)
      .set(update as Parameters<typeof usersTable.$inferInsert>[0])
      .where(eq(usersTable.id, id))
      .returning({
        id:            usersTable.id,
        name:          usersTable.name,
        email:         usersTable.email,
        userMode:      usersTable.userMode,
        journeyType:   usersTable.journeyType,
        emailVerified: usersTable.emailVerified,
        updatedAt:     usersTable.updatedAt,
      });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user: updated });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
