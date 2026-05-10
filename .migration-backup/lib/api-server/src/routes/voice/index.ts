/**
 * voice/index.ts — barrel
 *
 * Routes:
 *   POST /api/voice/start      → crea una sessione vocale in stato "ongoing"
 *   POST /api/voice/complete   → completa la sessione, assegna XP, aggiorna streak
 *   POST /api/voice/abandon    → marca la sessione come abbandonata
 *   GET  /api/voice/stats      → streak attuale + XP totali + ultime sessioni
 */
import { Router } from "express";
import sessionsRouter from "./sessions";
import statsRouter    from "./stats";

const router = Router();

router.use("/", sessionsRouter);
router.use("/stats", statsRouter);

export default router;
