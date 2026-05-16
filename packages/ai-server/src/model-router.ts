/**
 * model-router.ts — Centralized model selection for every agent / task.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GOAL: each agent picks the cheapest model that still delivers the required
 * quality for its task. Free-first strategy:
 *
 *   - NANO     →  Groq llama-3.1-8b-instant      (≈ free, 14k tok/s)
 *                 routing, classification, gating, micro-extraction
 *   - MICRO    →  Groq llama-3.3-70b-versatile   (free tier)
 *                 summarization, evaluation, supervisor, memory
 *   - STANDARD →  OpenRouter deepseek-chat-v3:free OR Groq llama-3.3-70b
 *                 user-facing chat, specialists, growth agent
 *   - REASONING → OpenRouter deepseek-r1:free
 *                 chain-of-thought, deep step-by-step
 *   - PREMIUM   → OpenAI gpt-4o (opt-in, only for paid users + deep complexity)
 *
 * Every default is overridable via env (MODEL_<ROLE>). Set AI_PROVIDER to
 * route the actual HTTP call (openrouter | groq | openai). See README of
 * packages/ai-server.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Public types ──────────────────────────────────────────────────────────────

export type RequestComplexity = "simple" | "standard" | "deep";

/**
 * Logical role of the caller. Every agent / task that hits an LLM declares its
 * role here, and the router picks the matching model.
 */
export type AgentRole =
  // chat user-facing
  | "growth-agent-chat"
  | "growth-agent-voice"
  | "specialist-chat"
  // routing & gating
  | "router-classify"
  | "parallel-handoff-gate"
  | "parallel-handoff-extract"
  | "search-router"
  | "interview-adapt"
  | "knowledge-categorize"
  // medium reasoning
  | "supervisor-rewrite"
  | "supervisor-pattern"
  | "memory-extract"
  | "session-summarize"
  | "discovery-enrich"
  | "interview-evaluate"
  | "interview-generate"
  | "knowledge-link"
  | "knowledge-suggest"
  | "wiki-chat"
  | "wiki-suggest"
  // deep reasoning
  | "chain-of-thought"
  // Security agent
  | "security-scan"
  | "security-fix"
  // Search orchestrator
  | "search-orchestrate";

export interface RouterOptions {
  isPremium?: boolean;
  complexity?: RequestComplexity;
  /** Force a provider preference — overrides defaults below. */
  preferGroq?: boolean;
}

export interface ModelRoute {
  model: string;
  provider: "openai" | "groq" | "openrouter";
  temperature: number;
  maxTokens: number;
  reason: string;
}

// ── Default model catalogue (env-overridable) ─────────────────────────────────

/**
 * Defaults aim at "free + good enough". Override per role via env, e.g.:
 *   MODEL_ROUTER_CLASSIFY=llama-3.1-8b-instant
 *   MODEL_SPECIALIST_CHAT=deepseek/deepseek-chat-v3-0324:free
 *   MODEL_CHAIN_OF_THOUGHT=deepseek/deepseek-r1:free
 */
const env = (k: string, fallback: string): string => process.env[k] ?? fallback;

// Tier presets — env-overridable. Keep names short for cost-tracking pricing table.
const NANO_GROQ      = env("MODEL_NANO_GROQ", "llama-3.1-8b-instant");
const MICRO_GROQ     = env("MODEL_MICRO_GROQ", "llama-3.3-70b-versatile");
const STANDARD_OR    = env("MODEL_STANDARD_OPENROUTER", "deepseek/deepseek-chat-v3-0324:free");
const STANDARD_GROQ  = env("MODEL_STANDARD_GROQ", "llama-3.3-70b-versatile");
const REASONING_OR   = env("MODEL_REASONING_OPENROUTER", "deepseek/deepseek-r1:free");
const PREMIUM_OPENAI = env("MODEL_PREMIUM_OPENAI", "gpt-4o");
const CHEAP_OPENAI   = env("MODEL_CHEAP_OPENAI", "gpt-4o-mini");

