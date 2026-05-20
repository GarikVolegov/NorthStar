import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const schemaDir = join(ROOT, "packages", "db", "src", "schema");
const indexPath = join(schemaDir, "index.ts");

if (!existsSync(schemaDir) || !existsSync(indexPath)) {
  console.error("Drizzle schema index is missing.");
  process.exit(1);
}

const index = readFileSync(indexPath, "utf8");
const schemaFiles = readdirSync(schemaDir)
  .filter(
    (file) =>
      file.endsWith(".ts") && file !== "index.ts" && !file.startsWith("test-"),
  )
  .map((file) => file.replace(/\.ts$/, ""));

const missing = schemaFiles.filter((name) => !index.includes(`./${name}`));
if (missing.length > 0) {
  console.error(
    `Schema files not exported from packages/db/src/schema/index.ts: ${missing.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `DB schema readiness passed: ${schemaFiles.length} schema modules exported.`,
);
