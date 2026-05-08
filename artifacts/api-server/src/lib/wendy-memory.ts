/**
 * wendy-memory — Servizio di Memoria a Lungo Termine per Wendy
 *
 * Responsabilità:
 *   1. Caricare il "profilo cognitivo" dell'utente dal DB (RIASEC, skills,
 *      esperienze, preferenze raccolte durante l'onboarding)
 *   2. Leggere i riassunti delle sessioni di chat precedenti
 *   3. Costruire il system prompt personalizzato da iniettare in ogni chiamata
 *   4. Salvare in background il riassunto della sessione corrente
 *
 * Schema DB atteso:
 *   wendy_memory (tabella nuova — migration in db/migrations/)
 *     user_id       TEXT PRIMARY KEY
 *     profile_json  JSONB         -- snapshot profilo al momento del salvataggio
 *     sessions      JSONB[]       -- array di { date, summary, topics[] }
 *     updated_at    TIMESTAMPTZ
 *
 * Dipendenze:
 *   - db (Drizzle ORM, già presente nel progetto)
 *   - ai.chat() per generare i riassunti (usa use case json_extraction → Groq)
 *
 * NOTA: tutte le operazioni DB sono wrapped in try/catch con fallback graceful.
 * Se la memoria non è disponibile, Wendy risponde ugualmente senza contesto.
 */

import { db } from '../storage.js';
import { ai } from './ai/index.js';
import { logger } from './logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserMemoryProfile {
  userId: string;
  // Dati orientamento
  riasecCode?: string;           // es. "RIA" — codice Holland a 3 lettere
  riasecScores?: Record<string, number>; // { R: 82, I: 74, A: 65, ... }
  topSkills?: string[];          // es. ["TypeScript", "Node.js", "problem solving"]
  workExperiences?: string[];    // descrizioni brevi delle esperienze
  educationLevel?: string;       // "liceo", "laurea triennale", ecc.
  preferredWorkMode?: string;    // "remoto" | "ibrido" | "presenza"
  careerGoals?: string[];        // obiettivi esplicitati dall'utente
  // Storico chat
  sessionSummaries?: SessionSummary[];
}

export interface SessionSummary {
  date: string;          // ISO 8601
  summary: string;       // ≤ 200 parole — generato da AI
  topics: string[];      // tag principali della sessione
  messageCount: number;
}

export interface WendyContext {
  systemPrompt: string;
  memoryLoaded: boolean;   // false se il DB non era disponibile
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const WENDY_PERSONA = `Sei Wendy, assistente di orientamento professionale di NorthStar.
Sei empatica, diretta e orientata all'azione. Rispondi sempre in italiano a meno che
l'utente non scriva in un'altra lingua. Non ripetere mai il nome dell'utente ad ogni frase.
Non inventare dati che non conosci — se non hai informazioni su un aspetto, chiedile con garbo.`;

function buildSystemPrompt(profile: UserMemoryProfile | null): string {
  if (!profile) return WENDY_PERSONA;

  const lines: string[] = [WENDY_PERSONA, ''];

  // ── Sezione profilo RIASEC ──
  if (profile.riasecCode || profile.riasecScores) {
    lines.push('## Profilo RIASEC dell\'utente');
    if (profile.riasecCode) {
      lines.push(`Codice Holland: **${profile.riasecCode}**`);
    }
    if (profile.riasecScores) {
      const sorted = Object.entries(profile.riasecScores)
        .sort(([, a], [, b]) => b - a)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      lines.push(`Punteggi: ${sorted}`);
    }
    lines.push('');
  }

  // ── Competenze e background ──
  if (profile.topSkills?.length) {
    lines.push(`## Competenze chiave`);
    lines.push(profile.topSkills.join(', '));
    lines.push('');
  }

  if (profile.workExperiences?.length) {
    lines.push('## Esperienze lavorative');
    profile.workExperiences.forEach((e) => lines.push(`- ${e}`));
    lines.push('');
  }

  if (profile.educationLevel) {
    lines.push(`Livello di istruzione: ${profile.educationLevel}`);
  }

  if (profile.preferredWorkMode) {
    lines.push(`Modalità lavoro preferita: ${profile.preferredWorkMode}`);
  }

  if (profile.careerGoals?.length) {
    lines.push('');
    lines.push('## Obiettivi di carriera');
    profile.careerGoals.forEach((g) => lines.push(`- ${g}`));
  }

  // ── Memoria storico sessioni ──
  if (profile.sessionSummaries?.length) {
    const recent = profile.sessionSummaries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5); // ultime 5 sessioni al massimo

    lines.push('');
    lines.push('## Conversazioni precedenti (riassunti)');
    recent.forEach((s) => {
      lines.push(`- [${s.date.slice(0, 10)}] ${s.summary}`);
      if (s.topics.length) lines.push(`  Topic: ${s.topics.join(', ')}`);
    });
    lines.push('');
    lines.push('Usa queste informazioni per dare continuità alla conversazione.');
    lines.push('Non riepilogare i riassunti all\'utente a meno che non ti venga chiesto.');
  }

  return lines.join('\n');
}

// ─── Database layer ───────────────────────────────────────────────────────────

