import type { Agent, AgentInput, AgentOutput } from "./types";
import { GrowthInputSchema, GrowthOutputSchema } from "./types";
import { db, growthArticlesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const RIASEC_TO_ITALIAN: Record<string, string> = {
  R: "realistica",
  I: "investigativa",
  A: "artistica",
  S: "sociale",
  E: "imprenditoriale",
  C: "convenzionale",
};

export const growthAgent: Agent = {
  name: "GrowthAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = GrowthInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: { articles: [] },
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { primaryTypes } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const limit = isPremium ? 6 : 3;

      let rawOutput: { articles: unknown[]; personalized: boolean; matchedTypes?: string[] };

      if (!primaryTypes || primaryTypes.length === 0) {
        const articles = await db
          .select()
          .from(growthArticlesTable)
          .where(eq(growthArticlesTable.status, "published"))
          .orderBy(desc(growthArticlesTable.viewCount))
          .limit(limit);
        rawOutput = { articles, personalized: false };
      } else {
        const italianTypes = primaryTypes.map((t) => RIASEC_TO_ITALIAN[t]).filter(Boolean) as string[];

        if (italianTypes.length > 0) {
          const typeArray = `ARRAY[${italianTypes.map((t) => `'${t}'`).join(",")}]::text[]`;
          const articles = await db
            .select()
            .from(growthArticlesTable)
            .where(
              and(
                eq(growthArticlesTable.status, "published"),
                sql`${growthArticlesTable.personalityMatches} && ${sql.raw(typeArray)}`,
              ),
            )
            .orderBy(desc(growthArticlesTable.viewCount))
            .limit(limit);

          if (articles.length > 0) {
            rawOutput = { articles, personalized: true, matchedTypes: italianTypes };
          } else {
            const fallback = await db
              .select()
              .from(growthArticlesTable)
              .where(eq(growthArticlesTable.status, "published"))
              .orderBy(desc(growthArticlesTable.viewCount))
              .limit(limit);
            rawOutput = { articles: fallback, personalized: false };
          }
        } else {
          const articles = await db
            .select()
            .from(growthArticlesTable)
            .where(eq(growthArticlesTable.status, "published"))
            .orderBy(desc(growthArticlesTable.viewCount))
            .limit(limit);
          rawOutput = { articles, personalized: false };
        }
      }

      const outputValidation = GrowthOutputSchema.safeParse(rawOutput);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: true,
          data: rawOutput,
          partial: true,
        };
      }

      return {
        agentName: this.name,
        success: true,
        data: outputValidation.data,
      };
    } catch (err) {
      return {
        agentName: this.name,
        success: false,
        data: { articles: [] },
        error: err instanceof Error ? err.message : String(err),
        partial: true,
      };
    }
  },
};
