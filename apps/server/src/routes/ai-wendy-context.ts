import {
  buildWendyActivationContext,
  persistActivationTrace,
} from "@workspace/ai-server";
import type { WendyActivationContext, WendyIntent, WendyPageContext } from "@workspace/ai-server";
import type { Logger } from "pino";
import { buildWikiLLMContext } from "../lib/wikillm-context-router";
import { executeWendyToolCall } from "../lib/wendy-tool-executor";

export type WendyPersonalContext = Awaited<ReturnType<typeof buildWikiLLMContext>>;

export const EMPTY_WENDY_PERSONAL_CONTEXT: WendyPersonalContext = {
  context: "",
  contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
  sources: [],
};

// ── Iniezione proattiva del profilo ──────────────────────────────────────────
// Wendy deve "sapere chi è l'utente" senza dipendere dal fatto che un modello
// piccolo decida di chiamare get_user_context. Recuperiamo il profilo reale una
// volta e lo iniettiamo nel prompt in ogni percorso (anche nel quick-action).

type ObjectiveRow = { text?: unknown; progress?: unknown };
type FactRow = { key?: unknown; value?: unknown };
type SectorRow = { name?: unknown };
type UserContextData = {
  journeyType?: unknown;
  topObjectives?: unknown;
  memoryFacts?: unknown;
  preferredSectors?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Costruisce una sezione di contesto coi dati reali del profilo. Ritorna ""
 * quando non c'è nulla di affidabile, così non gonfiamo il prompt a vuoto.
 */
export function buildWendyUserProfileSection(data: UserContextData, locale: string): string {
  const isEnglish = locale.toLowerCase().startsWith("en");
  const journeyType = asString(data.journeyType);
  const objectives = asArray<ObjectiveRow>(data.topObjectives)
    .map((o) => {
      const text = asString(o.text);
      if (!text) return "";
      const progress = asNumber(o.progress);
      return progress !== null ? `"${text}" (${progress}%)` : `"${text}"`;
    })
    .filter(Boolean);
  const sectors = asArray<SectorRow>(data.preferredSectors).map((s) => asString(s.name)).filter(Boolean);
  const facts = asArray<FactRow>(data.memoryFacts)
    .map((f) => {
      const key = asString(f.key);
      const value = asString(f.value);
      return key && value ? `${key}: ${value}` : "";
    })
    .filter(Boolean);

  const hasAnything = journeyType || objectives.length || sectors.length || facts.length;

  const lines: string[] = [];
  if (isEnglish) {
    lines.push("## Who the user is (real account data — do not invent beyond this)");
    if (!hasAnything) {
      return "## Who the user is\nNo saved profile, objectives or sectors yet for this user. Do not invent details about them: if you need more, ask or invite them to complete the test/objectives.";
    }
    if (journeyType) lines.push(`- Journey type: ${journeyType}`);
    if (objectives.length) lines.push(`- Active objectives: ${objectives.join("; ")}`);
    if (sectors.length) lines.push(`- Sectors they follow: ${sectors.join(", ")}`);
    if (facts.length) lines.push(`- What we know about them: ${facts.join("; ")}`);
    lines.push("Personalize with this. For anything else, call the tools (get_user_objectives, get_user_context, get_compass) instead of guessing.");
  } else {
    lines.push("## Chi è l'utente (dati reali dal suo account — non inventare oltre questi)");
    if (!hasAnything) {
      return "## Chi è l'utente\nNon risultano ancora profilo, obiettivi o settori salvati per questo utente. Non inventare dati su di lui/lei: se servono, chiedi o invitalo a completare test e obiettivi.";
    }
    if (journeyType) lines.push(`- Tipo di percorso: ${journeyType}`);
    if (objectives.length) lines.push(`- Obiettivi attivi: ${objectives.join("; ")}`);
    if (sectors.length) lines.push(`- Settori che segue: ${sectors.join(", ")}`);
    if (facts.length) lines.push(`- Cosa sappiamo di lui/lei: ${facts.join("; ")}`);
    lines.push("Personalizza con questi dati. Per il resto usa i tool (get_user_objectives, get_user_context, get_compass) invece di andare a memoria o inventare.");
  }
  return lines.join("\n");
}

async function loadWendyUserProfileSection(
  userId: number,
  locale: string,
  logger: Logger,
  requestId: string,
): Promise<string> {
  try {
    const result = await executeWendyToolCall("get_user_context", {}, userId);
    if (!result.ok) return "";
    return buildWendyUserProfileSection(result.data as UserContextData, locale);
  } catch (err) {
    logger.warn({ err, userId, requestId }, "[ai/wendy] user profile load failed");
    return "";
  }
}

function withProfileSection(
  base: WendyPersonalContext,
  profileSection: string,
): WendyPersonalContext {
  if (!profileSection) return base;
  const prefix = `${profileSection}\n\n`;
  return {
    ...base,
    context: prefix + base.context,
    contexts: {
      ...base.contexts,
      semanticMemory: prefix + base.contexts.semanticMemory,
    },
  };
}

export async function prepareWendyContext(input: {
  effectiveMessage: string;
  intent: WendyIntent;
  locale: string;
  logger: Logger;
  pageContext?: WendyPageContext | undefined;
  requestId: string;
  useQuickActionLightPipeline: boolean;
  userId: number;
  userRole: Parameters<typeof buildWikiLLMContext>[0]["userRole"];
}): Promise<{
  neuralContext: WendyActivationContext | null;
  personalContext: WendyPersonalContext;
}> {
  const {
    effectiveMessage,
    intent,
    locale,
    logger,
    pageContext,
    requestId,
    useQuickActionLightPipeline,
    userId,
    userRole,
  } = input;

  // Il profilo reale dell'utente va iniettato SEMPRE, anche nel percorso leggero
  // quick-action, così Wendy sa chi è l'utente senza dover chiamare un tool.
  if (useQuickActionLightPipeline) {
    logger.debug({ userId, requestId, intent }, "[ai/wendy] using lightweight quick-action path");
    const profileSection = await loadWendyUserProfileSection(userId, locale, logger, requestId);
    return {
      personalContext: withProfileSection(EMPTY_WENDY_PERSONAL_CONTEXT, profileSection),
      neuralContext: null,
    };
  }

  const [personalContextBase, profileSection] = await Promise.all([
    buildWikiLLMContext({
      query: effectiveMessage,
      userId,
      userRole,
      includePersonalMemory: true,
      includeWendyBrain: false,
      graphifyProfile: "auto",
    }).catch((err) => {
      logger.warn({ err, userId, requestId }, "[ai/wendy] context build failed; continuing without personal context");
      return EMPTY_WENDY_PERSONAL_CONTEXT;
    }),
    loadWendyUserProfileSection(userId, locale, logger, requestId),
  ]);
  const personalContext = withProfileSection(personalContextBase, profileSection);

  const neuralContext = await buildWendyActivationContext({
    requestId,
    userId,
    message: effectiveMessage,
    intent,
    domain: null,
    ...(pageContext ? { pageContext } : {}),
  }).catch((err) => {
    logger.warn({ err, userId, requestId }, "[ai/wendy] neural activation failed");
    return null;
  });
  if (neuralContext) await persistActivationTrace(neuralContext);
  return { personalContext, neuralContext };
}
