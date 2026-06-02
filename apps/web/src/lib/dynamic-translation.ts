import { apiFetch } from "@/lib/api-fetch";
import { createElement, useEffect, useState } from "react";

type DynamicTranslationInput = {
  locale: string;
  source: string;
  context?: string;
  key?: string;
};

type DynamicTextProps = DynamicTranslationInput & {
  translationKey?: string;
};

type DynamicTranslationResponse = {
  locale: string;
  items?: Array<{
    source?: string;
    text?: string;
    status?: string;
  }>;
};

const memoryCache = new Map<string, string>();
const STORAGE_PREFIX = "northstar:dynamic-i18n:";
const pendingRequests: Array<{
  input: DynamicTranslationInput;
  key: string;
  resolve: (text: string) => void;
}> = [];
let flushScheduled = false;

function normalizeLocale(locale: string): string {
  return locale.toLowerCase().split(/[-_]/)[0] || "it";
}

function cacheKey(input: DynamicTranslationInput): string {
  return [
    normalizeLocale(input.locale),
    input.key ?? "",
    input.context ?? "",
    input.source,
  ].join("\u001f");
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(key)}`;
}

function cacheTranslation(key: string, text: string): void {
  memoryCache.set(key, text);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey(key), text);
  }
}

function requestBodyItem(input: DynamicTranslationInput) {
  return {
    source: input.source,
    ...(input.context ? { context: input.context } : {}),
    ...(input.key ? { key: input.key } : {}),
  };
}

export function clearDynamicTranslationCache(): void {
  memoryCache.clear();
  pendingRequests.splice(0, pendingRequests.length);
  flushScheduled = false;
  if (typeof localStorage === "undefined") return;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}

function enqueueDynamicTranslation(input: DynamicTranslationInput, key: string): Promise<string> {
  return new Promise((resolve) => {
    pendingRequests.push({ input, key, resolve });
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      void flushDynamicTranslations();
    });
  });
}

async function flushDynamicTranslations(): Promise<void> {
  flushScheduled = false;
  const requests = pendingRequests.splice(0, pendingRequests.length);
  const byLocale = new Map<string, typeof requests>();
  for (const request of requests) {
    const locale = normalizeLocale(request.input.locale);
    byLocale.set(locale, [...(byLocale.get(locale) ?? []), request]);
  }

  await Promise.all([...byLocale.entries()].map(async ([locale, batch]) => {
    try {
      const response = await apiFetch("/api/i18n/translate", {
        method: "POST",
        body: JSON.stringify({
          locale,
          items: batch.map((request) => requestBodyItem(request.input)),
        }),
      });

      if (!response.ok) {
        batch.forEach((request) => request.resolve(request.input.source));
        return;
      }

      const payload = await response.json() as DynamicTranslationResponse;
      batch.forEach((request, index) => {
        const translated = payload.items?.[index]?.text?.trim();
        if (!translated) {
          request.resolve(request.input.source);
          return;
        }
        cacheTranslation(request.key, translated);
        request.resolve(translated);
      });
    } catch {
      batch.forEach((request) => request.resolve(request.input.source));
    }
  }));
}

export async function getDynamicTranslation(input: DynamicTranslationInput): Promise<string> {
  const locale = normalizeLocale(input.locale);
  if (locale === "it" || !input.source.trim()) return input.source;

  const key = cacheKey(input);
  const cached = memoryCache.get(key);
  if (cached) return cached;

  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey(key));
  if (stored) {
    memoryCache.set(key, stored);
    return stored;
  }

  return enqueueDynamicTranslation({ ...input, locale }, key);
}

export function useDynamicTranslation(input: DynamicTranslationInput): string {
  const [text, setText] = useState(input.source);

  useEffect(() => {
    let cancelled = false;
    setText(input.source);
    void getDynamicTranslation(input).then((translated) => {
      if (!cancelled) setText(translated);
    });
    return () => {
      cancelled = true;
    };
  }, [input.context, input.key, input.locale, input.source]);

  return text;
}

export function DynamicText({ translationKey, ...input }: DynamicTextProps): ReturnType<typeof createElement> {
  const dynamicInput: DynamicTranslationInput = {
    locale: input.locale,
    source: input.source,
    ...(input.context ? { context: input.context } : {}),
    ...(input.key ?? translationKey ? { key: input.key ?? translationKey } : {}),
  };
  return createElement("span", null, useDynamicTranslation(dynamicInput));
}
