/**
 * HabitsAgent v2 — tool calling: search_habit_tracker (Habitica API).
 * Pattern: identico al CareerAgent.
 */
import { SpecialistAgent, registerSpecialist } from "../specialist-agent";
import { openai } from "../client";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "../specialist-agent";
import type OpenAI from "openai";

const habitTrackerTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_habit_tracker",
    description:
      "Cerca sfide pubbliche di habit tracking su Habitica per trovare routine e piani di abitudini. " +
      "Usa quando l'utente chiede esempi di routine, sfide di abitudini o ispirazione per un piano.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tema della ricerca (es. 'morning routine', 'deep work', 'sleep')" },
        category: { type: "string", enum: ["health", "productivity", "mindfulness", "exercise", "creativity", "general"] },
      },
      required: ["query"],
    },
  },
};

interface HabitSearchArgs { query: string; category?: string; }
interface HabiticaChallenge { id: string; name: string; description?: string; memberCount?: number; }

async function executeHabitSearch(args: HabitSearchArgs): Promise<string> {
  try {
    const res = await fetch(
      "https://habitica.com/api/v3/challenges/groups/habitrpg?page=0",
      { headers: { "x-client": "northstar-habits-agent-0.1" }, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) throw new Error(`Habitica HTTP ${res.status}`);
    const data = await res.json() as { data?: HabiticaChallenge[] };
    const q = args.query.toLowerCase();
    const filtered = (data.data ?? [])
      .filter((c) => `${c.name} ${c.description ?? ""}`.toLowerCase().includes(q))
      .slice(0, 4);
    if (!filtered.length) {
      return `Nessuna sfida trovata per "${args.query}" su Habitica. Consulta habitica.com/challenges.`;
    }
    return (
      `Sfide Habitica per "${args.query}":\n\n` +
      filtered.map((c, i) => `${i + 1}. **${c.name}**${c.memberCount ? ` · ${c.memberCount} utenti` : ""}`).join("\n") +
      "\n\n_Usa come ispirazione per costruire la tua routine incrementale._"
    );
  } catch {
    return `Impossibile recuperare dati Habitica. Consulta habitica.com/challenges o r/getdisciplined.`;
  }
}

class HabitsAgent extends SpecialistAgent {
  readonly DOMAIN = "habits" as const;
  readonly PERSONA_CORE = `
Sei uno specialista di habit design e ottimizzazione della performance.
1. Usa SEMPRE il modello Trigger → Routine → Reward.
2. Tiny habits: inizia da 2 minuti o meno (BJ Fogg).
3. Distingui tra abitudine da COSTRUIRE, ELIMINARE e MODIFICARE.
4. Identifica la friction principale e proponi UNA soluzione concreta.
5. Cita autori (James Clear, BJ Fogg, Cal Newport, Andrew Huberman).
6. Max 2-3 nuove abitudini contemporaneamente.`.trim();
  readonly TONE_HINT = "Sistematico, pratico, scientifico. Performance coach evidence-based.";

  domainWebQuery(userMessage: string) { return `abitudini routine produttivita habit formation ${userMessage}`; }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const { userMessage } = opts;
    let enrichedMessage = userMessage;
    try {
      const check = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sei l'HabitsAgent. Usa search_habit_tracker solo se l'utente chiede esempi di routine o sfide di abitudini. Altrimenti NON chiamare il tool." },
          { role: "user", content: userMessage },
        ],
        tools: [habitTrackerTool], tool_choice: "auto", max_tokens: 150, temperature: 0,
      });
      const choice = check.choices[0];
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
        for (const tc of choice.message.tool_calls) {
          if (tc.function.name === "search_habit_tracker") {
            const args = JSON.parse(tc.function.arguments) as HabitSearchArgs;
            console.log("[habits-agent] tool call search_habit_tracker:", args);
            const result = await executeHabitSearch(args);
            enrichedMessage = userMessage + `\n\n---\n[DATI LIVE HABIT TRACKER]\n${result}\n---`;
            console.log("[habits-agent] tool result injected");
          }
        }
      }
    } catch (err) { console.warn("[habits-agent] tool pre-check failed:", err); }
    yield* super.run({ ...opts, userMessage: enrichedMessage });
  }

  buildDomainSection(userMessage: string, cot: CoTResult | null, routeDecision: RouteDecision): string {
    const intentGuide: Record<string, string> = {
      explore: "Audit: chiedi le 3 abitudini che impattano di piu la giornata.",
      problem_solve: "Habit Loop: Trigger → Routine → Reward + cambiamento piu piccolo possibile.",
      plan: "Struttura: mattina/lavoro/sera. 1 abitudine chiave per slot + trigger + reward. Max 3.",
      reflect: "Identifica la keystone habit: quale, se cambiata, impatta le altre.",
      vent: "Valida la frustrazione. Poi: aspettativa irrealistica o friction non identificata?",
      ask_info: "Precisione + autori + aggancio alla situazione specifica.",
    };
    return [
      "## Habit Loop Analysis",
      intentGuide[routeDecision.intent] ?? intentGuide["explore"],
      cot?.dominantTheme ? `\n**Tema rilevato**: ${cot.dominantTheme}` : "",
      "\n**Framework**: Trigger → Routine → Reward (Duhigg) + Tiny Habits (Fogg) + Atomic Habits (Clear)",
    ].filter(Boolean).join("\n");
  }
}

export const habitsAgent = new HabitsAgent();
registerSpecialist(habitsAgent);
