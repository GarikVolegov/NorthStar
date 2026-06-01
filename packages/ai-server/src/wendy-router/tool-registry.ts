/**
 * tool-registry.ts — catalogo dei 17 tool Wendy V1 e mapping intent → tool.
 *
 * Principio: ogni intent riceve solo i tool necessari per ridurre token e allucinazioni.
 * Le descrizioni sono formulate per essere non ambigue (disambiguazione obbligatoria).
 */
import type { WendyIntent, ToolDefinition } from "./types";
import { INTENT_TOOLS } from "./tool-registry-data";

import { ALL_TOOLS } from "./tool-definitions";

// ── Matrice intent → tool abilitati ──────────────────────────────────────────

// ── API pubblica ──────────────────────────────────────────────────────────────

export function getToolsForIntent(intent: WendyIntent): ToolDefinition[] {
  return (INTENT_TOOLS[intent] ?? [])
    .map((n) => ALL_TOOLS[n])
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}

export function toolsToOpenAIFormat(tools: ToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: object };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name:        t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            { type: p.type === "array" ? "array" : p.type, description: p.description,
              ...(p.type === "array" ? { items: { type: p.itemType ?? "string" } } : {}),
            },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

// ── Plugin Tool Registry bootstrap ───────────────────────────────────────────
// Registers all data tools into the unified toolRegistry singleton so that
// isUiTool(), getForIntent(), and all() work correctly across the codebase.

import { toolRegistry } from "../tools/registry";

const WRITE_TOOLS = new Set([
  "save_objective",
  "update_objective_progress",
  "save_business_idea",
  "save_memory_fact",
  "add_calendar_event",
  "record_compass_signal",
  "log_spike_outcome",
]);

(function bootstrapToolRegistry() {
  // Invert INTENT_TOOLS matrix → per-tool intent list
  const toolIntents = new Map<string, WendyIntent[]>();
  for (const [intent, names] of Object.entries(INTENT_TOOLS) as [WendyIntent, string[]][]) {
    for (const name of names) {
      if (!toolIntents.has(name)) toolIntents.set(name, []);
      toolIntents.get(name)!.push(intent);
    }
  }

  for (const tool of Object.values(ALL_TOOLS)) {
    toolRegistry.register({
      ...tool,
      intents:       toolIntents.get(tool.name) ?? [],
      isUiTool:      false,
      requiresWrite: WRITE_TOOLS.has(tool.name),
    });
  }
})();
