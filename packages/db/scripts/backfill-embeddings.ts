import "dotenv/config";
import { db, sectorsTable, professionsTable, growthArticlesTable, newsArticlesTable } from "@workspace/db";
import { generateEmbedding, generateEmbeddingsBatch, buildEmbeddingText } from "@workspace/ai-server/embeddings/generate";
import { logger } from "@workspace/ai-server/logger";
import { sql } from "drizzle-orm";

async function backfillTable<T extends { id: number }>(
  table: any,
  nameColumn: string,
  descColumn: string,
  extraColumns: Array<{ label: string; column: string }>,
  batchSize = 50,
) {
  const rows = await db.select().from(table).where(sql`embedding IS NULL`).limit(1000);
  logger.info({ table: table._.name, count: rows.length }, "backfilling embeddings");

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const texts = batch.map((row: any) =>
      buildEmbeddingText([
        { label: "Nome", value: row[nameColumn] },
        { label: "Descrizione", value: row[descColumn] },
        ...extraColumns.map((c) => ({ label: c.label, value: row[c.column] })),
      ]),
    );

    const items = texts.map((text: string, idx: number) => ({ id: batch[idx].id, text }));
    const embeddings = await generateEmbeddingsBatch(items);

    for (const emb of embeddings) {
      if (emb.embedding) {
        const vecStr = `[${emb.embedding.join(",")}]`;
        await db.execute(sql`UPDATE ${table} SET embedding = ${vecStr}::vector WHERE id = ${emb.id}`);
      }
    }

    logger.info({ table: table._.name, progress: `${Math.min(i + batchSize, rows.length)}/${rows.length}` }, "progress");
  }
}

async function main() {
  logger.info("starting embedding backfill");

  await backfillTable(sectorsTable, "name", "description", [
    { label: "Skills", column: "skills" },
    { label: "Vantaggi", column: "advantages" },
  ]);

  await backfillTable(professionsTable, "title", "description", [
    { label: "Skills", column: "skills" },
    { label: "Modalità lavoro", column: "workModes" },
  ]);

  await backfillTable(growthArticlesTable, "title", "description", [
    { label: "Tags", column: "tags" },
    { label: "Categoria", column: "category" },
  ]);

  await backfillTable(newsArticlesTable, "title", "summary", [
    { label: "Categoria", column: "category" },
    { label: "Settori", column: "sectorNames" },
  ]);

  logger.info("embedding backfill complete");
}

main().catch((err) => {
  logger.error({ err }, "backfill failed");
  process.exit(1);
});
