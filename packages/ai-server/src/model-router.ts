import { aiPlugins } from "./plugins/registry";
import { resolveActiveProvider, type LlmProvider } from "./client";
import type { AgentRole, RoleConfig } from "./model-router/policy";

export type RequestComplexity = "simple" | "standard" | "deep";

/**
 * Logical role of the caller. Every agent / task that hits an LLM declares its
 * role here, and the router picks the matching model.
 */
export type { AgentRole } from "./model-router/policy";

export interface RouterOptions {
  isPremium?: boolean;
  complexity?: RequestComplexity;
  /** Force a provider preference — overrides defaults below. */
  preferGroq?: boolean;
  // Context-aware signals (all optional, backward-compatible)
  /** Approximate prompt size in tokens; used to escalate tier when above thresholds. */
  messageTokens?: number;
  /** True if the prompt includes file/image attachments. */
  hasFile?: boolean;
  /** True if multimodal input requires a vision-capable model. */
  requiresVision?: boolean;
  /** True if effective context (system + history + RAG) is expected to be very long. */
  requiresLongContext?: boolean;
  /** Number of prior retries for this turn; >0 escalates the tier. */
  retryCount?: number;
  /** Page or feature surfacing the call; used for optional context-based overrides. */
  pageContext?: string;
}

export interface ModelRoute {
  model: string;
  provider: "openai" | "groq" | "openrouter";
  temperature: number;
  maxTokens: number;
  reason: string;
  tier?: "nano" | "micro" | "standard" | "reasoning";
  fallbackOrder?: Array<{ provider: "openai" | "groq" | "openrouter"; model: string }>;
  /** Set when the route is fulfilled by a registered AIPlugin; consumer should dispatch via the plugin. */
  pluginId?: string;
}

// ── Default model catalogue (env-overridable) ─────────────────────────────────

/**
 * Defaults aim at "free + good enough". Override per role via env, e.g.:
 *   MODEL_ROUTER_CLASSIFY=llama-3.1-8b-instant
 *   MODEL_SPECIALIST_CHAT=deepseek/deepseek-chat-v3-0324:free
 *   MODEL_CHAIN_OF_THOUGHT=deepseek/deepseek-r1:free
 */
const env = (k: string, fallback: string): string => process.env[k]?.trim() || fallback;

// Tier presets — env-overridable. Keep names short for cost-tracking pricing table.
const NANO_GROQ      = env("MODEL_NANO_GROQ",             "llama-3.1-8b-instant");
const MICRO_GROQ     = env("MODEL_MICRO_GROQ",            "llama-3.3-70b-versatile");
const OPENROUTER_DEFAULT = env("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free");
const OPENROUTER_FREE_ROUTER = env("MODEL_OPENROUTER_FREE_ROUTER", OPENROUTER_DEFAULT);
const NANO_OR        = env("MODEL_NANO_OPENROUTER",       OPENROUTER_FREE_ROUTER);
const MICRO_OR       = env("MODEL_MICRO_OPENROUTER",      "meta-llama/llama-3.3-70b-instruct:free");
const STANDARD_OR    = env("MODEL_STANDARD_OPENROUTER",   "deepseek/deepseek-chat-v3-0324:free");
const STANDARD_GROQ  = env("MODEL_STANDARD_GROQ",         "llama-3.3-70b-versatile");
const REASONING_OR   = env("MODEL_REASONING_OPENROUTER",  "deepseek/deepseek-r1:free");
const PRO_STANDARD_OR = env("MODEL_PRO_STANDARD_OPENROUTER", "anthropic/claude-sonnet-4-6");
const PREMIUM_OPENAI = env("MODEL_PREMIUM_OPENAI",        "gpt-4o");
const CHEAP_OPENAI   = env("MODEL_CHEAP_OPENAI",          "gpt-4o-mini");
const ALLOW_PAID_MODELS = process.env.ALLOW_PAID_AI_MODELS === "true";

/**
 * Active backend. If AI_PROVIDER=openrouter we prefer OpenRouter free-tier models
 * for STANDARD/REASONING and fall back to OpenAI naming only when OpenRouter
 * isn't configured. The actual HTTP call goes through llm/client.ts.
 */
function hasUsableKey(value: string | undefined): boolean {
  const k = value?.toLowerCase().trim();
  if (!k) return false;
  return !(k.includes("placeholder") || k.includes("inactive") || k.includes("changeme") || k.startsWith("your_"));
}

function hasGroqKey(): boolean {
  return hasUsableKey(process.env.AI_INTEGRATIONS_GROQ_API_KEY) || hasUsableKey(process.env.GROQ_API_KEY);
}

