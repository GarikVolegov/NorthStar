import { createHash } from "node:crypto";
import { isLlmConfigured } from "../client";
import { logger } from "../logger";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";

export const SUPPORTED_DYNAMIC_UI_LOCALES = ["it", "en", "es", "fr", "de"] as const;

export type DynamicUiLocale = (typeof SUPPORTED_DYNAMIC_UI_LOCALES)[number];

export type DynamicUiTranslationItem = {
  source: string;
  context?: string;
  key?: string;
};

export type DynamicUiTranslationStatus = "source" | "translated" | "cache";

export type DynamicUiTranslationResultItem = DynamicUiTranslationItem & {
  text: string;
  status: DynamicUiTranslationStatus;
};

export type DynamicUiTranslationResult = {
  locale: DynamicUiLocale;
  items: DynamicUiTranslationResultItem[];
};

type LlmTranslationPayload = {
  translations?: Array<{ index?: number; text?: string }>;
};

const LOCALE_NAMES: Record<DynamicUiLocale, string> = {
  it: "Italian",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
};

const cache = new Map<string, string>();

function clean(value: unknown, max = 500): string | undefined {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function cacheKey(locale: DynamicUiLocale, item: DynamicUiTranslationItem): string {
  return createHash("sha256")
    .update(JSON.stringify({ locale, source: item.source, context: item.context ?? "", key: item.key ?? "" }))
    .digest("hex");
}

function readJsonPayload(raw: string): LlmTranslationPayload {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed) as LlmTranslationPayload;
}

function sourceResult(item: DynamicUiTranslationItem): DynamicUiTranslationResultItem {
  return { ...item, text: item.source, status: "source" };
}

export function clearDynamicUiTranslationCache(): void {
  cache.clear();
}

export async function translateDynamicUiStrings(input: {
  locale: DynamicUiLocale;
  items: readonly DynamicUiTranslationItem[];
}): Promise<DynamicUiTranslationResult> {
  const normalizedItems: DynamicUiTranslationItem[] = input.items.map((item) => {
    const normalized: DynamicUiTranslationItem = {
      source: clean(item.source, 500) ?? "",
    };
    const context = clean(item.context, 300);
    const key = clean(item.key, 120);
    if (context) normalized.context = context;
    if (key) normalized.key = key;
    return normalized;
  }).filter((item) => item.source);

  if (input.locale === "it" || normalizedItems.length === 0 || !isLlmConfigured()) {
    return {
      locale: input.locale,
      items: normalizedItems.map((item) => sourceResult(item)),
    };
  }

  const results: DynamicUiTranslationResultItem[] = normalizedItems.map((item) => {
    const cached = cache.get(cacheKey(input.locale, item));
    return cached
      ? { ...item, text: cached, status: "cache" }
      : sourceResult(item);
  });
  const missing = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === "source");

  if (missing.length === 0) {
    return { locale: input.locale, items: results };
  }

  try {
    const route = selectModelFor("discovery-enrich");
    const llm = getLLMForRoute(route);
    const raw = await llm.chatOnce([
      {
        role: "system",
        content: [
          "Translate short NorthStar product UI strings.",
          "Return only valid JSON in the form {\"translations\":[{\"index\":0,\"text\":\"...\"}]}",
          "Keep labels concise, natural, and suitable for buttons, menus, errors, and dashboard widgets.",
          "Do not add explanations. Do not include user data.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLocale: input.locale,
          targetLanguage: LOCALE_NAMES[input.locale],
          items: missing.map(({ result }, index) => ({
            index,
            source: result.source,
            context: result.context ?? "",
            key: result.key ?? "",
          })),
        }),
      },
    ], {
      model: route.model,
      temperature: 0,
      maxTokens: 900,
    });

    const parsed = readJsonPayload(raw);
    const translatedByIndex = new Map(
      (parsed.translations ?? [])
        .map((item) => [item.index, clean(item.text, 500)] as const)
        .filter((entry): entry is readonly [number, string] => typeof entry[0] === "number" && !!entry[1]),
    );

    for (const { result, index } of missing) {
      const translated = translatedByIndex.get(missing.findIndex((entry) => entry.index === index));
      if (!translated) continue;
      result.text = translated;
      result.status = "translated";
      cache.set(cacheKey(input.locale, result), translated);
    }
  } catch (err) {
    logger.warn({ err, locale: input.locale }, "[dynamic-ui-translator] translation failed");
  }

  return { locale: input.locale, items: results };
}
