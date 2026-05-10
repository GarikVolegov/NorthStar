import { Router, type IRouter } from "express";
import { db, sectorsTable, usersTable, testSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { optionalAuthMiddleware } from "../lib/auth-jwt.js";
import { aiGenerationRateLimiter, agentLimiter } from "../lib/rate-limiter.js";
import { ai } from "../lib/ai/index.js";

const router: IRouter = Router();

interface UserContext {
  name?: string;
  age?: number | null;
  educationLevel?: string | null;
  primaryTypes: string[];
  riasecScores: Record<string, number>;
  dominantSpirit: string;
  spiritScores: Record<string, number>;
  profileSummary: string;
  workPreference: string;
  autonomyPreference: number;
  stabilityPreference: number;
  matchScoreForSector: number | null;
  matchReasonForSector: string | null;
}

async function fetchUserContext(userId: number, sectorId: number): Promise<UserContext | null> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;

  let session: typeof testSessionsTable.$inferSelect | null = null;
  if (user.testSessionId) {
    const [s] = await db
      .select()
      .from(testSessionsTable)
      .where(eq(testSessionsTable.id, user.testSessionId));
    session = s ?? null;
  }

  const cv = (user.cvJson ?? {}) as Record<string, unknown>;
  const educationLevel =
    typeof cv.educationLevel === "string"
      ? cv.educationLevel
      : Array.isArray((cv as { education?: unknown }).education) &&
        (cv as { education: Array<{ degree?: string }> }).education[0]?.degree
      ? (cv as { education: Array<{ degree?: string }> }).education[0].degree ?? null
      : null;
  const age =
    typeof (cv as { age?: number }).age === "number" ? (cv as { age: number }).age : null;

  const rec =
    session?.recommendations.find((r: { sectorId: number }) => r.sectorId === sectorId) ?? null;

  return {
    name: user.name,
    age,
    educationLevel,
    primaryTypes: session?.primaryTypes ?? [],
    riasecScores: session?.riasecScores ?? {},
    dominantSpirit: session?.dominantSpirit ?? "",
    spiritScores: session?.spiritScores ?? {},
    profileSummary: session?.profileSummary ?? "",
    workPreference: user.workPreference ?? "unknown",
    autonomyPreference: user.autonomyPreference ?? 5,
    stabilityPreference: user.stabilityPreference ?? 5,
    matchScoreForSector: rec?.matchScore ?? null,
    matchReasonForSector: rec?.matchReason ?? null,
  };
}

function formatUserBlock(ctx: UserContext | null): string {
  if (!ctx) {
    return `Profilo utente: NON DISPONIBILE.
Genera percorsi generici partendo da zero, senza ipotizzare background specifici. Indica per OGNI percorso a chi si adatta meglio (età, formazione precedente, attitudini).`;
  }
  const top3Riasec = Object.entries(ctx.riasecScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}=${Math.round(v)}`)
    .join(", ");
  const top3Spirit = Object.entries(ctx.spiritScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}=${Math.round(v)}`)
    .join(", ");

  return `Profilo dell'utente "${ctx.name ?? "—"}" (USA QUESTI DATI per personalizzare ogni percorso e ogni motivazione):
- Tipi RIASEC primari: ${ctx.primaryTypes.join(", ") || "non noto"}${top3Riasec ? ` (top: ${top3Riasec})` : ""}
- Spirito dominante: ${ctx.dominantSpirit || "non noto"}${top3Spirit ? ` (top: ${top3Spirit})` : ""}
- Riassunto del profilo (dal test): ${ctx.profileSummary || "n/d"}
- Preferenza modalità di lavoro: ${ctx.workPreference}
- Preferenza autonomia (1=guidato, 10=autonomo): ${ctx.autonomyPreference}/10
- Preferenza stabilità (1=avventura, 10=stabilità): ${ctx.stabilityPreference}/10
- Età dichiarata: ${ctx.age ?? "non nota"}
- Livello di istruzione attuale: ${ctx.educationLevel ?? "non noto"}
- Affinità calcolata con questo settore: ${ctx.matchScoreForSector ?? "n/d"}%${ctx.matchReasonForSector ? ` — "${ctx.matchReasonForSector}"` : ""}`;
}