function hasOpenRouterKey(): boolean {
  return hasUsableKey(process.env.OPENROUTER_API_KEY);
}

function hasOpenAIKey(): boolean {
  return hasUsableKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY) || hasUsableKey(process.env.OPENAI_API_KEY);
}

function enforceFreeOpenRouterModel(model: string) {
  if (ALLOW_PAID_MODELS) return model;
  if (model === OPENROUTER_FREE_ROUTER || model.endsWith(":free")) return model;
  return OPENROUTER_FREE_ROUTER;
}

function explicitProvider(): LlmProvider | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  return explicit === "groq" || explicit === "openrouter" || explicit === "openai"
    ? explicit
    : null;
}

function hasProviderKey(provider: LlmProvider): boolean {
  if (provider === "groq") return hasGroqKey();
  if (provider === "openrouter") return hasOpenRouterKey();
  return hasOpenAIKey();
}

function uniqueProviders(providers: LlmProvider[]): LlmProvider[] {
  return providers.filter((provider, index) => providers.indexOf(provider) === index);
}

function providerOrderForTier(tier: RoleConfig["tier"]): LlmProvider[] {
  const preferred: LlmProvider[] =
    tier === "reasoning" ? ["openrouter", "groq", "openai"] :
    tier === "standard"  ? ["openrouter", "groq", "openai"] :
                            ["groq", "openrouter", "openai"];
  const explicit = explicitProvider();
  if (explicit) return uniqueProviders([explicit, ...preferred.filter(hasProviderKey)]);
  const available = preferred.filter(hasProviderKey);
  return available.length > 0 ? available : ["openai"];
}

function modelForProvider(tier: RoleConfig["tier"], provider: LlmProvider): string {
  if (provider === "groq") {
    if (tier === "nano") return NANO_GROQ;
    if (tier === "standard") return STANDARD_GROQ;
    return MICRO_GROQ;
  }
  if (provider === "openrouter") {
    if (tier === "nano") return enforceFreeOpenRouterModel(NANO_OR);
    if (tier === "micro") return enforceFreeOpenRouterModel(MICRO_OR);
    if (tier === "reasoning") return enforceFreeOpenRouterModel(REASONING_OR);
    return enforceFreeOpenRouterModel(STANDARD_OR);
  }
  return tier === "reasoning" ? PREMIUM_OPENAI : CHEAP_OPENAI;
}

function routeForTier(tier: RoleConfig["tier"]): {
  model: string;
  provider: ModelRoute["provider"];
  fallbackOrder: NonNullable<ModelRoute["fallbackOrder"]>;
} {
  const candidates = providerOrderForTier(tier).map((provider) => ({
    provider,
    model: modelForProvider(tier, provider),
  }));
  const [primary = { provider: "openai" as const, model: modelForProvider(tier, "openai") }, ...fallbackOrder] = candidates;
  return { ...primary, fallbackOrder };
}

// ── Per-role configuration ────────────────────────────────────────────────────

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

// ── Context-aware tier escalation ─────────────────────────────────────────────

const TIER_ORDER: RoleConfig["tier"][] = ["nano", "micro", "standard", "reasoning"];

function tierIndex(tier: RoleConfig["tier"]): number {
  return TIER_ORDER.indexOf(tier);
}

function maxTier(a: RoleConfig["tier"], b: RoleConfig["tier"]): RoleConfig["tier"] {
  return tierIndex(a) >= tierIndex(b) ? a : b;
}

interface ContextSignalsResult {
  tier: RoleConfig["tier"];
  reasons: string[];
}

/**
 * Apply context-aware signals to upgrade the base tier of a role.
 * Returns the (possibly upgraded) tier and the reasons that drove the change.
 */
