/**
 * backfill-embeddings.ts — genera embedding per settori e professioni senza embedding.
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run backfill:embeddings
 */

import "dotenv/config";
import { isNull, eq } from "drizzle-orm";
import { db, sectorsTable, professionsTable } from "@workspace/db";
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 5;

// Usa OpenRouter se configurato, altrimenti OpenAI diretto
const openai = new OpenAI({
  baseURL: process.env.OPENROUTER_API_KEY
    ? (process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1")
    : (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
  apiKey: process.env.OPENROUTER_API_KEY
    ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    ?? "",
  defaultHeaders: process.env.OPENROUTER_API_KEY ? {
    "HTTP-Referer": "https://northstar.app",
    "X-Title": "NorthStar",
  } : undefined,
});

async function embedText(text: string): Promise<number[] | null> {
  try {
    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
    if (!cleaned) return null;
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleaned,
      dimensions: 1536,
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("  ⚠️  Embedding failed:", (err as Error).message?.slice(0, 80));
    return null;
  }
}

async function main() {
  console.log("🔢  Avvio backfill embeddings...");

  // Settori senza embedding
  const sectors = await db
    .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description, skills: sectorsTable.skills })
    .from(sectorsTable)
    .where(isNull(sectorsTable.embedding));

  console.log(`📋  Settori da processare: ${sectors.length}`);
  let sectorsDone = 0;

  for (let i = 0; i < sectors.length; i += BATCH_SIZE) {
    const batch = sectors.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (s) => {
      const text = `Settore: ${s.name}. ${s.description}. Competenze: ${(s.skills as string[]).join(", ")}.`;
      const embedding = await embedText(text);
      if (embedding) {
        await db.update(sectorsTable).set({ embedding: embedding as any }).where(eq(sectorsTable.id, s.id));
        sectorsDone++;
        process.stdout.write(".");
      }
    }));
    // Pausa per rate limit
    if (i + BATCH_SIZE < sectors.length) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\n✅  Settori con embedding: ${sectorsDone}/${sectors.length}`);

  // Professioni senza embedding
  const professions = await db
    .select({ id: professionsTable.id, title: professionsTable.title, sector: professionsTable.sector, description: professionsTable.description, skills: professionsTable.skills })
    .from(professionsTable)
    .where(isNull(professionsTable.embedding));

  console.log(`👔  Professioni da processare: ${professions.length}`);
  let profsDone = 0;

  for (let i = 0; i < professions.length; i += BATCH_SIZE) {
    const batch = professions.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (p) => {
      const text = `Professione: ${p.title}. Settore: ${p.sector}. ${p.description ?? ""}. Competenze: ${(p.skills as string[]).join(", ")}.`;
      const embedding = await embedText(text);
      if (embedding) {
        await db.update(professionsTable).set({ embedding: embedding as any }).where(eq(professionsTable.id, p.id));
        profsDone++;
        process.stdout.write(".");
      }
    }));
    if (i + BATCH_SIZE < professions.length) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\n✅  Professioni con embedding: ${profsDone}/${professions.length}`);

  console.log("\n🎉  Backfill completato!");
}

main().catch((err) => {
  console.error("❌  backfill failed:", err);
  process.exit(1);
});