router.post(
  "/roadmap/:sectorId/generate",
  optionalAuthMiddleware,
  agentLimiter,
  aiGenerationRateLimiter,
  async (req, res): Promise<void> => {
    const sectorId = Number.parseInt(String(req.params.sectorId), 10);
    if (!Number.isFinite(sectorId)) {
      res.status(400).json({ error: "ID settore non valido" });
      return;
    }

    const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, sectorId));
    if (!sector) {
      res.status(404).json({ error: "Settore non trovato" });
      return;
    }

    const userId = res.locals.userId as number | undefined;
    const ctx = userId ? await fetchUserContext(userId, sectorId) : null;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const userBlock = formatUserBlock(ctx);

    const prompt = `Sei un orientatore esperto del mercato del lavoro e della formazione in Italia.
Il tuo compito è progettare TUTTI i percorsi realistici per entrare nel settore "${sector.name}", confrontarli onestamente, e raccomandare il migliore per l'utente specifico.

═══ DATI DEL SETTORE ═══
- Settore: ${sector.name}
- Competenze richieste: ${sector.skills.join(", ")}
- Tempo medio per autonomia: ${sector.timeToAutonomy}
- RAL media: €${Math.round(sector.avgSalaryMin / 1000)}k - €${Math.round(sector.avgSalaryMax / 1000)}k
- Crescita annua: +${sector.growthRate}%
- Trend di mercato: ${sector.trend}
- Vantaggi del settore: ${sector.advantages.slice(0, 3).join("; ")}

═══ PROFILO UTENTE ═══
${userBlock}

═══ ISTRUZIONI ═══
1. Identifica 3-5 percorsi DIVERSI e realistici per arrivare al settore in Italia. Includi quando sensati: laurea triennale, laurea magistrale, ITS Academy, bootcamp/corso intensivo, apprendistato di alta formazione, formazione professionale regionale, autodidatta + portfolio + certificazioni, master post-laurea, riqualificazione tardiva. Scegli SOLO percorsi credibili per questo specifico settore.
2. Per ogni percorso valuta onestamente VANTAGGI e SVANTAGGI rispetto al mercato del lavoro reale (costi, tempo, riconoscimento del titolo, sbocchi, rischio di obsolescenza).
3. Calcola un "fitScore" (0-100) di quanto quel percorso si adatti a QUESTO utente. Spiega in "fitReason" quale dato del profilo lo motiva (RIASEC, spirito, autonomia, stabilità, età, istruzione attuale).
4. Indica in "recommendedPathId" il percorso migliore per QUESTO utente (non in assoluto), e in "recommendationReason" perché lo consigli proprio a lui/lei in 2-3 frasi che citino i suoi dati reali.
5. In "alternativeFormativePaths" elenca 3-5 percorsi formativi laterali utili che non sono il percorso principale ma rafforzano il profilo (es. seconda lingua, soft skills, certificazione cloud, esperienza all'estero) — ognuno con un breve "benefit".
6. Sii specifico: cita corsi/atenei/certificazioni REALI italiani quando possibile (es. "ITS ICT Piemonte", "Politecnico di Milano - Ing. Informatica", "Boolean Bootcamp", "AWS Solutions Architect Associate", "PMP", "Coursera - Google Data Analytics", ecc.).
7. NON inventare università o corsi inesistenti. Se non sei sicuro, usa una descrizione generica ("una laurea triennale in Informatica in un ateneo statale").
8. Tutto in italiano.

═══ FORMATO OUTPUT — RISPONDI SOLO CON QUESTO JSON, NIENT'ALTRO ═══
{
  "userProfileSummary": "1-2 frasi che sintetizzano CHI è l'utente partendo dai suoi dati e perché stiamo proponendo proprio questi percorsi. Se profilo non disponibile, scrivi una frase generica.",
  "recommendedPathId": "path_1",
  "recommendationReason": "Perché questo percorso specifico è il migliore PER QUESTO UTENTE, citando 1-2 suoi dati concreti.",
  "totalDurationBest": "X mesi/anni (durata del percorso raccomandato)",
  "paths": [
    {
      "id": "path_1",
      "type": "Università | ITS Academy | Bootcamp | Apprendistato | Master | Autodidatta + Certificazioni | Formazione professionale",
      "title": "Titolo breve e chiaro del percorso",
      "shortDescription": "1-2 frasi che spiegano in cosa consiste",
      "duration": "X anni o Y mesi",
      "estimatedCost": "€X.XXX - €Y.XXX (totale, in Italia)",
      "fitScore": 78,
      "fitReason": "Perché questo percorso si adatta (o non) al profilo dell'utente, in 1-2 frasi, citando dati reali del profilo se disponibili.",
      "bestFor": "Chi trae più beneficio da questo percorso (profilo ideale)",
      "pros": ["vantaggio 1", "vantaggio 2", "vantaggio 3", "vantaggio 4"],
      "cons": ["svantaggio 1", "svantaggio 2", "svantaggio 3"],
      "phases": [
        {
          "id": 1,
          "title": "Titolo della fase",
          "duration": "X mesi",
          "emoji": "📚",
          "description": "2-3 frasi descrittive concrete",
          "actions": ["azione 1", "azione 2", "azione 3", "azione 4"],
          "resources": [
            {"type": "corso", "name": "Nome reale", "platform": "Udemy|Coursera|YouTube|ateneo|ITS|ecc"},
            {"type": "certificazione", "name": "Nome reale", "issuer": "Ente certificatore"},
            {"type": "libro", "name": "Titolo libro", "author": "Autore"}
          ],
          "milestone": "Risultato concreto e misurabile"
        }
      ]
    }
  ],
  "alternativeFormativePaths": [
    {"title": "Percorso laterale 1", "type": "es. lingua | soft skills | esperienza estero | certificazione tecnica | volontariato strategico", "duration": "X mesi", "benefit": "Quale vantaggio porta nel mercato del lavoro per questo settore."}
  ],
  "comparison": "2-4 frasi di confronto onesto tra i percorsi: chi sceglie cosa, in quali condizioni, quale ha il miglior ROI.",
  "salaryProgression": [
    {"phase": "0-6 mesi (entry)", "range": "€X.000 - €X.000"},
    {"phase": "6 mesi - 2 anni (junior)", "range": "€X.000 - €X.000"},
    {"phase": "2-4 anni (mid)", "range": "€X.000 - €X.000"},
    {"phase": "4+ anni (senior)", "range": "€X.000 - €X.000"}
  ],
  "topRoles": ["Ruolo 1", "Ruolo 2", "Ruolo 3", "Ruolo 4", "Ruolo 5"],
  "keyTip": "Il consiglio più importante e specifico per QUESTO utente, citando un suo dato (RIASEC/spirito/preferenza)."
}

Regole tassative:
- 3-5 percorsi nel campo "paths".
- Ogni percorso ha 4-6 fasi con azioni concrete e milestone.
- "fitScore" deve essere coerente: il "recommendedPathId" deve avere il fitScore più alto.
- Non aggiungere testo prima o dopo il JSON.
- JSON valido senza commenti.`;

    try {
      for await (const chunk of ai.streamChat({
        useCase: "json_extraction",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 8192,
        temperature: 0.4,
      })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Errore AI";
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  },
);

export default router;
