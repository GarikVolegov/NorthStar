import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const HISTORY_PATH = join(ROOT, "docs", "quality", "tech-debt-history.json");

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "playwright-report",
  "test-results",
]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (!SOURCE_EXT.test(entry)) return [];
    return [full];
  });
}

function rel(file) {
  return relative(ROOT, file).replace(/\\/g, "/");
}

function isTestOrScript(path) {
  return (
    path.includes(".test.") ||
    path.includes(".spec.") ||
    path.startsWith("scripts/") ||
    path.includes("/__tests__/")
  );
}

function lineHits(files, predicate) {
  const hits = [];
  for (const file of files) {
    const path = rel(file);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (predicate(line, path)) hits.push(`${path}:${index + 1}`);
    });
  }
  return hits;
}

function countByFile(hits) {
  const counts = new Map();
  for (const hit of hits) {
    const [file] = hit.split(":");
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([file, count]) => ({ file, count }));
}

function directApiFetchPredicate(line, path) {
  if (
    path === "apps/web/src/lib/api-fetch.ts" ||
    path === "apps/web/src/lib/apiClient.ts"
  ) {
    return false;
  }
  if (isTestOrScript(path)) return false;
  return (
    /\bfetch\s*\(/.test(line) &&
    /(?:\/api|\bapi\/|\$\{BASE\}api|\$\{base\}api)/.test(line)
  );
}

function isAllowedGlobalLine(line, path) {
  if (path.endsWith("useSTT.ts")) return true;
  if (path.endsWith("types/global.d.ts")) return true;
  if (
    path.endsWith("LoginDialog.tsx") &&
    /declare\s+global|google\??:/.test(line)
  ) {
    return true;
  }
  if (/SpeechRecognition|webkitSpeechRecognition/.test(line)) return true;
  return false;
}

function globalPollutionPredicate(line, path) {
  if (isTestOrScript(path)) return false;
  if (isAllowedGlobalLine(line, path)) return false;
  return /__wendySpeak|\(window\s+as\s+any\)|declare\s+global/.test(line);
}

function hotConsolePredicate(line, path) {
  if (
    ![
      "apps/web/src/hooks/useWendyChat.ts",
      "apps/web/src/contexts/AuthContext.tsx",
    ].includes(path)
  ) {
    return false;
  }
  return /console\.(warn|error|log|info)\s*\(/.test(line);
}

function adminHardcodedColorPredicate(line, path) {
  if (!path.includes("/admin") && !path.endsWith("admin-home.tsx")) {
    return false;
  }
  return /\b(?:bg|text|border)-(?:blue|violet|emerald|amber|rose|red|yellow|green|purple|indigo|cyan|slate)-\d{2,3}\b/.test(
    line,
  );
}

function productionDbAnyPredicate(line, path) {
  if (isTestOrScript(path)) return false;
  if (!path.includes("/routes/")) return false;
  return /\bas\s+any\b/.test(line);
}

const webFiles = walk(join(ROOT, "apps", "web", "src"));
const serverFiles = walk(join(ROOT, "apps", "server", "src"));

const trackedDetails = {
  directApiFetch: lineHits(webFiles, directApiFetchPredicate),
  globalNamespacePollution: lineHits(webFiles, globalPollutionPredicate),
  hotConsole: lineHits(webFiles, hotConsolePredicate),
  adminHardcodedColors: lineHits(webFiles, adminHardcodedColorPredicate),
  productionDbAny: lineHits(serverFiles, productionDbAnyPredicate),
};

const gatedDetails = {
  directApiFetch: trackedDetails.directApiFetch,
  globalNamespacePollution: trackedDetails.globalNamespacePollution,
  hotConsole: trackedDetails.hotConsole,
  adminHardcodedColors: trackedDetails.adminHardcodedColors,
  productionDbAny: trackedDetails.productionDbAny,
};

function counts(details) {
  return Object.fromEntries(
    Object.entries(details).map(([name, hits]) => [name, hits.length]),
  );
}

function normalizeSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    tracked: snapshot.tracked ?? snapshot.metrics ?? {},
    gated: snapshot.gated ?? snapshot.metrics ?? {},
  };
}

if (!existsSync(HISTORY_PATH)) {
  console.error(`Tech debt history missing: ${rel(HISTORY_PATH)}`);
  process.exit(1);
}

const history = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
const latest = Array.isArray(history.sprints) ? history.sprints.at(-1) : null;
const baseline = normalizeSnapshot(latest);
if (!baseline) {
  console.error("Tech debt history has no latest metrics snapshot.");
  process.exit(1);
}

const current = {
  tracked: counts(trackedDetails),
  gated: counts(gatedDetails),
};

let failed = false;
for (const [scope, metrics] of Object.entries(current)) {
  for (const [name, value] of Object.entries(metrics)) {
    const baselineValue = Number(baseline[scope]?.[name] ?? 0);
    if (value > baselineValue) {
      failed = true;
      const details = scope === "tracked" ? trackedDetails : gatedDetails;
      console.error(`${scope}.${name} regressed: ${value}/${baselineValue}`);
      console.error(details[name].slice(baselineValue).join("\n"));
    }
  }
}

const topFiles = Object.fromEntries(
  Object.entries(trackedDetails).map(([name, hits]) => [
    name,
    countByFile(hits),
  ]),
);

console.log(
  JSON.stringify(
    {
      current,
      baseline,
      topFiles,
      sprint: latest.sprint,
    },
    null,
    2,
  ),
);
if (failed) process.exit(1);
