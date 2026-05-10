/**
 * RelationshipsAgent — specialist per networking, comunicazione e relazioni professionali.
 *
 * Domain: "relationships"
 *
 * TOOL: search_linkedin_tips
 * Cerca consigli e best practice di networking su fonti pubbliche.
 * (Usa DuckDuckGo Instant Answer API come fonte pubblica no-key.)
 *
 * PERSONA:
 * - Framework: Dale Carnegie + Never Split the Difference (Voss) + Emotional Intelligence (Goleman)
 * - Focus: networking autentico, comunicazione assertiva, gestione conflitti, mentorship
 * - Tono: caldo, empatico, concreto. Non prescrive, accompagna.
 */
import { SpecialistAgent, registerSpecialist } from "../specialist-agent";
import { openai } from "../client";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "../specialist-agent";
import type OpenAI from "openai";

const searchNetworkingTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_networking_tips",
    description:
      "Cerca consigli pratici di networking professionale e comunicazione. " +
      "Usa quando l'utente chiede script, template di messaggi o strategie specifiche di networking.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Argomento specifico (es. 'cold outreach LinkedIn', 'chiedere mentorship', 'gestire conflitti team')",
        },
      },
      required: ["topic"],
    },
  },
};

interface NetworkingSearchArgs { topic: string; }

async function executeNetworkingSearch(args: NetworkingSearchArgs): Promise<string> {
  try {
    const query = encodeURIComponent(`professional networking ${args.topic} tips`);
    const url   = `https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=1`;
    const res   = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json() as { AbstractText?: string; RelatedTopics?: Array<{ Text?: string }> };
    const parts: string[] = [];
    if (data.AbstractText) parts.push(data.AbstractText.slice(0, 400));
    const topics = (data.RelatedTopics ?? []).slice(0, 3).map((t) => t.Text).filter(Boolean);
    if (topics.length) parts.push(topics.join("\n"));
    if (!parts.length) return `Nessun risultato per "${args.topic}". Procedo con best practice consolidate.`;
    return `Riferimenti per "${args.topic}":\n\n${parts.join("\n\n")}`;
  } catch {
    return `Ricerca temporaneamente non disponibile. Procedo con framework consolidati.`;
  }
}

class RelationshipsAgent extends SpecialistAgent {
  readonly DOMAIN = "relationships" as const;
  readonly PERSONA_CORE = `
Sei uno specialista di networking professionale, comunicazione e relazioni.
1. Networking autentico: NON pitchare subito. Prima dai valore, poi chiedi.
2. Script concreti: se l'utente ha bisogno di un messaggio, fornisci UN template pronto.
3. Framework Voss: mirroring, labeling, calibrated questions per la comunicazione difficile.
4. Mentorship: come trovare, come approcciare, come mantenere il rapporto.
5. Conflitti: distingui tra conflitti di task, di processo e di relazione.
6. LinkedIn: ottimizzazione profilo, outreach, costruzione authority con contenuti.
7. Qualità > quantità: 10 connessioni genuine valgono 1000 casuali.`.trim();
  readonly TONE_HINT = "Caldo, empatico, concreto. Coach delle relazioni che non giudica.";

  domainWebQuery(userMessage: string) { return `networking professionale comunicazione relazioni ${userMessage}`; }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const { userMessage } = opts;
    let enrichedMessage = userMessage;
    try {
      const check = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sei il RelationshipsAgent. Usa search_networking_tips SOLO se l'utente chiede script specifici, template di messaggi o strategie di networking concrete. Altrimenti NON chiamare il tool." },
          { role: "user",   content: userMessage },
        ],
        tools: [searchNetworkingTool], tool_choice: "auto", max_tokens: 150, temperature: 0,
      });
      const choice = check.choices[0];
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
        for (const tc of choice.message.tool_calls) {
          if (tc.function.name === "search_networking_tips") {
            const args = JSON.parse(tc.function.arguments) as NetworkingSearchArgs;
            console.log("[relationships-agent] tool call search_networking_tips:", args);
            const result = await executeNetworkingSearch(args);
            enrichedMessage = userMessage + `\n\n---\n[DATI NETWORKING LIVE]\n${result}\n---`;
          }
        }
      }
    } catch (err) { console.warn("[relationships-agent] tool pre-check failed:", err); }
    yield* super.run({ ...opts, userMessage: enrichedMessage });
  }

  buildDomainSection(userMessage: string, cot: CoTResult | null, routeDecision: RouteDecision): string {
    const intentGuide: Record<string, string> = {
      explore:      "Mappa relazionale: chi hai già in rete che potrebbe aiutarti? Chi manca?",
      problem_solve: "Identifica il tipo di conflitto/blocco e usa il framework corretto (task/processo/relazione).",
      plan:         "Piano networking: 3 persone da contattare questa settimana + script + follow-up calendar.",
      reflect:      "Esplora i pattern relazionali ricorrenti. C'è un tema che si ripete?",
      vent:         "Valida il disagio relazionale. Poi: cosa è nel tuo controllo in questa situazione?",
      ask_info:     "Fornisci framework + esempio concreto + prossimo passo immediato.",
    };
    return [
      "## Relationship & Networking Framework",
      intentGuide[routeDecision.intent] ?? intentGuide["explore"],
      cot?.dominantTheme ? `\n**Tema rilevato**: ${cot.dominantTheme}` : "",
      "\n**Framework**: Networking autentico (give first) + Comunicazione Voss + Mentorship attiva",
    ].filter(Boolean).join("\n");
  }
}

export const relationshipsAgent = new RelationshipsAgent();
registerSpecialist(relationshipsAgent);