async function loadProfileFromDB(userId: string): Promise<UserMemoryProfile | null> {
  try {
    // Legge i dati del profilo utente già esistenti nel DB NorthStar.
    // La query unisce:
    //   - users (nome, educazione)
    //   - test_sessions (risultati RIASEC più recenti)
    //   - cv_data (competenze, esperienze)
    //   - wendy_memory (sessioni riassunti)
    //
    // NOTA: `db.execute` con SQL raw per flessibilità — se Drizzle ha già
    // gli schema tipati per queste tabelle, usare le query ORM.

    const [profileRow] = await db.execute<{
      riasec_code: string | null;
      riasec_scores: Record<string, number> | null;
      top_skills: string[] | null;
      work_experiences: string[] | null;
      education_level: string | null;
      preferred_work_mode: string | null;
      career_goals: string[] | null;
      session_summaries: SessionSummary[] | null;
    }>(`
      SELECT
        ts.riasec_code,
        ts.riasec_scores,
        u.top_skills,
        u.work_experiences,
        u.education_level,
        u.preferred_work_mode,
        u.career_goals,
        wm.sessions AS session_summaries
      FROM users u
      LEFT JOIN (
        SELECT DISTINCT ON (user_id)
          user_id, riasec_code, riasec_scores
        FROM test_sessions
        WHERE user_id = $1 AND status = 'completed'
        ORDER BY user_id, completed_at DESC
      ) ts ON ts.user_id = u.id
      LEFT JOIN wendy_memory wm ON wm.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `, [userId]);

    if (!profileRow) return null;

    return {
      userId,
      riasecCode: profileRow.riasec_code ?? undefined,
      riasecScores: profileRow.riasec_scores ?? undefined,
      topSkills: profileRow.top_skills ?? undefined,
      workExperiences: profileRow.work_experiences ?? undefined,
      educationLevel: profileRow.education_level ?? undefined,
      preferredWorkMode: profileRow.preferred_work_mode ?? undefined,
      careerGoals: profileRow.career_goals ?? undefined,
      sessionSummaries: profileRow.session_summaries ?? undefined,
    };
  } catch (err) {
    logger.warn({ err, userId }, '[wendy-memory] loadProfile fallita — rispondo senza contesto');
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Carica il contesto dell'utente e restituisce il system prompt personalizzato.
 * Non lancia mai — in caso di errore DB restituisce memoryLoaded: false.
 */
export async function loadWendyContext(userId: string): Promise<WendyContext> {
  const profile = await loadProfileFromDB(userId);
  return {
    systemPrompt: buildSystemPrompt(profile),
    memoryLoaded: profile !== null,
  };
}

/**
 * Genera e salva un riassunto della sessione appena conclusa.
 * Chiamata in background — non blocca la risposta all'utente.
 *
 * @param userId   - ID utente
 * @param messages - Array di messaggi della sessione { role, content }
 */
export async function saveSessionSummary(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  if (messages.length < 2) return; // sessione troppo breve

  try {
    const transcript = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role === 'user' ? 'Utente' : 'Wendy'}: ${m.content}`)
      .join('\n');

    // Usa json_extraction (Groq) — veloce, economico
    const summaryJson = await ai.chat({
      useCase: 'json_extraction',
      messages: [
        {
          role: 'system',
          content: [
            'Sei un assistente che riassume conversazioni di orientamento professionale.',
            'Produci un JSON con questa struttura:',
            '{',
            '  "summary": "stringa di massimo 200 parole",',
            '  "topics": ["tag1", "tag2", ...]   // 3-6 tag in italiano',
            '}',
            'Rispondi SOLO con il JSON, senza markdown.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Riassumi questa conversazione:\n\n${transcript}`,
        },
      ],
      temperature: 0.2,
      maxTokens: 512,
    });

    let parsed: { summary: string; topics: string[] };
    try {
      parsed = JSON.parse(summaryJson);
    } catch {
      logger.warn({ userId }, '[wendy-memory] JSON riassunto non parsabile — skip salvataggio');
      return;
    }

    const newEntry: SessionSummary = {
      date: new Date().toISOString(),
      summary: parsed.summary,
      topics: parsed.topics ?? [],
      messageCount: messages.filter((m) => m.role !== 'system').length,
    };

    // Upsert sulla tabella wendy_memory
    await db.execute(`
      INSERT INTO wendy_memory (user_id, sessions, updated_at)
      VALUES ($1, jsonb_build_array($2::jsonb), NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET sessions   = (
          SELECT jsonb_agg(s ORDER BY (s->>'date') DESC)
          FROM (
            SELECT jsonb_array_elements(wendy_memory.sessions) AS s
            UNION ALL
            SELECT $2::jsonb
          ) sub
          LIMIT 20            -- mantieni max 20 sessioni, le più recenti
        ),
        updated_at = NOW()
    `, [userId, JSON.stringify(newEntry)]);

    logger.info({ userId, topics: newEntry.topics }, '[wendy-memory] sessione salvata');
  } catch (err) {
    // Non fatale: la sessione è già finita, l'utente non vede questo errore
    logger.error({ err, userId }, '[wendy-memory] salvataggio sessione fallito');
  }
}
