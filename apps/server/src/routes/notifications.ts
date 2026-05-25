import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/notifications  —  stub (tabella non ancora implementata) ─── */
router.get("/", requireAuth, async (_req, res) => {
  res.json({ notifications: [], unreadCount: 0 });
});

router.post("/:id/read", requireAuth, async (_req, res) => {
  res.json({ success: true });
});

export default router;
