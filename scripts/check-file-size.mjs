import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(
  ROOT,
  "docs",
  "quality",
  "file-size-baseline.json",
);
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

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = path.join(dir, entry);
    const rel = relative(fullPath);
    if (rel === "apps/server/api" || rel.includes("/generated/") || rel.endsWith("-data.ts")) continue;
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

function offenders(rootDir, limit) {
  return walk(path.join(ROOT, rootDir))
    .map((file) => ({ file: relative(file), lines: lineCount(file) }))
    .filter((item) => item.lines > limit)
    .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`File-size baseline missing: ${relative(BASELINE_PATH)}`);
    console.error(
      "Create it from the current offender list before enabling the ratchet.",
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

function baselineMap(entries) {
  return new Map(entries.map((entry) => [entry.file, entry.lines]));
}

function compareScope({ scope, current, baseline, limit }) {
  const failures = [];
  const baselineByFile = baselineMap(baseline);

  for (const item of current) {
    const previousLines = baselineByFile.get(item.file);
    if (previousLines == null) {
      failures.push({
        file: item.file,
        lines: item.lines,
        message: `new ${scope} offender over ${limit} lines`,
      });
      continue;
    }
    if (item.lines > previousLines) {
      failures.push({
        file: item.file,
        lines: item.lines,
        message: `${scope} offender grew by ${item.lines - previousLines} lines`,
      });
    }
  }

  return failures;
}

function printScope(scope, current, baseline) {
  const previous = baselineMap(baseline);
  console.log(`\n${scope} offenders: ${current.length}`);
  for (const item of current.slice(0, 12)) {
    const delta = item.lines - (previous.get(item.file) ?? item.lines);
    const sign = delta > 0 ? "+" : "";
    console.log(
      `  ${String(item.lines).padStart(5)} (${sign}${delta})  ${item.file}`,
    );
  }
}

const current = {
  apps: offenders("apps", APP_LIMIT),
  packages: offenders("packages", PACKAGE_LIMIT),
};
const baseline = loadBaseline();
const baselineOffenders = baseline.offenders ?? {};

const failures = [
  ...compareScope({
    scope: "apps",
    current: current.apps,
    baseline: baselineOffenders.apps ?? [],
    limit: APP_LIMIT,
  }),
  ...compareScope({
    scope: "packages",
    current: current.packages,
    baseline: baselineOffenders.packages ?? [],
    limit: PACKAGE_LIMIT,
  }),
];

printScope("apps", current.apps, baselineOffenders.apps ?? []);
printScope("packages", current.packages, baselineOffenders.packages ?? []);

if (failures.length > 0) {
  console.error("\nFile-size ratchet failed:");
  for (const failure of failures) {
    console.error(`  ${failure.message}: ${failure.lines} ${failure.file}`);
  }
  process.exit(1);
}

console.log("\nFile-size ratchet passed: no new or grown offenders.");
