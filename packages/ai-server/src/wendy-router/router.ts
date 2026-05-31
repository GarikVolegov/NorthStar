/**
 * router.ts — orchestratore del Wendy Router.
 *
 * Data una WendyRequest, determina:
 * - intent (classifyIntent)
 * - modello e tier (selectModelFor esistente)
 * - tool disponibili (getToolsForIntent)
 * - se usare fast path (navigation/simple_qa) o growth agent completo
 */
import { classifyIntent }      from "./intent-classifier";
import { getToolsForIntent }   from "./tool-registry";
import { selectModelFor }      from "../model-router";
import type { WendyIntent, WendyPageContext, CompressedHistory, WendyRouterDecision } from "./types";

// Tier per intent (mappa intent → AgentRole esistente nel model-router)
const INTENT_TO_ROLE: Record<WendyIntent, Parameters<typeof selectModelFor>[0]> = {
  navigation:    "router-classify",    // NANO — ultra-veloce
  simple_qa:     "growth-agent-voice", // NANO — breve, senza storia
  conversation:  "growth-agent-chat",  // STANDARD — chat normale
  planning:      "specialist-chat",    // STANDARD → REASONING per premium
  deep_analysis: "chain-of-thought",  // REASONING — DeepSeek R1
};

// Intent che bypassa il growth agent completo (pipeline leggera)
const FAST_PATH_INTENTS = new Set<WendyIntent>(["navigation", "simple_qa"]);

export interface ResolvedWendyRoute {
  intent:           WendyIntent;
  decision:         WendyRouterDecision;
}

function resolveRouteTier(modelRoute: ReturnType<typeof selectModelFor>): WendyRouterDecision["tier"] {
  if (modelRoute.tier) return modelRoute.tier;
  return modelRoute.reason.includes("nano")      ? "nano" :
         modelRoute.reason.includes("micro")     ? "micro" :
         modelRoute.reason.includes("reasoning") ? "reasoning" : "standard";
}

function formatFallbackOrder(modelRoute: ReturnType<typeof selectModelFor>): string {
  if (!modelRoute.fallbackOrder || modelRoute.fallbackOrder.length === 0) return "none";
  return modelRoute.fallbackOrder
    .map((fallback) => `${fallback.provider}:${fallback.model}`)
    .join(">");
}

export function resolveWendyRoute(opts: {
  userMessage:       string;
  pageContext?:      WendyPageContext | undefined;
  compressedHistory?: CompressedHistory | undefined;
  isPremium?:        boolean | undefined;
  hasFileAttached?:  boolean | undefined;
}): ResolvedWendyRoute {
  const { userMessage, pageContext, compressedHistory, isPremium = false, hasFileAttached = false } = opts;

  // 1. Classifica l'intent
  const intent = classifyIntent({ userMessage, pageContext, compressedHistory, hasFileAttached });

  // 2. Determina complessità per il model-router
  const complexity =
    intent === "deep_analysis" ? "deep" :
    intent === "planning"      ? "standard" :
                                 "simple";

  // 3. Seleziona modello tramite il model-router esistente
  const role = INTENT_TO_ROLE[intent];
  const modelRoute = selectModelFor(role, { isPremium, complexity });

  // 4. Tool disponibili per l'intent
  const toolsEnabled = getToolsForIntent(intent);

  // 5. Fast path se navigation o simple_qa (bypassa growth agent)
  const skipFullPipeline = FAST_PATH_INTENTS.has(intent);

  const decision: WendyRouterDecision = {
    intent,
    tier:            resolveRouteTier(modelRoute),
    model:           modelRoute.model,
    provider:        modelRoute.provider,
    toolsEnabled,
    skipFullPipeline,
    reasoning:       `intent=${intent}, role=${role}, tier=${resolveRouteTier(modelRoute)}, provider=${modelRoute.provider}, model=${modelRoute.model}, reason=${modelRoute.reason}, fallback=${formatFallbackOrder(modelRoute)}`,
  };

  return { intent, decision };
}