/**
 * Active backend. If AI_PROVIDER=openrouter we prefer OpenRouter free-tier models
 * for STANDARD/REASONING and fall back to OpenAI naming only when OpenRouter
 * isn't configured. The actual HTTP call goes through llm/client.ts.
 */
const ACTIVE_PROVIDER: "openai" | "groq" | "openrouter" =
  (process.env.AI_PROVIDER?.toLowerCase() as any) ?? "openai";

function standardModel(): { model: string; provider: ModelRoute["provider"] } {
  if (ACTIVE_PROVIDER === "openrouter") return { model: STANDARD_OR, provider: "openrouter" };
  if (ACTIVE_PROVIDER === "groq") return { model: STANDARD_GROQ, provider: "groq" };
  return { model: CHEAP_OPENAI, provider: "openai" };
}

function reasoningModel(): { model: string; provider: ModelRoute["provider"] } {
  if (ACTIVE_PROVIDER === "openrouter") return { model: REASONING_OR, provider: "openrouter" };
  if (ACTIVE_PROVIDER === "groq") return { model: MICRO_GROQ, provider: "groq" };
  return { model: PREMIUM_OPENAI, provider: "openai" }; // fallback if only OpenAI
}

function nanoModel(): { model: string; provider: ModelRoute["provider"] } {
  if (ACTIVE_PROVIDER === "groq") return { model: NANO_GROQ, provider: "groq" };
  if (ACTIVE_PROVIDER === "openrouter") return { model: STANDARD_OR, provider: "openrouter" }; // already free
  return { model: CHEAP_OPENAI, provider: "openai" };
}

function microModel(): { model: string; provider: ModelRoute["provider"] } {
  if (ACTIVE_PROVIDER === "groq") return { model: MICRO_GROQ, provider: "groq" };
  if (ACTIVE_PROVIDER === "openrouter") return { model: STANDARD_OR, provider: "openrouter" };
  return { model: CHEAP_OPENAI, provider: "openai" };
}

// ── Per-role configuration ────────────────────────────────────────────────────

interface RoleConfig {
  tier: "nano" | "micro" | "standard" | "reasoning";
  temperature: number;
  maxTokens: number;
  /** If true, premium users with `complexity: "deep"` are upgraded to PREMIUM_OPENAI. */
  upgradeOnPremiumDeep?: boolean;
}