export function applyContextSignals(
  baseTier: RoleConfig["tier"],
  opts: RouterOptions,
): ContextSignalsResult {
  let tier = baseTier;
  const reasons: string[] = [];

  if (opts.messageTokens && opts.messageTokens > 3000) {
    const next = maxTier(tier, "standard");
    if (next !== tier) reasons.push(`long-message(${opts.messageTokens})`);
    tier = next;
  }
  if (opts.requiresLongContext) {
    const next = maxTier(tier, "standard");
    if (next !== tier) reasons.push("long-context");
    tier = next;
  }
  if (opts.retryCount && opts.retryCount > 0) {
    const next = maxTier(tier, "reasoning");
    if (next !== tier) reasons.push(`retry(${opts.retryCount})`);
    tier = next;
  }
  if (opts.hasFile || opts.requiresVision) {
    const next = maxTier(tier, "standard");
    if (next !== tier) reasons.push(opts.requiresVision ? "vision" : "file");
    tier = next;
  }
  return { tier, reasons };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pick the optimal model for a given agent role.
 *
 * Behaviour:
 *   1. Looks up the role's tier (nano | micro | standard | reasoning).
 *   2. Applies context signals (long message, retry, file, vision) which may
 *      escalate the tier.
 *   3. If a registered AIPlugin covers the chosen tier, returns the plugin route.
 *   4. If the user is Premium AND complexity is "deep" AND the role opts in
 *      to upgrades, returns the premium OpenAI model.
 *   5. Otherwise returns the free/cheap default tier model, honouring the
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
      tier: cfg.tier,
      fallbackOrder: hasOpenRouterKey()
        ? [{ provider: "openrouter", model: modelForProvider(cfg.tier, "openrouter") }]
        : [],
    };
  }

  // Context-aware tier upgrade (may stay same)
  const signals = applyContextSignals(cfg.tier, opts);
  const effectiveTier = signals.tier;
  const signalSuffix = signals.reasons.length > 0 ? `+signals[${signals.reasons.join(",")}]` : "";

  // Plugin-aware reasoning override
  if (effectiveTier === "reasoning") {
    const pluginRoute = lookupReasoningPluginRoute(role, cfg);
    if (pluginRoute) {
      return { ...pluginRoute, reason: `${pluginRoute.reason}${signalSuffix}` };
    }
  }

  // Premium upgrade path (only when the role opts in)
  if (cfg.upgradeOnPremiumDeep && isPremium && complexity !== "simple") {
    const activeProvider = resolveActiveProvider();
    if (activeProvider === "openrouter" && ALLOW_PAID_MODELS) {
      // Paid Pro route: Claude Sonnet 4.6 when paid models allowed, else best free
      return { model: PRO_STANDARD_OR, provider: "openrouter", temperature: cfg.temperature, maxTokens: cfg.maxTokens, reason: `${role}:pro-sonnet`, tier: effectiveTier, fallbackOrder: [] };
    }
    if (activeProvider === "openai" && !hasGroqKey() && !hasOpenRouterKey()) {
      return {
        model: PREMIUM_OPENAI,
        provider: "openai",
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        reason: `${role}:premium-deep`,
        tier: effectiveTier,
        fallbackOrder: [],
      };
    }
    const freePremiumRoute = routeForTier("reasoning");
    return {
      model: freePremiumRoute.model,
      provider: freePremiumRoute.provider,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      reason: `${role}:premium-free-reasoning`,
      tier: "reasoning",
      fallbackOrder: freePremiumRoute.fallbackOrder,
    };
  }

  // Tier-based default (uses effectiveTier from context signals)
  const pick = routeForTier(effectiveTier);

  return {
    model: pick.model,
    provider: pick.provider,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    reason: `${role}:${effectiveTier}${signalSuffix}`,
    tier: effectiveTier,
    fallbackOrder: pick.fallbackOrder,
  };
}

// ── Plugin-aware reasoning lookup ─────────────────────────────────────────────

function lookupReasoningPluginRoute(role: AgentRole, cfg: RoleConfig): ModelRoute | null {
  const plugin = aiPlugins.getBest("reasoning");
  if (!plugin) return null;
  const providerName = plugin.provider;
  // ModelRoute.provider is the HTTP route hint; Anthropic plugins ship their own
  // client, so we report "openrouter" as the closest neutral provider hint.
  const provider: ModelRoute["provider"] =
    providerName === "groq"       ? "groq" :
    providerName === "openrouter" ? "openrouter" :
    providerName === "anthropic"  ? "openrouter" :
    "openai";
  return {
    model: plugin.id,
    provider,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    reason: `${role}:plugin(${plugin.id})`,
    tier: "reasoning",
    fallbackOrder: [],
    pluginId: plugin.id,
  };
}

/**
 * Convenience: returns just the model string. Useful at call sites that only
 * need to pass `model` to a low-level SDK.
 */
export function modelFor(role: AgentRole, opts: RouterOptions = {}): string {
  return selectModelFor(role, opts).model;
}

export function getModelRoutingPolicy() {
  return {
    activeProvider: resolveActiveProvider(),
    allowPaidModels: ALLOW_PAID_MODELS,
    openRouterFreeRouter: OPENROUTER_FREE_ROUTER,
    source: "env + role policy",
    roles: Object.entries(ROLE_CONFIG).map(([role, config]) => ({
      role: role as AgentRole,
      tier: config.tier,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      route: selectModelFor(role as AgentRole, { isPremium: false }),
    })),
  };
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
