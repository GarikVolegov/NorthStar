import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "apps", "web", "src");
const BASELINE = Number(process.env.API_FETCH_DIRECT_BASELINE ?? "0");
const IGNORED = new Set([
  "apps/web/src/lib/api-fetch.ts",
  "apps/web/src/lib/apiClient.ts",
]);

function walk(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [full];
  });
}

const hits = [];
for (const file of walk(SRC_DIR)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (IGNORED.has(rel)) continue;
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (
      /\bfetch\s*\(/.test(line) &&
      /(?:\/api|\bapi\/|\$\{BASE\}api|\$\{base\}api)/.test(line)
    ) {
      hits.push(`${rel}:${index + 1}`);
    }
  });
}

if (hits.length > BASELINE) {
  console.error(
    `Direct frontend API fetch calls increased: ${hits.length}/${BASELINE}. Use apps/web/src/lib/apiClient.ts instead.`,
  );
  console.error(hits.slice(BASELINE).join("\n"));
  process.exit(1);
}

console.log(
  `Direct frontend API fetch guard passed: ${hits.length}/${BASELINE}.`,
);
