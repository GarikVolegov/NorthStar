import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "apps/server/src/route-config.ts");
const outputPath = path.join(root, "docs/api-routes.md");
const source = readFileSync(sourcePath, "utf8");

const routePattern =
  /\{\s*path:\s*"([^"]+)",\s*router:\s*[^,]+,\s*auth:\s*"([^"]+)"(?:,\s*rateLimit:\s*"([^"]+)")?,\s*description:\s*"([^"]+)"\s*\}/g;

const rows = [...source.matchAll(routePattern)]
  .map((match) => ({
    path: match[1] ?? "",
    auth: match[2] ?? "",
    rateLimit: match[3] ?? "global",
    description: match[4] ?? "",
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const markdown = [
  "# API Routes",
  "",
  "Generated from `apps/server/src/route-config.ts`.",
  "",
  "| Path | Auth | Rate limit | Description |",
  "| --- | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| \`${row.path}\` | \`${row.auth}\` | \`${row.rateLimit}\` | ${row.description} |`,
  ),
  "",
].join("\n");

writeFileSync(outputPath, markdown);
console.log(`Generated ${path.relative(root, outputPath)} (${rows.length} routes)`);
