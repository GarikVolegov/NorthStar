import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, count, like, sql } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (override || !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, ".env.local"), true);

const apply = process.argv.includes("--apply");
const { db, newsArticlesTable } = await import("@workspace/db");

const placeholderWhere = and(
  like(newsArticlesTable.url, "https://northstar.internal/seed/%"),
  sql`${newsArticlesTable.source} = 'NorthStar'`,
);

const [row] = await db
  .select({ total: count() })
  .from(newsArticlesTable)
  .where(placeholderWhere);

const total = Number(row?.total ?? 0);

if (!apply) {
  console.log(`[dry-run] Placeholder news trovate: ${total}`);
  console.log("Esegui con --apply per eliminarle.");
  process.exit(0);
}

await db.delete(newsArticlesTable).where(placeholderWhere);
console.log(`Placeholder news eliminate: ${total}`);
