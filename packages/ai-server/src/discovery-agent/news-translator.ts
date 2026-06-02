import { isLlmConfigured } from "../client";
import { logger } from "../logger";
import { getLLMForRoute } from "../llm/client";
import { selectModelFor } from "../model-router";

type NewsLocale = "it" | "en" | "es" | "fr" | "de";
type NewsSectionKey = "audience" | "happened" | "why" | "practical";
type NewsTranslationStatus = "translated" | "source" | "failed";

type NewsMeaningSection = {
  key: NewsSectionKey;
  body: string;
  label?: string;
};

type TranslatableNewsMeaning = {
  audience?: string;
  happened?: string;
  whyItMatters?: string;
  practicalNextStep?: string;
  action?: string;
  sections?: NewsMeaningSection[];
};

export type TranslatableNewsItem = {
  id: string;
  title: string;
  preview?: string | null;
  description?: string | null;
  content?: string | null;
  language?: NewsLocale;
  translationStatus?: NewsTranslationStatus;
  meaning?: TranslatableNewsMeaning;
};

type NewsTranslationPayload = {
  title?: string;
  preview?: string;
  description?: string;
  content?: string;
  sections?: Array<{ key?: string; body?: string }>;
};

const LOCALE_NAMES: Record<NewsLocale, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

function clean(value: unknown, max = 2_500): string | undefined {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function readJsonPayload(raw: string): NewsTranslationPayload {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed) as NewsTranslationPayload;
}

function mergeSections(
  original: NewsMeaningSection[] | undefined,
  translated: NewsTranslationPayload["sections"],
): NewsMeaningSection[] | undefined {
  if (!original?.length || !translated?.length) return original;
  const byKey = new Map(translated.map((section) => [section.key, clean(section.body, 800)]));
  return original.map((section) => ({
    ...section,
    body: byKey.get(section.key) ?? section.body,
  }));
}

export async function translateNewsForLocale<T extends TranslatableNewsItem>(item: T, locale: NewsLocale): Promise<T> {
  if (locale === "it") return { ...item, language: locale, translationStatus: "source" };
  const originalLanguage = item.language ?? "it";
  if (!isLlmConfigured()) return { ...item, language: originalLanguage, translationStatus: "source" };

  const sections = item.meaning?.sections?.map((section) => ({
    key: section.key,
    body: section.body,
  })) ?? [];

  try {
    const route = selectModelFor("discovery-enrich");
    const llm = getLLMForRoute(route);
    const raw = await llm.chatOnce([
      {
        role: "system",
        content: [
          "Translate and adapt NorthStar news fields into the requested locale.",
          "Return only valid JSON.",
          "Do not add facts. Do not mention NorthStar as the user.",
          "Keep the four semantic section keys exactly as provided.",
          "The practical section must remain concrete and actionable for the reader.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLocale: locale,
          targetLanguage: LOCALE_NAMES[locale],
          title: item.title,
          preview: item.preview ?? item.description ?? "",
          description: item.description ?? item.preview ?? "",
          content: item.content ?? "",
          sections,
        }),
      },
    ], {
      model: route.model,
      temperature: 0.1,
      maxTokens: 1_200,
    });

    const parsed = readJsonPayload(raw);
    const translatedSections = mergeSections(item.meaning?.sections, parsed.sections);
    const nextMeaning = item.meaning ? {
      ...item.meaning,
      ...(translatedSections ? { sections: translatedSections } : {}),
      ...(translatedSections?.[0]?.body ? { audience: translatedSections[0].body } : {}),
      ...(translatedSections?.[1]?.body ? { happened: translatedSections[1].body } : {}),
      ...(translatedSections?.[2]?.body ? { whyItMatters: translatedSections[2].body } : {}),
      ...(translatedSections?.[3]?.body ? {
        practicalNextStep: translatedSections[3].body,
        action: translatedSections[3].body,
      } : {}),
    } : item.meaning;

    return {
      ...item,
      language: locale,
      translationStatus: "translated",
      title: clean(parsed.title, 500) ?? item.title,
      preview: clean(parsed.preview, 500) ?? item.preview,
      description: clean(parsed.description, 500) ?? item.description,
      content: clean(parsed.content, 5_000) ?? item.content,
      ...(nextMeaning ? { meaning: nextMeaning } : {}),
    };
  } catch (err) {
    logger.warn({ err, articleId: item.id, locale }, "[news-translator] dynamic translation failed");
    return { ...item, language: originalLanguage, translationStatus: "failed" };
  }
}
