import { tavilySearch } from "../../lib/tavily";
import { db, growthArticlesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";
import { getPrompt, fillTemplate } from "../../lib/prompt-store.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const VALID_CATEGORIES = ["soft-skills", "carriera", "formazione", "networking", "tecnologia", "autonomo"];
const VALID_DIFFICULTIES = ["base", "intermedio", "avanzato"];

export async function runGrowthResearch(): Promise<{ added: number; attempted: number }> {
  const queriesRaw = await getPrompt("growth-research.queries");
  let GROWTH_QUERIES: string[] = [];
  try {
    GROWTH_QUERIES = JSON.parse(queriesRaw) as string[];
  } catch {
    GROWTH_QUERIES = [
      "come migliorare soft skills professionista italiano 2025",
      "competenze richieste mercato lavoro futuro Italia AI",
      "come trovare lavoro in Italia 2025 consigli pratici",
    ];
  }

  const systemPrompt = await getPrompt("growth-research.system");
  const userTemplate = await getPrompt("growth-research.user-template");

  const shuffled = [...GROWTH_QUERIES].sort(() => Math.random() - 0.5).slice(0, 3);

  let added = 0;
  let attempted = 0;

  for (const query of shuffled) {
    attempted++;
    try {
      const res = await tavilySearch({
        query,
        searchDepth: "advanced",
        maxResults: 5,
        includeAnswer: true,
      });

      if (!res.answer && res.results.length === 0) continue;

      const context = res.results
        .slice(0, 3)
        .map((r) => `Fonte: ${r.url}\n${r.content.slice(0, 400)}`)
        .join("\n\n---\n\n");

      const answerLine = res.answer ? `Sintesi ricerca: ${res.answer}` : "";
      const userContent = fillTemplate(userTemplate, {
        CONTEXT: context,
        ANSWER: answerLine,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      });

      const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, unknown>;
      if (!raw.title || !raw.description || !raw.content) continue;

      const title = String(raw.title).slice(0, 200);
      const slug = slugify(title);

      const existing = await db
        .select({ id: growthArticlesTable.id })
        .from(growthArticlesTable)
        .where(sql`${growthArticlesTable.slug} = ${slug}`)
        .limit(1);

      if (existing.length > 0) {
        logger.debug({ slug }, "Growth article slug already exists — skipping");
        continue;
      }

      const category = VALID_CATEGORIES.includes(String(raw.category)) ? String(raw.category) : "carriera";
      const difficulty = VALID_DIFFICULTIES.includes(String(raw.difficulty)) ? String(raw.difficulty) : "intermedio";
      const readTime = typeof raw.readTimeMinutes === "number" ? Math.min(Math.max(raw.readTimeMinutes, 2), 20) : 6;

      await db
        .insert(growthArticlesTable)
        .values({
          title,
          description: String(raw.description).slice(0, 400),
          slug,
          content: String(raw.content),
          category,
          difficulty,
          readTimeMinutes: readTime,
          status: "published",
        })
        .onConflictDoNothing();

      added++;
    } catch (err) {
      logger.warn({ err, query }, "Growth research query failed — skipping");
    }
  }

  logger.info({ added, attempted }, "Growth research run completed");
  return { added, attempted };
}
