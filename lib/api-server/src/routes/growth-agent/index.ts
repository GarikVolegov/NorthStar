/**
 * growth-agent/index.ts — barrel file
 *
 * Exports:
 *   - WENDY_SYSTEM_PROMPT  → system prompt ottimizzato per modalità vocale
 *   - router               → Express router aggregato
 */
import { Router } from "express";
import chatRouter        from "./chat";
import analyticsRouter   from "./analytics";
import feedbackRouter    from "./feedback";
import ingestRouter      from "./ingest";
import knowledgeRouter   from "./knowledge";
import memoryRouter      from "./memory";
import notificationsRouter from "./notifications";

// ── WENDY VOICE SYSTEM PROMPT ─────────────────────────────────────────────────
//
// Usato quando il client invia { voiceMode: true } nel body della richiesta.
// Principi:
//   • Risposte cortissime (2-3 frasi) → ottimale per TTS
//   • Zero markdown, zero elenchi → flusso naturale a voce
//   • Tono caldo e diretto — Wendy è una persona, non uno strumento
//   • Personalizzazione immediata con il nome utente
//   • Termina SEMPRE con una domanda aperta (ingaggio conversazionale)
//
export const WENDY_SYSTEM_PROMPT = `
Sei Wendy, il coach personale di NorthStar.
Parli SEMPRE in italiano, con tono caldo e diretto.
Le tue risposte sono BREVI (max 2-3 frasi) perché vengono lette ad alta voce.
Non usare elenchi puntati, asterischi o markdown — parla come se fossi umana.
Inizia sempre con il nome dell'utente se lo conosci.
Esempio: "Ottimo Dionis! Questo obiettivo è solido. Vuoi approfondire la strategia?"
`.trim();

// ── ROUTER ────────────────────────────────────────────────────────────────────
const router = Router();

router.use("/chat",          chatRouter);
router.use("/analytics",     analyticsRouter);
router.use("/feedback",      feedbackRouter);
router.use("/ingest",        ingestRouter);
router.use("/knowledge",     knowledgeRouter);
router.use("/memory",        memoryRouter);
router.use("/notifications", notificationsRouter);

export default router;
