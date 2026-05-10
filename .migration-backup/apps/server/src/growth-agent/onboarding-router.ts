/**
 * onboarding-router.ts — Passo 6: primo messaggio Wendy al signup.
 *
 * ENDPOINTS:
 *
 *   GET  /api/growth-agent/onboarding/status
 *     Risponde { needsOnboarding: boolean }.
 *     needsOnboarding = true se l’utente non ha ancora nessuna chat session.
 *
 *   POST /api/growth-agent/onboarding
 *     Genera il primo messaggio di Wendy via OpenAI (streaming SSE).
 *     Il prompt è personalizzato con:
 *       - Nome utente
 *       - journeyType (indeciso / in_transizione / in_crescita / autonomo)
 *       - RIASEC primaryTypes (se presenti)
 *       - Venuto tramite referral (se referredByAffiliateId presente)
 *     Il messaggio viene salvato come primo record nella chat_messages table
 *     con role='assistant', così appare nella chat normale al primo caricamento.
 *
 * STREAMING:
 *   Stesso formato SSE di /api/growth-agent/chat:
 *     data: {"type":"token","value":"..."}
 *     data: {"type":"done","sessionId":42}
 *     data: [DONE]
 *
 * SICUREZZA:
 *   Endpoint idempotente: se l’utente ha già messaggi, ritorna 409
 *   con { alreadyOnboarded: true }. Il frontend gestisce silenziosamente.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  testSessionsTable,
  chatSessionsTable,
  chatMessagesTable,
} from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function requireAuth(req: Request, res: Response, next: () => void) {
  const uid = (req as any).user?.id;
  if (!uid) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function uid(req: Request): number { return (req as any).user.id; }

export const onboardingRouter = Router();

// ── GET /status ────────────────────────────────────────────────────────────────────

onboardingRouter.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = uid(req);
    const result = await db
      .select({ cnt: count() })
      .from(chatMessagesTable)
      .innerJoin(chatSessionsTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
      .where(eq(chatSessionsTable.userId, userId));

    const msgCount = Number(result[0]?.cnt ?? 0);
    res.json({ needsOnboarding: msgCount === 0 });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── Prompt builder ─────────────────────────────────────────────────────────────

const JOURNEY_DESCRIPTIONS: Record<string, string> = {
  indeciso:       "non ha ancora una direzione chiara e sta esplorando",
  in_transizione: "sta vivendo un cambio di percorso o settore",
  in_crescita:    "ha una direzione chiara e vuole accelerare la crescita",
  autonomo:       "sta costruendo qualcosa di proprio come imprenditore o freelance",
};

const RIASEC_LABELS: Record<string, string> = {
  R: "Realistico (pratico, manuale, tecnico)",
  I: "Investigativo (analitico, scientifico, curioso)",
  A: "Artistico (creativo, espressivo, originale)",
  S: "Sociale (empatico, collaborativo, orientato alle persone)",
  E: "Intraprendente (leader, persuasivo, orientato ai risultati)",
  C: "Convenzionale (organizzato, metodico, preciso)",
};

function buildOnboardingPrompt(opts: {
  name: string;
  journeyType: string;
  riasecTypes: string[];
  hasReferral: boolean;
}): string {
  const { name, journeyType, riasecTypes, hasReferral } = opts;
  const journeyDesc = JOURNEY_DESCRIPTIONS[journeyType] ?? journeyType;
  const firstName   = name.split(" ")[0] ?? name;

  const riasecPart = riasecTypes.length > 0
    ? `Il suo profilo RIASEC mostra questi tipi dominanti: ${riasecTypes
        .slice(0, 3)
        .map((t) => RIASEC_LABELS[t] ?? t)
        .join(", ")}.`
    : "Non ha ancora completato il test RIASEC.";

  const referralPart = hasReferral
    ? "\u00c8 arrivato tramite un referral di un altro utente NorthStar."
    : "";

  return `Sei Wendy, la coach AI di NorthStar specializzata in crescita personale e orientamento professionale.
Sei calorosa, diretta, concreta. Usi il tu. Non sei mai generica o vuota.

STATO UTENTE:
- Nome: ${firstName}
- Percorso: ${journeyDesc}
- ${riasecPart}
${referralPart}

SCRIVI il PRIMO MESSAGGIO DI BENVENUTO a ${firstName} su NorthStar.

REGOLE:
1. Inizia con un saluto personale che cita il suo nome
2. Mostra di aver capito dove si trova nel suo percorso (usa journeyType in modo naturale, non tecnico)
3. Se ha il RIASEC, cita in modo naturale uno dei suoi punti di forza emersi
4. Fai UNA sola domanda aperta per capire dove vuole arrivare o qual è la sua sfida principale
5. Tono: umano, entusiasta ma non esagerato, come una coach esperta che incontra un nuovo coachee
6. Lunghezza: 3-4 paragrafi brevi (massimo 120 parole totali)
7. NON elencare funzionalità, NON fare tutorial, NON usare bullet point
8. Scrivi in italiano`;
}

// ── POST /api/growth-agent/onboarding ───────────────────────────────────────────

onboardingRouter.post("/", requireAuth, async (req, res) => {
  const userId = uid(req);

  // 1. Controlla se già onboardato
  const existingCount = await db
    .select({ cnt: count() })
    .from(chatMessagesTable)
    .innerJoin(chatSessionsTable, eq(chatMessagesTable.sessionId, chatSessionsTable.id))
    .where(eq(chatSessionsTable.userId, userId))
    .then((r) => Number(r[0]?.cnt ?? 0));

  if (existingCount > 0) {
    res.status(409).json({ alreadyOnboarded: true });
    return;
  }

  // 2. Fetch dati utente
  const user = await db
    .select({
      name:                 usersTable.name,
      journeyType:          usersTable.journeyType,
      referredByAffiliateId: usersTable.referredByAffiliateId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  // 3. Fetch RIASEC (ultima sessione)
  const riasec = await db
    .select({ primaryTypes: testSessionsTable.primaryTypes })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null);

  // 4. Crea (o recupera) la chat session di onboarding
  const [session] = await db
    .insert(chatSessionsTable)
    .values({ userId, title: "Benvenuto su NorthStar" })
    .returning();

  // 5. Setup SSE
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  let fullMessage = "";

  try {
    const prompt = buildOnboardingPrompt({
      name:        user.name,
      journeyType: user.journeyType,
      riasecTypes: riasec?.primaryTypes ?? [],
      hasReferral: user.referredByAffiliateId != null,
    });

    const stream = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      max_tokens:  300,
      temperature: 0.75,
      stream:      true,
      messages: [
        { role: "system", content: prompt },
        { role: "user",   content: "Inizia la sessione di onboarding." },
      ],
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? "";
      if (token) {
        fullMessage += token;
        send({ type: "token", value: token });
      }
    }

    // 6. Salva il messaggio nel DB
    await db.insert(chatMessagesTable).values({
      sessionId: session.id,
      role:      "assistant",
      content:   fullMessage,
    });

    send({ type: "done", sessionId: session.id });
    res.write("data: [DONE]\n\n");
  } catch (err) {
    send({ type: "error", message: err instanceof Error ? err.message : "Errore" });
    res.write("data: [DONE]\n\n");
  } finally {
    res.end();
  }
});
