import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".vite",
  ".vercel",
  "coverage",
  "test-results",
  "playwright-report",
]);

const APP_LIMIT = 600;
const PACKAGE_LIMIT = 400;
const PACKAGE_EXCEPTION_LIMIT = 3;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const rel = relative(fullPath);
    if (rel === "apps/server/api" || rel.includes("/generated/")) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (CODE_EXTENSIONS.has(path.extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

function lineCount(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

const appFiles = walk(path.join(ROOT, "apps"));
const packageFiles = walk(path.join(ROOT, "packages"));

const appOffenders = appFiles
  .map((file) => ({ file, lines: lineCount(file) }))
  .filter((item) => item.lines > APP_LIMIT)
  .sort((a, b) => b.lines - a.lines);

const packageOffenders = packageFiles
  .map((file) => ({ file, lines: lineCount(file) }))
  .filter((item) => item.lines > PACKAGE_LIMIT)
  .sort((a, b) => b.lines - a.lines);

if (appOffenders.length === 0 && packageOffenders.length <= PACKAGE_EXCEPTION_LIMIT) {
  console.log(
    `File-size audit passed: apps offenders=0, package offenders=${packageOffenders.length}/${PACKAGE_EXCEPTION_LIMIT}.`,
  );
  process.exit(0);
}

console.error("File-size audit failed.");
if (appOffenders.length > 0) {
  console.error(`\napps/ files over ${APP_LIMIT} lines:`);
  for (const item of appOffenders) {
    console.error(`  ${String(item.lines).padStart(5)}  ${relative(item.file)}`);
  }
}

if (packageOffenders.length > PACKAGE_EXCEPTION_LIMIT) {
  console.error(`\npackages/ files over ${PACKAGE_LIMIT} lines (${packageOffenders.length}/${PACKAGE_EXCEPTION_LIMIT} allowed):`);
  for (const item of packageOffenders) {
    console.error(`  ${String(item.lines).padStart(5)}  ${relative(item.file)}`);
  }
}

process.exit(1);
