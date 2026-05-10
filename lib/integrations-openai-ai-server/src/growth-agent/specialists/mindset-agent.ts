/**
 * MindsetAgent v2 — tool calling: search_mental_models (Wikipedia REST API).
 * Pattern: identico al CareerAgent.
 */
import { SpecialistAgent, registerSpecialist } from "../specialist-agent";
import { openai } from "../client";
import type { CoTResult } from "../chain-of-thought";
import type { RouteDecision } from "../router-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "../specialist-agent";
import type OpenAI from "openai";

const mentalModelTool: OpenAI.Chat.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_mental_models",
    description:
      "Cerca la definizione di un bias cognitivo, modello mentale o concetto psicologico su Wikipedia. " +
      "Usa quando l'utente nomina ESPLICITAMENTE un concetto specifico (es. 'Dunning-Kruger', 'growth mindset').",
    parameters: {
      type: "object",
      properties: {
        concept: { type: "string", description: "Nome del bias o modello mentale" },
        language: { type: "string", enum: ["it", "en"], description: "Lingua Wikipedia. Default 'en'." },
      },
      required: ["concept"],
    },
  },
};

interface MentalModelArgs { concept: string; language?: "it" | "en"; }
interface WikiSummary { title: string; extract: string; content_urls?: { desktop?: { page?: string } }; }

async function executeMentalModelSearch(args: MentalModelArgs): Promise<string> {
  const lang = args.language ?? "en";
  const slug = encodeURIComponent(args.concept.replace(/ /g, "_"));
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (res.status === 404 && lang !== "en") return executeMentalModelSearch({ ...args, language: "en" });
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    const data = await res.json() as WikiSummary;
    const extract = data.extract.length > 400 ? data.extract.slice(0, 400) + "..." : data.extract;
    const url = data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${slug}`;
    return `**${data.title}** (Wikipedia):\n${extract}\n ${url}`;
  } catch {
    return `Impossibile recuperare "${args.concept}" da Wikipedia. Procedi con la tua conoscenza.`;
  }
}

class MindsetAgent extends SpecialistAgent {
  readonly DOMAIN = "mindset" as const;
  readonly PERSONA_CORE = `
Sei uno specialista di psicologia della crescita personale e modelli mentali.
1. Non dare consigli diretti prima di aver identificato la credenza radice.
2. Nomina ESPLICITAMENTE il pattern cognitivo osservato (nome tecnico).
3. Una sola domanda Socratica per risposta, calibrata sul punto cieco.
4. Distingui: cio che DICE, cio che CREDE, cio di cui ha BISOGNO.
5. Non normalizzare pattern limitanti. Empatico e diretto.`.trim();
  readonly TONE_HINT = "Socratico, riflessivo, preciso. Psicologo cognitivo.";

  domainWebQuery(userMessage: string) { return `psicologia crescita personale modelli mentali ${userMessage}`; }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const { userMessage } = opts;
    let enrichedMessage = userMessage;
    try {
      const check = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sei il MindsetAgent. Usa search_mental_models solo se l'utente nomina ESPLICITAMENTE un bias cognitivo o modello mentale specifico. Se il messaggio e generico o emotivo NON chiamare il tool." },
          { role: "user", content: userMessage },
        ],
        tools: [mentalModelTool], tool_choice: "auto", max_tokens: 150, temperature: 0,
      });
      const choice = check.choices[0];
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
        for (const tc of choice.message.tool_calls) {
          if (tc.function.name === "search_mental_models") {
            const args = JSON.parse(tc.function.arguments) as MentalModelArgs;
            console.log("[mindset-agent] tool call search_mental_models:", args);
            const result = await executeMentalModelSearch(args);
            enrichedMessage = userMessage + `\n\n---\n[DEFINIZIONE PRECISA DA WIKIPEDIA]\n${result}\n---`;
            console.log("[mindset-agent] tool result injected");
          }
        }
      }
    } catch (err) { console.warn("[mindset-agent] tool pre-check failed:", err); }
    yield* super.run({ ...opts, userMessage: enrichedMessage });
  }

  buildDomainSection(_userMessage: string, cot: CoTResult | null, routeDecision: RouteDecision): string {
    const intentGuide: Record<string, string> = {
      explore: "Non spingere verso una risposta. Aiuta a vedere le assunzioni non dette.",
      problem_solve: "Identifica la credenza radice PRIMA di proporre soluzioni.",
      plan: "credenza da trasformare → evidenza contraria → esperimento comportamentale a basso rischio.",
      reflect: "Crea spazio. Rispecchia senza giudicare. Una domanda giusta vale dieci consigli.",
      vent: "Prima valida completamente. Poi, solo se naturale, introduci una prospettiva alternativa.",
      ask_info: "Spiega con precisione, poi aggancia alla situazione specifica.",
    };
    return [
      "## Belief Analysis Framework",
      intentGuide[routeDecision.intent] ?? intentGuide["reflect"],
      cot?.hiddenNeed && cot.hiddenNeed !== "Non identificato" ? `\n**Bisogno non detto (CoT)**: ${cot.hiddenNeed}` : "",
      cot?.dominantTheme ? `**Tema dominante**: ${cot.dominantTheme}` : "",
    ].filter(Boolean).join("\n");
  }
}

export const mindsetAgent = new MindsetAgent();
registerSpecialist(mindsetAgent);
