/**
 * ui-tools.ts — Generative UI function calling definitions.
 *
 * Defines the 5 OpenAI function-calling tools Wendy can invoke to trigger
 * React component rendering on the frontend instead of plain text.
 *
 * How it works:
 *   1. These tool definitions are passed to openai.chat.completions.create()
 *      as the 'tools' array.
 *   2. When the model decides to render a UI component, it returns
 *      finish_reason='tool_calls' with a tool call payload.
 *   3. agent.ts extracts the call, validates the args, and yields a
 *      { type: 'ui_tool', name, args } SSE event.
 *   4. useGrowthChat.ts stores it in ChatMessage.uiTool.
 *   5. WendyUIRenderer.tsx maps name → React component.
 *
 * Tools:
 *   render_roadmap        — step-by-step career/learning roadmap
 *   render_career_match   — scored career match card
 *   render_quiz           — interactive quick quiz (3-5 domande)
 *   render_resource_list  — list of courses/articles from the platform
 *   render_action_plan    — weekly action plan with tasks
 */
import type OpenAI from "openai";

export type UiToolName =
  | "render_roadmap"
  | "render_career_match"
  | "render_quiz"
  | "render_resource_list"
  | "render_action_plan";

// ── Typed args for each tool ─────────────────────────────────────────────────

export interface RoadmapArgs {
  title: string;
  steps: Array<{
    label:       string;
    description: string;
    durationWeeks?: number;
    resources?:  string[];
  }>;
}

export interface CareerMatchArgs {
  careerName:   string;
  matchScore:   number; // 0-100
  riasecTypes:  string[];
  pros:         string[];
  cons:         string[];
  nextStep:     string;
}

export interface QuizArgs {
  topic:     string;
  questions: Array<{
    text:    string;
    options: string[];
    correct: number; // index
  }>;
}

export interface ResourceListArgs {
  heading:   string;
  resources: Array<{
    title:       string;
    url:         string;
    description: string;
    type:        "course" | "article" | "career_card" | "resource";
  }>;
}

export interface ActionPlanArgs {
  weekLabel: string;
  tasks:     Array<{
    day:         string;
    task:        string;
    durationMin: number;
    why:         string;
  }>;
}

export type UiToolArgs =
  | RoadmapArgs
  | CareerMatchArgs
  | QuizArgs
  | ResourceListArgs
  | ActionPlanArgs;

// ── OpenAI tool definitions ───────────────────────────────────────────────────

export const UI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "render_roadmap",
      description:
        "Mostra una roadmap visuale step-by-step quando l'utente chiede un piano di apprendimento, " +
        "percorso di carriera, o sequenza di obiettivi.",
      parameters: {
        type: "object",
        required: ["title", "steps"],
        properties: {
          title: { type: "string", description: "Titolo della roadmap" },
          steps: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "description"],
              properties: {
                label:         { type: "string" },
                description:   { type: "string" },
                durationWeeks: { type: "number" },
                resources:     { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_career_match",
      description:
        "Mostra una career match card quando l'utente chiede se una carriera è adatta a lui " +
        "o quando confronta profilo RIASEC con una professione specifica.",
      parameters: {
        type: "object",
        required: ["careerName", "matchScore", "riasecTypes", "pros", "cons", "nextStep"],
        properties: {
          careerName:  { type: "string" },
          matchScore:  { type: "number", minimum: 0, maximum: 100 },
          riasecTypes: { type: "array", items: { type: "string" } },
          pros:        { type: "array", items: { type: "string" } },
          cons:        { type: "array", items: { type: "string" } },
          nextStep:    { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_quiz",
      description:
        "Genera un mini-quiz interattivo quando l'utente vuole testare le proprie conoscenze " +
        "su un argomento o quando serve raccogliere informazioni sulle preferenze.",
      parameters: {
        type: "object",
        required: ["topic", "questions"],
        properties: {
          topic: { type: "string" },
          questions: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: {
              type: "object",
              required: ["text", "options", "correct"],
              properties: {
                text:    { type: "string" },
                options: { type: "array", items: { type: "string" }, minItems: 2 },
                correct: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_resource_list",
      description:
        "Mostra una lista di risorse (corsi, articoli) della piattaforma NorthStar " +
        "quando l'utente chiede consigli su cosa studiare o leggere.",
      parameters: {
        type: "object",
        required: ["heading", "resources"],
        properties: {
          heading: { type: "string" },
          resources: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "url", "description", "type"],
              properties: {
                title:       { type: "string" },
                url:         { type: "string" },
                description: { type: "string" },
                type:        { type: "string", enum: ["course", "article", "career_card", "resource"] },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "render_action_plan",
      description:
        "Crea un piano d'azione settimanale concreto quando l'utente chiede cosa fare " +
        "questa settimana, come iniziare un cambiamento, o un piano giorno per giorno.",
      parameters: {
        type: "object",
        required: ["weekLabel", "tasks"],
        properties: {
          weekLabel: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              required: ["day", "task", "durationMin", "why"],
              properties: {
                day:         { type: "string" },
                task:        { type: "string" },
                durationMin: { type: "number" },
                why:         { type: "string" },
              },
            },
          },
        },
      },
    },
  },
];
