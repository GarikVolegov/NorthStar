import { Router, type IRouter } from "express";
import { runInterviewReminderCheck } from "../lib/interview-reminder.js";

const router: IRouter = Router();

/**
 * POST /api/reminders/interview-check
 * Manually trigger the stale-interview reminder check.
 * Protected by a simple admin secret header: x-admin-secret
 */
router.post("/reminders/interview-check", async (req, res): Promise<void> => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret && req.headers["x-admin-secret"] !== adminSecret) {
    res.status(401).json({ error: "Non autorizzato" });
    return;
  }

  try {
    const result = await runInterviewReminderCheck();
    res.json({
      ok: true,
      usersNotified: result.usersNotified,
      appsFlagged: result.appsFlagged,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Errore durante il controllo reminder", detail: err?.message });
  }
});

export default router;
