import { db } from "./index";
import { growthArticlesTable } from "./schema/growthArticles";
import { growthArticleSeeds } from "./seed-crescita-data";

async function seed() {
  console.log("Seeding growth articles...");
  for (const article of growthArticleSeeds) {
    await db.insert(growthArticlesTable).values(article).onConflictDoNothing();
    process.stdout.write(".");
  }
  console.log(`\nDone! Inserted ${growthArticleSeeds.length} articles.`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
