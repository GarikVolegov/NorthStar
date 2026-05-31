import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { dbMonthlyRitualStore } from "../services/monthly-ritual/monthly-ritual.repository";
import type { MonthlyRitualNotificationStore } from "../services/monthly-ritual/monthly-ritual.service";

interface PushRouterDeps {
  store?: MonthlyRitualNotificationStore;
}

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
}).strict();

const unsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
}).strict();

export function createPushRouter({ store = dbMonthlyRitualStore }: PushRouterDeps = {}): Router {
  const router = Router();

  router.post("/subscribe", requireAuth, async (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Subscription non valida" });
      return;
    }

    await store.savePushSubscription({
      userId: req.user!.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      userAgent: req.headers["user-agent"] ?? null,
    });
    res.json({ ok: true });
  });

  async function revoke(req: Request, res: Response) {
    const parsed = unsubscribeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Subscription non valida" });
      return;
    }

    await store.revokePushSubscription(req.user!.id, parsed.data.endpoint ?? null);
    res.json({ ok: true });
  }

  router.delete("/subscribe", requireAuth, revoke);
  router.post("/unsubscribe", requireAuth, revoke);

  return router;
}

export default createPushRouter();
