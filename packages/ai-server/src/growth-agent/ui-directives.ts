/**
 * ui-directives.ts — deterministic UI layout/theme hints derived from route decision.
 *
 * Zero LLM calls. Pure mapping: domain + intent → UiDirectives.
 * Consumed by the `done` event emitted by the growth agent and read by the frontend.
 */
import type { Domain, Intent } from "./router-agent";

export interface UiDirectives {
  layout?: "default" | "focus_mode" | "coach_mode" | "dashboard";
  theme?: "default" | "calm" | "energetic";
  suggestedWidgets?: string[];
  focusArea?: string;
}

const DOMAIN_LAYOUT: Partial<Record<Domain, UiDirectives["layout"]>> = {
  habits:        "dashboard",
  trading:       "dashboard",
  finance:       "dashboard",
  mindset:       "focus_mode",
  relationships: "focus_mode",
  career:        "coach_mode",
  health:        "coach_mode",
};

const DOMAIN_THEME: Partial<Record<Domain, UiDirectives["theme"]>> = {
  mindset:       "calm",
  relationships: "calm",
  habits:        "energetic",
  health:        "energetic",
};

const DOMAIN_WIDGETS: Partial<Record<Domain, string[]>> = {
  habits:        ["habit_tracker", "streak_counter"],
  career:        ["goal_progress", "skill_radar"],
  trading:       ["portfolio_overview", "market_pulse"],
  finance:       ["portfolio_overview"],
  health:        ["habit_tracker", "energy_gauge"],
  mindset:       ["mood_check", "reflection_prompt"],
};

const INTENT_LAYOUT_OVERRIDE: Partial<Record<Intent, UiDirectives["layout"]>> = {
  plan:          "coach_mode",
  problem_solve: "focus_mode",
};

export function buildUiDirectives(domain: Domain, intent: Intent): UiDirectives {
  const layout = INTENT_LAYOUT_OVERRIDE[intent] ?? DOMAIN_LAYOUT[domain] ?? "default";
  const theme = DOMAIN_THEME[domain] ?? "default";
  const suggestedWidgets = DOMAIN_WIDGETS[domain];
  const focusArea = domain !== "general" ? domain : undefined;

  return {
    layout,
    ...(theme !== "default" ? { theme } : {}),
    ...(suggestedWidgets ? { suggestedWidgets } : {}),
    ...(focusArea ? { focusArea } : {}),
  };
}
