/**
 * CareerAgent — specialista dominio: career.
 *
 * FOCUS
 * ─────
 * - Ricerca lavoro, candidature, CV, LinkedIn
 * - Colloqui: preparazione, negoziazione salariale, follow-up
 * - Cambio carriera, transizioni, gap year
 * - Networking strategico
 * - Crescita professionale e promozioni
 *
 * PERSONA
 * ───────
 * Direct, data-driven, pragmatico. Non dà consigli generici.
 * Ogni risposta include almeno UN'azione concreta con scadenza.
 * Cita dati di mercato quando disponibili (stipendi, tassi di risposta, ecc.)
 *
 * TOOL CALLING (Phase 4)
 * ──────────────────────
 * Il CareerAgent dispone di un tool strutturato `search_job_offers`.
 * Prima di generare la risposta finale, verifica se il modello intende
 * chiamare il tool (pre-check su gpt-4o-mini). Se sì, esegue la chiamata
 * all'API di offerte lavoro e inietta i risultati nel contesto del prompt.
 *
 * DOMAIN SECTION
 * ──────────────
 * Aggiunge al prompt un blocco "Career Framework" con:
 * - Job search funnel (applicazioni → risposta → colloquio → offerta)
 * - Priorità basata sull'intent (explore vs problem_solve vs plan)
 */
import { SpecialistAgent } from "../specialist-agent";
import { registerSpecialist } from "../specialist-agent";
import { openai } from "../client";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "../specialist-agent";
import type OpenAI from "openai";

// ── Tool definition ─────────────────────────────────────────────────────────

const jobSearchTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_job_offers",
    description:
      "Cerca offerte di lavoro reali in base a ruolo, città e livello di esperienza. " +
      "Usa questo tool quando l'utente chiede opportunità lavorative, stipendi di mercato o ruoli disponibili.",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "Titolo del ruolo cercato (es. 'Software Engineer', 'Product Manager')",
        },
        location: {
          type: "string",
          description: "Città o paese (es. 'Milano', 'Remote', 'Londra'). Opzionale.",
        },
        experience_level: {
          type: "string",
          enum: ["junior", "mid", "senior", "lead"],
          description: "Livello di esperienza richiesto. Opzionale.",
        },
      },
      required: ["role"],
    },
  },
};

// ── Tool executor ───────────────────────────────────────────────────────────

interface JobSearchArgs {
  role: string;
  location?: string;
  experience_level?: string;
}

interface RemotiveJob {
  title: string;
  company_name: string;
  salary?: string;
  url: string;
  candidate_required_location?: string;
}

