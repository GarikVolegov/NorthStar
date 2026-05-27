/**
 * configure_routine — Wendy tool for creating autonomous scheduled routines.
 *
 * Two-phase flow:
 *   1. First call (confirmed !== 'true'): returns a needs_confirmation preview card.
 *   2. Second call (confirmed === 'true'): inserts the routine row in the DB.
 */
import { toolRegistry } from "./registry.js";
import type { WendyIntent } from "../wendy-router/types.js";

// Auto-registration on import
toolRegistry.register({
  name: "configure_routine",
  description:
    "Configures an autonomous routine for the user. Call this when the user asks to set up a scheduled routine, automation, or recurring task. Extract all parameters from the conversation.",
  parameters: [
    {
      name: "type",
      type: "string",
      required: true,
      description:
        "Routine type: job_monitor | market_report | mindset_exercise | growth_briefing | interview_prep",
    },
    {
      name: "schedule",
      type: "string",
      required: true,
      description:
        "Cron expression (e.g. '0 9 * * 4') or preset (daily, weekly, every_monday, every_thursday, etc.)",
    },
    {
      name: "name",
      type: "string",
      required: false,
      description: "Human-readable name for this routine (optional, auto-generated if not provided)",
    },
    {
      name: "output_channel",
      type: "string",
      required: false,
      description: "Delivery channel: email | in_app | wendy_context | all. Default: in_app",
    },
    {
      name: "parameters_json",
      type: "string",
      required: false,
      description:
        "JSON string of type-specific parameters. job_monitor: {role, city?, count?}. market_report: {sector, length?}. mindset_exercise: {tone?, focus?}. growth_briefing: {}. interview_prep: {targetCompany, targetRole?}",
    },
    {
      name: "confirmed",
      type: "string",
      required: false,
      description:
        "Set to 'true' when the user has confirmed the routine preview. First call without this shows a preview.",
    },
  ],
  intents: ["planning", "conversation"] as WendyIntent[],
  isUiTool: false,
  requiresWrite: true,
  rateLimit: { maxPerHour: 10 },
});
