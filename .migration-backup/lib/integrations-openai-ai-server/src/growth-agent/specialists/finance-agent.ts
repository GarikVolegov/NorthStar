/**
 * FinanceAgent — specialist per finanza personale e planning economico.
 *
 * Domain: "finance"
 *
 * TOOL: search_finance_data
 * Chiama l'API pubblica di Trading Economics per dati macro live
 * (inflazione, PIL, tassi) rilevanti al contesto dell'utente.
 * Fallback graceful se la chiave non è presente.
 *
 * PERSONA:
 * - Framework: FIRE (Financial Independence Retire Early) + Barefoot Investor
 * - Approccio: budgeting 50/30/20, fondi emergenza, investimento passivo
 * - Evidenza: dati, percentuali, esempi numerici concreti
 * - Tono: chiaro, diretto, senza gergo tecnico non spiegato
 */
import { SpecialistAgent, registerSpecialist } from "../specialist-agent";
import { openai } from "../client";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "../specialist-agent";
import type OpenAI from "openai";

const searchFinanceTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_finance_data",
    description:
      "Recupera dati macro economici in tempo reale (inflazione, PIL, tassi, disoccupazione). " +
      "Usa quando l'utente chiede il contesto economico attuale, rendimenti attesi o dati di mercato.",
    parameters: {
      type: "object",
      properties: {
        indicator: {
          type: "string",
          enum: ["inflation", "gdp", "interest-rate", "unemployment", "stock-market"],
          description: "Indicatore economico richiesto",
        },
        country: {
          type: "string",
          description: "Paese (es. 'Italy', 'United States'). Default: 'Italy'",
        },
      },
      required: ["indicator"],
    },
  },
};

interface FinanceSearchArgs { indicator: string; country?: string; }

async function executeFinanceSearch(args: FinanceSearchArgs): Promise<string> {
  const country = args.country ?? "Italy";
  const indicator = args.indicator;
  try {
    const apiKey = process.env.TRADING_ECONOMICS_API_KEY;
    if (!apiKey) {
      return `[Dati macro non disponibili: TRADING_ECONOMICS_API_KEY non configurata. Usa dati recenti noti.]`;
    }
    const url = `https://api.tradingeconomics.com/${indicator}/${country}?c=${apiKey}&f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as Array<{ Category?: string; LatestValue?: number; LatestValueDate?: string; Unit?: string }>;
    const item = data?.[0];
    if (!item) return `Nessun dato trovato per ${indicator} in ${country}.`;
    return `${country} — ${item.Category ?? indicator}: ${item.LatestValue} ${item.Unit ?? ""} (${item.LatestValueDate ?? "n/d"})`;
  } catch {
    return `Dati macro temporaneamente non disponibili. Procedi con stime generali.`;
  }
}

class FinanceAgent extends SpecialistAgent {
  readonly DOMAIN = "finance" as const;
  readonly PERSONA_CORE = `
Sei uno specialista di finanza personale e pianificazione economica.
1. Usa SEMPRE numeri concreti: percentuali, importi, timeline realistiche.
2. Framework 50/30/20: 50% bisogni, 30% desideri, 20% risparmio/investimento.
3. Prima fondo emergenza (3-6 mesi spese), poi investimento.
4. Investimento passivo: ETF a basso costo (es. Vanguard MSCI World) prima degli attivi.
5. Distingui: reddito da lavoro, reddito passivo, capitale.
6. Italia-specific: ISEE, bonus fiscali, Conto Deposito, BTP, PIR dove rilevante.
7. Evita jargon non spiegato. Se usi acronimo, spiegalo subito.`.trim();
  readonly TONE_HINT = "Preciso, concreto, evidence-based. Come un CFP amico che parla chiaro.";

  domainWebQuery(userMessage: string) { return `finanza personale risparmio investimento italiano ${userMessage}`; }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const { userMessage } = opts;
    let enrichedMessage = userMessage;
    try {
      const check = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sei il FinanceAgent. Usa search_finance_data SOLO se l'utente chiede dati macro attuali (inflazione, PIL, tassi). Altrimenti NON chiamare il tool." },
          { role: "user",   content: userMessage },
        ],
        tools: [searchFinanceTool], tool_choice: "auto", max_tokens: 150, temperature: 0,
      });
      const choice = check.choices[0];
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
        for (const tc of choice.message.tool_calls) {
          if (tc.function.name === "search_finance_data") {
            const args = JSON.parse(tc.function.arguments) as FinanceSearchArgs;
            console.log("[finance-agent] tool call search_finance_data:", args);
            const result = await executeFinanceSearch(args);
            enrichedMessage = userMessage + `\n\n---\n[DATI MACRO LIVE]\n${result}\n---`;
          }
        }
      }
    } catch (err) { console.warn("[finance-agent] tool pre-check failed:", err); }
    yield* super.run({ ...opts, userMessage: enrichedMessage });
  }

  buildDomainSection(userMessage: string, cot: CoTResult | null, routeDecision: RouteDecision): string {
    const intentGuide: Record<string, string> = {
      explore:      "Audit finanziario: chiedi entrate nette mensili, spese fisse, risparmio attuale.",
      problem_solve: "Identifica: è un problema di reddito, spesa o allocazione? Poi framework 50/30/20.",
      plan:         "Piano in 3 fasi: 1) fondo emergenza, 2) elimina debiti ad alto interesse, 3) investi.",
      reflect:      "Esplora il rapporto emotivo con il denaro. Quali credenze limitanti emergono?",
      vent:         "Valida la frustrazione economica. Poi: qual è la singola variabile più controllabile?",
      ask_info:     "Dati precisi + fonti + aggancio alla situazione specifica dell'utente.",
    };
    return [
      "## Financial Planning Framework",
      intentGuide[routeDecision.intent] ?? intentGuide["explore"],
      cot?.dominantTheme ? `\n**Tema rilevato**: ${cot.dominantTheme}` : "",
      "\n**Priorità**: Fondo emergenza → Debiti → ETF/investimento passivo → Obiettivi specifici",
    ].filter(Boolean).join("\n");
  }
}

export const financeAgent = new FinanceAgent();
registerSpecialist(financeAgent);
