import { Router, type IRouter } from "express";
import { db, contactMessagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/contact", async (req, res): Promise<void> => {
  const { name, email, subject, message } = req.body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    res.status(400).json({ error: "Nome, email e messaggio sono obbligatori." });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Indirizzo email non valido." });
    return;
  }
  if (message.trim().length < 10) {
    res.status(400).json({ error: "Il messaggio è troppo breve (min. 10 caratteri)." });
    return;
  }
  if (message.length > 1000) {
    res.status(400).json({ error: "Il messaggio supera il limite di 1000 caratteri." });
    return;
  }

  const [entry] = await db.insert(contactMessagesTable).values({
    name: name.trim().slice(0, 80),
    email: email.trim().toLowerCase().slice(0, 120),
    subject: (subject ?? "info").slice(0, 40),
    message: message.trim().slice(0, 1000),
  }).returning();

  res.status(201).json({ ok: true, id: entry.id });
});

router.get("/contact/messages", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const messages = await db
    .select()
    .from(contactMessagesTable)
    .orderBy(desc(contactMessagesTable.createdAt));
  res.json(messages);
});

router.patch("/contact/messages/:id/read", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [msg] = await db
    .update(contactMessagesTable)
    .set({ read: true })
    .where(eq(contactMessagesTable.id, id))
    .returning();
  if (!msg) { res.status(404).json({ error: "Messaggio non trovato" }); return; }
  res.json(msg);
});

export default router;
