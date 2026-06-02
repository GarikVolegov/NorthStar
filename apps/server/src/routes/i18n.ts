import express from "express";
import { translateDynamicUiStrings, type DynamicUiLocale } from "@workspace/ai-server";
import { z } from "zod";

const router = express.Router();

const supportedLocales = new Set<DynamicUiLocale>(["it", "en", "es", "fr", "de"]);

const translateSchema = z.object({
  locale: z.string().min(2).max(12).default("it"),
  items: z.array(z.object({
    source: z.string().min(1).max(500),
    context: z.string().max(300).optional(),
    key: z.string().max(120).optional(),
  })).min(1).max(40),
});

function normalizeLocale(locale: string): DynamicUiLocale {
  const normalized = locale.toLowerCase().split(/[-_]/)[0] as DynamicUiLocale;
  return supportedLocales.has(normalized) ? normalized : "it";
}

router.post("/translate", async (req, res) => {
  const parsed = translateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid translation request",
      code: "VALIDATION_ERROR",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const result = await translateDynamicUiStrings({
    locale: normalizeLocale(parsed.data.locale),
    items: parsed.data.items.map((item) => ({
      source: item.source,
      ...(item.context ? { context: item.context } : {}),
      ...(item.key ? { key: item.key } : {}),
    })),
  });

  res.json(result);
});

export default router;
