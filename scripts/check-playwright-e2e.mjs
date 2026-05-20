import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir))) {
    const full = join(dir, entry);
    const stat = statSync(join(root, full));
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(spec|test)\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

function ensureCiAndVercelUseScopedLint() {
  const packageJson = JSON.parse(read("package.json"));
  const scripts = packageJson.scripts ?? {};
  const vercel = JSON.parse(read("vercel.json"));
  const ci = read(".github/workflows/ci.yml");
  const nodeEngine = String(packageJson.engines?.node ?? "");

  if (!nodeEngine.includes(">=20.10.0") || !nodeEngine.includes("<25")) {
    failures.push(
      "package.json: engines.node must support Node 24 with `>=20.10.0 <25`",
    );
  }

  if (
    !/matrix:[\s\S]*?node-version:[\s\S]*?\[\s*["']20\.10\.x["']\s*,\s*["']24\.x["']\s*\]/.test(
      ci,
    )
  ) {
    failures.push(
      ".github/workflows/ci.yml: quality job must run on Node 20.10.x and 24.x",
    );
  }

  const buildCommand = String(vercel.buildCommand ?? "");
  if (!buildCommand.includes("pnpm run quality:required")) {
    failures.push(
      "vercel.json: buildCommand must gate with `pnpm run quality:required`",
    );
  }
  if (/\bpnpm run lint(?:\s|&&|$)/.test(buildCommand)) {
    failures.push(
      "vercel.json: buildCommand must not use the legacy global `pnpm run lint` gate",
    );
  }

  if (
    !/name:\s*Required quality gate[\s\S]*?run:\s*pnpm run quality:required/.test(
      ci,
    )
  ) {
    failures.push(
      ".github/workflows/ci.yml: quality job must run `pnpm run quality:required`",
    );
  }
  if (/run:\s*pnpm run lint(?:\s|$)/.test(ci)) {
    failures.push(
      ".github/workflows/ci.yml: CI must not use the legacy global `pnpm run lint` gate",
    );
  }

  const required = String(scripts["quality:required"] ?? "");
  if (!required.includes("pnpm run lint:ci")) {
    failures.push(
      "package.json: quality:required must include `pnpm run lint:ci`",
    );
  }
  if (!required.includes("pnpm run typecheck")) {
    failures.push(
      "package.json: quality:required must include `pnpm run typecheck`",
    );
  }

  for (const scriptName of ["qa", "check"]) {
    const command = String(scripts[scriptName] ?? "");
    if (scriptName === "qa" && !command.includes("pnpm run quality:required")) {
      failures.push(
        "package.json: qa must delegate to `pnpm run quality:required`",
      );
    }
    if (scriptName === "check" && !command.includes("pnpm run lint:ci")) {
      failures.push(
        `package.json: ${scriptName} must include \`pnpm run lint:ci\``,
      );
    }
    if (
      /\bpnpm run lint(?:\s|&&|$)/.test(command) ||
      command.includes("pnpm run lint:all")
    ) {
      failures.push(
        `package.json: ${scriptName} must not depend on legacy global lint scripts`,
      );
    }
  }
}

ensureCiAndVercelUseScopedLint();

function ensureVitestUsesRunnerConfigLoader() {
  for (const manifest of [
    "apps/server/package.json",
    "packages/ai-server/package.json",
    "apps/web/package.json",
  ]) {
    const packageJson = JSON.parse(read(manifest));
    const scripts = packageJson.scripts ?? {};
    for (const scriptName of ["test", "test:watch", "test:coverage"]) {
      const command = String(scripts[scriptName] ?? "");
      if (!command.includes("--configLoader runner")) {
        failures.push(
          `${manifest}: ${scriptName} must use \`--configLoader runner\` to avoid Windows/esbuild sandbox failures`,
        );
      }
    }
  }
}

ensureVitestUsesRunnerConfigLoader();

function ensureDeploymentMigrationsAreVersioned() {
  for (const workflow of [
    ".github/workflows/staging.yml",
    ".github/workflows/production.yml",
  ]) {
    const text = read(workflow);
    if (/drizzle-kit\s+push/.test(text)) {
      failures.push(
        `${workflow}: staging/production deploys must use versioned migrations, not drizzle-kit push`,
      );
    }
  }

  const production = read(".github/workflows/production.yml");
  if (!/pnpm run db:migrate:dry-run/.test(production)) {
    failures.push(
      ".github/workflows/production.yml: production must run db:migrate:dry-run before db:migrate",
    );
  }
  if (!/pnpm run db:migrate/.test(production)) {
    failures.push(
      ".github/workflows/production.yml: production must run db:migrate",
    );
  }

  const staging = read(".github/workflows/staging.yml");
  if (!/pnpm run db:migrate/.test(staging)) {
    failures.push(".github/workflows/staging.yml: staging must run db:migrate");
  }
}

ensureDeploymentMigrationsAreVersioned();

const config = read("playwright.config.ts");
const retryMatch = config.match(/\bretries\s*:\s*([^,\n]+)/);
if (!retryMatch) {
  failures.push("playwright.config.ts: missing explicit retries: 0");
} else if (retryMatch[1]?.trim() !== "0") {
  failures.push(
    `playwright.config.ts: retries must be 0, found ${retryMatch[1]?.trim()}`,
  );
}

const specs = walk("e2e").filter((file) => {
  const normalized = file.split(sep).join("/");
  return !normalized.startsWith("e2e/mobile/");
});

for (const file of specs) {
  const text = read(file);
  const checks = [
    { pattern: /networkidle/g, label: "networkidle" },
    { pattern: /\b(?:test|describe|it)\.only\s*\(/g, label: ".only(" },
    { pattern: /waitForTimeout\s*\(/g, label: "waitForTimeout(" },
  ];
  for (const check of checks) {
    for (const match of text.matchAll(check.pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      failures.push(
        `${relative(root, join(root, file))}:${line}: forbidden ${check.label}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Playwright determinism guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Playwright determinism guard passed.");
