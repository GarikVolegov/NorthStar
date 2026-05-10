import type { Agent, AgentInput, AgentOutput } from "./types";
import { NewsInputSchema, NewsOutputSchema } from "./types";
import { getFreeNews, getSectorNews, FREE_CATEGORIES, type FreeCategory } from "../lib/news";

export const newsAgent: Agent = {
  name: "NewsAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = NewsInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: { news: [] },
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { topSectors, categories } = parsed.data;
      const isPremium = input.context.plan === "premium";

      let rawOutput: { news: unknown[]; personalized: boolean; source: string };

      if (!isPremium) {
        const cats = (categories ?? ["general", "technology"]).filter((c) =>
          FREE_CATEGORIES.includes(c as FreeCategory),
        ) as FreeCategory[];
        const safeCats = cats.length > 0 ? cats : (["general"] as FreeCategory[]);
        const news = await getFreeNews(safeCats[0]!, 4);
        rawOutput = { news, personalized: false, source: "general" };
      } else {
        const sectorName = topSectors?.[0]?.sectorName;
        if (sectorName) {
          const news = await getSectorNews(sectorName, 8);
          rawOutput = { news, personalized: true, source: "sector" };
        } else {
          const news = await getFreeNews("technology", 6);
          rawOutput = { news, personalized: false, source: "technology" };
        }
      }

      const outputValidation = NewsOutputSchema.safeParse(rawOutput);
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
        data: { news: [] },
        error: err instanceof Error ? err.message : String(err),
        partial: true,
      };
    }
  },
};