async function executeJobSearch(args: JobSearchArgs): Promise<string> {
  try {
    const query = encodeURIComponent(args.role);
    const url = `https://remotive.com/api/remote-jobs?search=${query}&limit=5`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Job API HTTP ${res.status}`);

    const data = (await res.json()) as { jobs: RemotiveJob[] };

    if (!data.jobs?.length) {
      return (
        `Nessuna offerta trovata su Remotive per "${args.role}". ` +
        `Prova su LinkedIn Jobs (linkedin.com/jobs) o Indeed.`
      );
    }

    const lines = data.jobs.slice(0, 5).map((j, i) => {
      const loc = j.candidate_required_location ? ` · 📍 ${j.candidate_required_location}` : "";
      const salary = j.salary ? ` · 💰 ${j.salary}` : "";
      return `${i + 1}. **${j.title}** @ ${j.company_name}${loc}${salary}\n   🔗 ${j.url}`;
    });

    return (
      `Offerte trovate per "${args.role}" (fonte: Remotive):\n\n` +
      lines.join("\n\n") +
      `\n\n_Per offerte locali in Italia consulta anche LinkedIn Jobs e InfoJobs._`
    );
  } catch (err) {
    console.warn("[career-agent] job search failed:", err);
    return (
      `Impossibile recuperare offerte in tempo reale. ` +
      `Consiglio: cerca su LinkedIn Jobs con filtro "${args.role}"` +
      (args.location ? ` a ${args.location}` : "") +
      ` e su Glassdoor per i range salariali.`
    );
  }
}

// ── CareerAgent ─────────────────────────────────────────────────────────────

class CareerAgent extends SpecialistAgent {
  readonly DOMAIN = "career" as const;

  readonly PERSONA_CORE = `
Sei uno specialista di sviluppo professionale e carriera.
Regole non negoziabili:
1. Ogni risposta include ALMENO UN'azione concreta con una scadenza realistica.
2. Cita sempre dati di mercato quando disponibili (range salariali, tassi di risposta, benchmark di settore).
3. Distingui SEMPRE tra strategie a breve termine (0-3 mesi) e lungo termine (3-12 mesi).
4. Non dare consigli generici tipo "amplia la tua rete" senza specificare COME e CON CHI.
5. Se l'utente mostra un bias cognitivo sul mercato del lavoro, nominalo.
  `.trim();

  readonly TONE_HINT =
    "Diretto, pragmatico, orientato ai risultati. Parla come un recruiter senior onesto, non come un motivatore.";

  domainWebQuery(userMessage: string): string {
    return `carriera lavoro mercato professionale ${userMessage}`;
  }

  /**
   * Override run — aggiunge tool calling PRIMA del flusso base.
   *
   * Flusso:
   *   1. Pre-check gpt-4o-mini: il modello decide se invocare search_job_offers
   *   2. Se tool_calls → esegui executeJobSearch → inietta risultato nel userMessage
   *   3. Delega al SpecialistAgent.run() con il contesto arricchito
   */
  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const { userMessage } = opts;
    let enrichedMessage = userMessage;

    try {
      const toolCheck = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sei il CareerAgent di NorthStar. " +
              "Se il messaggio dell'utente riguarda ricerca di offerte di lavoro, " +
              "posizioni aperte, stipendi o ruoli disponibili, usa il tool search_job_offers. " +
              "In tutti gli altri casi NON chiamare il tool.",
          },
          { role: "user", content: userMessage },
        ],
        tools: [jobSearchTool],
        tool_choice: "auto",
        max_tokens: 200,
        temperature: 0,
      });

      const choice = toolCheck.choices[0];

      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.function.name === "search_job_offers") {
            const args = JSON.parse(toolCall.function.arguments) as JobSearchArgs;
            console.log("[career-agent] 🔧 tool call → search_job_offers:", args);

            const toolResult = await executeJobSearch(args);

            enrichedMessage =
              userMessage +
              `\n\n---\n[DATI LIVE OFFERTE LAVORO — recuperati in tempo reale]\n${toolResult}\n[Fine dati offerte]\n---`;

            console.log("[career-agent] ✅ tool result injected into context");
          }
        }
      }
    } catch (err) {
      // Non bloccare il flusso se il pre-check fallisce
      console.warn("[career-agent] tool pre-check failed, proceeding without tool data:", err);
    }

    // Delega al flusso base con il messaggio eventualmente arricchito
    yield* super.run({ ...opts, userMessage: enrichedMessage });
  }

  buildDomainSection(
    userMessage: string,
    cot: CoTResult | null,
    routeDecision: RouteDecision,
  ): string {
    const intentFramework: Record<string, string> = {
      explore:
        "L'utente sta esplorando opzioni di carriera. Aiutalo a mappare le sue opzioni concrete, NON a scegliere ancora. Usa domande Socratiche per restringere il campo.",
      problem_solve:
        "L'utente ha un problema specifico di carriera. Vai dritto alla soluzione pratica. Usa il formato: Problema → Causa radice → Piano d'azione in 3 passi.",
      plan:
        "L'utente vuole un piano di carriera. Struttura la risposta in: Obiettivo 30gg / 90gg / 12 mesi. Sii specifico su metriche e milestone.",
      reflect:
        "L'utente vuole riflettere su una scelta di carriera. Aiutalo a distinguere tra valori, paure e opportunità reali.",
      vent:
        "L'utente è frustrato con la sua situazione lavorativa. Prima valida le emozioni (1-2 frasi), poi passa all'analisi razionale.",
      ask_info:
        "L'utente vuole informazioni di mercato. Fornisci dati concreti (range salariali, trend settore, skill più richieste). Cita la fonte se la conosci.",
    };

    const framework = intentFramework[routeDecision.intent] ?? intentFramework["explore"];

    return [
      "## Career Framework",
      framework,
      cot?.dominantTheme
        ? `\n**Tema sottostante rilevato**: ${cot.dominantTheme}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}

export const careerAgent = new CareerAgent();
registerSpecialist(careerAgent);
