import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TARGETS = [
  "apps/web/src",
  "apps/server/src",
  "packages/ai-server/src",
  "package.json",
  "apps/web/vite.config.ts",
];
const BASELINE = Number(process.env.MOJIBAKE_BASELINE ?? "67");
const BAD_PATTERN = /Ã.|Â.|â(?:€|†|‡|‚|„|…|œ|ž|Ÿ|¦|§|[^\p{L}\s])/u;

function walk(path) {
  const full = join(ROOT, path);
  const stat = statSync(full);
  if (stat.isFile()) return [full];
  return readdirSync(full).flatMap((entry) => {
    const child = join(full, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) return walk(relative(ROOT, child));
    if (!/\.(ts|tsx|json)$/.test(entry)) return [];
    return [child];
  });
}

const hits = [];
for (const file of TARGETS.flatMap(walk)) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (BAD_PATTERN.test(line)) hits.push(`${rel}:${index + 1}`);
  });
}

if (hits.length > BASELINE) {
  console.error(`Mojibake guard failed: ${hits.length}/${BASELINE} suspicious lines.`);
  console.error(hits.slice(BASELINE).join("\n"));
  process.exit(1);
}

console.log(`Mojibake guard passed: ${hits.length}/${BASELINE} suspicious lines.`);