const ROLE_CONFIG: Record<AgentRole, RoleConfig> = {
  // User-facing chat — highest quality among free, optional premium upgrade
  "growth-agent-chat":       { tier: "standard", temperature: 0.72, maxTokens: 1000, upgradeOnPremiumDeep: true },
  "growth-agent-voice":      { tier: "nano",     temperature: 0.6,  maxTokens: 400 },
  "specialist-chat":         { tier: "standard", temperature: 0.7,  maxTokens: 1000, upgradeOnPremiumDeep: true },

  // Routing / micro-decisions — cheapest, fastest
  "router-classify":         { tier: "nano",     temperature: 0.1,  maxTokens: 300 },
  "parallel-handoff-gate":   { tier: "nano",     temperature: 0.3,  maxTokens: 200 },
  "parallel-handoff-extract":{ tier: "nano",     temperature: 0.3,  maxTokens: 200 },
  "search-router":           { tier: "nano",     temperature: 0.3,  maxTokens: 300 },
  "interview-adapt":         { tier: "nano",     temperature: 0.2,  maxTokens: 10 },
  "knowledge-categorize":    { tier: "nano",     temperature: 0.1,  maxTokens: 20 },

  // Medium reasoning — quality matters but not user-facing live
  "supervisor-rewrite":      { tier: "micro",    temperature: 0.5,  maxTokens: 700 },
  "supervisor-pattern":      { tier: "micro",    temperature: 0.4,  maxTokens: 500 },
  "memory-extract":          { tier: "micro",    temperature: 0.3,  maxTokens: 500 },
  "session-summarize":       { tier: "micro",    temperature: 0.4,  maxTokens: 500 },
  "discovery-enrich":        { tier: "micro",    temperature: 0.4,  maxTokens: 500 },
  "interview-evaluate":      { tier: "micro",    temperature: 0.3,  maxTokens: 400 },
  "interview-generate":      { tier: "micro",    temperature: 0.7,  maxTokens: 600 },
  "knowledge-link":          { tier: "micro",    temperature: 0.3,  maxTokens: 500 },
  "knowledge-suggest":       { tier: "micro",    temperature: 0.5,  maxTokens: 400 },
  "wiki-chat":               { tier: "micro",    temperature: 0.6,  maxTokens: 600 },
  "wiki-suggest":            { tier: "micro",    temperature: 0.6,  maxTokens: 300 },

  // Deep reasoning — DeepSeek R1 free is excellent here
  "chain-of-thought":        { tier: "reasoning", temperature: 0.2, maxTokens: 800, upgradeOnPremiumDeep: true },

  // Security — deep analysis first, targeted fix generation second
  "security-scan":           { tier: "reasoning", temperature: 0.1, maxTokens: 2000 },
  "security-fix":            { tier: "standard",  temperature: 0.2, maxTokens: 1500 },

  // Search orchestrator — solo routing, il LLM pesante è delegato al growth agent
  "search-orchestrate":      { tier: "nano",      temperature: 0.1, maxTokens: 300 },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pick the optimal model for a given agent role.
 *
 * Behaviour:
 *   1. Looks up the role's tier (nano | micro | standard | reasoning).
 *   2. If the user is Premium AND complexity is "deep" AND the role opts in
 *      to upgrades, returns the premium OpenAI model.
 *   3. Otherwise returns the free/cheap default tier model, honouring the
 *      active `AI_PROVIDER`.
 */
export function selectModelFor(role: AgentRole, opts: RouterOptions = {}): ModelRoute {
  const cfg = ROLE_CONFIG[role];
  const { isPremium = false, complexity = "standard", preferGroq } = opts;

  // Hard override: explicit Groq preference (e.g. voice-mode low latency)
  if (preferGroq) {
    return {
      model: MICRO_GROQ,
      provider: "groq",
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      reason: `${role}:groq-preferred`,
    };
  }

  // Premium upgrade path (only when the role opts in)
  if (cfg.upgradeOnPremiumDeep && isPremium && complexity === "deep") {
    return {
      model: PREMIUM_OPENAI,
      provider: "openai",
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      reason: `${role}:premium-deep`,
    };
  }

  // Tier-based default
  const pick =
    cfg.tier === "nano"      ? nanoModel()      :
    cfg.tier === "micro"     ? microModel()     :
    cfg.tier === "reasoning" ? reasoningModel() :
    /* standard */             standardModel();

  return {
    model: pick.model,
    provider: pick.provider,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    reason: `${role}:${cfg.tier}`,
  };
}

/**
 * Convenience: returns just the model string. Useful at call sites that only
 * need to pass `model` to a low-level SDK.
 */
export function modelFor(role: AgentRole, opts: RouterOptions = {}): string {
  return selectModelFor(role, opts).model;
}

// ── Backward-compatible helper ────────────────────────────────────────────────

/**
 * @deprecated use `selectModelFor(role, opts)` instead. Kept so existing
 * callers (and the `selectModel` export in `index.ts`) keep working.
 */
export function selectModel(opts: Required<Pick<RouterOptions, "isPremium" | "complexity">> & Pick<RouterOptions, "preferGroq">): ModelRoute {
  const role: AgentRole =
    opts.complexity === "deep"   ? "specialist-chat" :
    opts.complexity === "simple" ? "router-classify" :
    /* standard */                 "growth-agent-chat";
  return selectModelFor(role, opts);
}
