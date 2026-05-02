import { Router, type IRouter } from "express";
import { db, affiliationLeadsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { notifyNewLead } from "../lib/notify-email.js";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_TYPES = [
  "scuola_media",
  "scuola_superiore",
  "universita",
  "agenzia_lavoro",
  "centro_formazione",
  "ente_pubblico",
  "orientatore",
  "altro",
];

router.post("/affiliazione/lead", async (req, res): Promise<void> => {
  const { institutionName, partnerType, contactName, email, phone, message, estimatedUsers } = req.body;

  if (!institutionName?.trim() || !contactName?.trim() || !email?.trim() || !partnerType?.trim()) {
    res.status(400).json({ error: "Nome istituzione, nome referente, email e tipo partner sono obbligatori." });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Indirizzo email non valido." });
    return;
  }
  if (!VALID_TYPES.includes(partnerType)) {
    res.status(400).json({ error: "Tipo partner non valido." });
    return;
  }

  const [entry] = await db.insert(affiliationLeadsTable).values({
    institutionName: institutionName.trim().slice(0, 120),
    partnerType: partnerType.trim(),
    contactName: contactName.trim().slice(0, 80),
    email: email.trim().toLowerCase().slice(0, 120),
    phone: phone?.trim().slice(0, 30) ?? null,
    message: message?.trim().slice(0, 1500) ?? null,
    estimatedUsers: estimatedUsers?.trim().slice(0, 20) ?? null,
  }).returning();

  notifyNewLead(entry).catch(() => {});

  res.status(201).json({ ok: true, id: entry.id });
});

router.get("/affiliazione/leads", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const leads = await db
    .select()
    .from(affiliationLeadsTable)
    .orderBy(desc(affiliationLeadsTable.createdAt));
  res.json(leads);
});

router.patch("/affiliazione/leads/:id/read", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ read: true, status: "contattato" })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) { res.status(404).json({ error: "Lead non trovato" }); return; }
  res.json(lead);
});

const VALID_STATUSES = ["nuovo", "contattato", "in_trattativa", "attivo"];

router.patch("/affiliazione/leads/:id/status", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  const { status } = req.body as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: "Stato non valido" });
    return;
  }
  const updates: { status: string; read?: boolean } = { status };
  if (status !== "nuovo") updates.read = true;
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set(updates)
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) { res.status(404).json({ error: "Lead non trovato" }); return; }
  res.json(lead);
});

router.post("/affiliazione/test-email", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Non autorizzato" }); return;
  }
  if (!process.env.RESEND_API_KEY) {
    res.status(400).json({ error: "RESEND_API_KEY non configurata" }); return;
  }
  if (!process.env.ADMIN_NOTIFICATION_EMAIL) {
    res.status(400).json({ error: "ADMIN_NOTIFICATION_EMAIL non configurata" }); return;
  }
  await notifyNewLead({
    id: 0,
    institutionName: "Istituto Demo Test",
    partnerType: "scuola_superiore",
    contactName: "Admin NorthStar",
    email: process.env.ADMIN_NOTIFICATION_EMAIL,
    phone: "+39 000 0000000",
    message: "Questa è un'email di test per verificare la configurazione delle notifiche.",
    estimatedUsers: "100-500",
    createdAt: new Date().toISOString(),
  });
  res.json({ ok: true, sentTo: process.env.ADMIN_NOTIFICATION_EMAIL });
});

export default router;
