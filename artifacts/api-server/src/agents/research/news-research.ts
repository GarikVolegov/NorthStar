import { tavilySearch, urlHash, normalizeUrl } from "../../lib/tavily";
import { db, newsArticlesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const ITALIAN_DOMAINS = [
  "sole24ore.com",
  "corriere.it",
  "repubblica.it",
  "ansa.it",
  "money.it",
  "linkiesta.it",
  "formiche.net",
  "ilpost.it",
];

const BASE_QUERIES = [
  "mercato del lavoro Italia 2025 trend professioni",
  "nuove opportunità lavoro digitale Italia 2025",
  "stipendi retribuzione professionisti Italia 2025",
  "lavoro futuro intelligenza artificiale Italia 2025",
  "crescita professionale carriera Italia notizie",
];

const SECTOR_QUERY_MAP: Record<string, string> = {
  tecnologia: "lavoro informatica tecnologia digitale Italia",
  "intelligenza artificiale": "AI intelligenza artificiale lavoro Italia 2025",
  sanità: "lavoro sanità medicina infermieri Italia",
  finanza: "lavoro finanza banca investimenti Italia",
  design: "lavoro design UX creativo Italia",
  marketing: "lavoro marketing digitale comunicazione Italia",
  ingegneria: "lavoro ingegneria meccanica industria Italia",
  educazione: "istruzione formazione insegnanti Italia",
  giuridico: "avvocato legge professioni giuridiche Italia",
  commercio: "commercio vendite retail lavoro Italia",
};

export async function runNewsResearch(sectorNames: string[] = []): Promise<{ added: number; checked: number }> {
  const sectorQueries = sectorNames.slice(0, 4).map((s) => {
    const lower = s.toLowerCase();
    const match = Object.entries(SECTOR_QUERY_MAP).find(([k]) => lower.includes(k));
    return match ? match[1] : `lavoro ${s} notizie Italia 2025`;
  });

  const queries = [...BASE_QUERIES.slice(0, 3), ...sectorQueries];

  let added = 0;
  let checked = 0;

  for (const query of queries) {
    try {
      const res = await tavilySearch({
        query,
        topic: "news",
        days: 10,
        maxResults: 5,
        includeAnswer: false,
        includeDomains: ITALIAN_DOMAINS,
      });

      for (const item of res.results) {
        if (!item.url || !item.title || item.content.length < 80) continue;
        checked++;

        const norm = normalizeUrl(item.url);
        const hash = urlHash(norm);

        const existing = await db
          .select({ id: newsArticlesTable.id })
          .from(newsArticlesTable)
          .where(sql`${newsArticlesTable.urlHash} = ${hash}`)
          .limit(1);

        if (existing.length > 0) continue;

        const relatedSectors = sectorNames.filter(
          (s) =>
            item.title.toLowerCase().includes(s.toLowerCase()) ||
            item.content.toLowerCase().includes(s.toLowerCase()),
        );

        let hostname = "web";
        try {
          hostname = new URL(norm).hostname.replace("www.", "");
        } catch {}

        await db
          .insert(newsArticlesTable)
          .values({
            title: item.title.slice(0, 500),
            url: norm,
            urlHash: hash,
            source: hostname,
            summary: item.content.slice(0, 600),
            publishedAt: item.published_date ? new Date(item.published_date) : null,
            sectorNames: relatedSectors.length > 0 ? relatedSectors : ["generale"],
            category: "notizie",
            relevanceScore: item.score ?? 0.5,
            searchQuery: query,
          })
          .onConflictDoNothing();

        added++;
      }
    } catch (err) {
      logger.warn({ err, query }, "News research query failed — skipping");
    }
  }

  logger.info({ added, checked }, "News research run completed");
  return { added, checked };
}
