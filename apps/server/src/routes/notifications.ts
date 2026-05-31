import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  notificationService,
  type NotificationPreferencesRecord,
  type NotificationService,
} from "../services/notifications/notification.service";

interface NotificationsRouterDeps {
  service?: NotificationService;
}

const listQuerySchema = z.object({
  unread: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

const idSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const preferencesPatchSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
}).strict();

export function createNotificationsRouter({ service = notificationService }: NotificationsRouterDeps = {}): Router {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Parametri notifiche non validi" });
      return;
    }
    const options = {
      ...(parsed.data.unread !== undefined ? { unread: parsed.data.unread } : {}),
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.cursor !== undefined ? { cursor: parsed.data.cursor } : {}),
    };
    const result = await service.list(req.user!.id, options);
    res.json(result);
  });

  router.get("/preferences", requireAuth, async (req, res) => {
    const preferences = await service.getPreferences(req.user!.id);
    res.json({ preferences });
  });

  router.patch("/preferences", requireAuth, async (req, res) => {
    const parsed = preferencesPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Preferenze notifiche non valide" });
      return;
    }
    const preferences = await service.updatePreferences(
      req.user!.id,
      parsed.data as Partial<NotificationPreferencesRecord>,
    );
    res.json({ preferences });
  });

  router.post("/read-all", requireAuth, async (req, res) => {
    const updated = await service.markAllRead(req.user!.id);
    res.json({ success: true, updated });
  });

  router.post("/:id/read", requireAuth, async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Notifica non valida" });
      return;
    }
    const notification = await service.markRead(parsed.data.id, req.user!.id);
    if (!notification) {
      res.status(404).json({ error: "Notifica non trovata" });
      return;
    }
    res.json({ success: true, notification });
  });

  router.post("/:id/open", requireAuth, async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Notifica non valida" });
      return;
    }
    const notification = await service.markOpened(parsed.data.id, req.user!.id);
    if (!notification) {
      res.status(404).json({ error: "Notifica non trovata" });
      return;
    }
    res.json({ success: true, notification });
  });

  router.post("/:id/dismiss", requireAuth, async (req, res) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Notifica non valida" });
      return;
    }
    const notification = await service.dismiss(parsed.data.id, req.user!.id);
    if (!notification) {
      res.status(404).json({ error: "Notifica non trovata" });
      return;
    }
    res.json({ success: true, notification });
  });

  return router;
}

export default createNotificationsRouter();
