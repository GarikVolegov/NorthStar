import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { affiliationLeadsTable, db } from "@workspace/db";
import { requireAdminAccess } from "../middleware/auth";

const router = Router();

router.use("/leads", requireAdminAccess);

function toAdminLead(lead: typeof affiliationLeadsTable.$inferSelect) {
  return {
    ...lead,
    institutionName: lead.name ?? lead.email,
    contactName: lead.name ?? "Contatto",
    partnerType: lead.source,
    message: lead.notes,
  };
}

router.get("/leads", async (req, res) => {
  const leads = await db
    .select()
    .from(affiliationLeadsTable)
    .orderBy(desc(affiliationLeadsTable.createdAt))
    .limit(100);

  res.json(leads.map(toAdminLead));
});

router.patch("/leads/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }
  res.json(toAdminLead(lead));
});

router.patch("/leads/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const requested = typeof req.body?.status === "string" ? req.body.status : "contacted";
  const statusMap: Record<string, "pending" | "contacted" | "converted" | "rejected"> = {
    nuovo: "pending",
    contattato: "contacted",
    in_trattativa: "contacted",
    convertito: "converted",
    pending: "pending",
    contacted: "contacted",
    converted: "converted",
    rejected: "rejected",
  };
  const status = statusMap[requested] ?? "contacted";

  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ status, converted: status === "converted", updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }

  res.json(toAdminLead(lead));
});

export default router;
