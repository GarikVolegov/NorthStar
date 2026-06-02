import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: cannot read JSON (${error.message})`);
    return null;
  }
}

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    failures.push(`${relativePath}: cannot read file (${error.message})`);
    return "";
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const vercel = readJson("vercel.json");
const packageJson = readJson("package.json");
const wrapper = readText("api/[...path].js");
const buildScript = readText("apps/server/build.mjs");
const serverlessEntry = readText("apps/server/api/index.ts");
const gitignore = readText(".gitignore");
const vercelignore = readText(".vercelignore");

assert(vercel?.framework === "vite", 'vercel.json must use framework "vite"');
assert(
  vercel?.outputDirectory === "apps/web/dist/public",
  "vercel.json outputDirectory must be apps/web/dist/public",
);
assert(
  vercel?.installCommand === "pnpm install --frozen-lockfile",
  "vercel.json installCommand must use frozen pnpm install",
);
assert(
  typeof vercel?.buildCommand === "string" &&
    vercel.buildCommand.includes(
      "pnpm --filter @northstar/server exec node build.mjs",
    ) &&
    vercel.buildCommand.includes("pnpm --filter @northstar/web run build"),
  "vercel.json buildCommand must build server bundle and web app",
);
assert(
  Array.isArray(vercel?.rewrites) &&
    vercel.rewrites.some(
      (rewrite) =>
        rewrite.source === "/api/:path*" &&
        rewrite.destination === "/api/[...path]",
    ),
  "vercel.json must rewrite /api/:path* to /api/[...path]",
);

assert(
  wrapper.includes("../apps/server/api/index.js"),
  "api/[...path].js must load apps/server/api/index.js",
);
assert(
  wrapper.includes("maxDuration: 60"),
  "api/[...path].js must set maxDuration to 60 seconds",
);

assert(
  buildScript.includes("./api/index.ts"),
  "apps/server/build.mjs must use apps/server/api/index.ts as entrypoint",
);
assert(
  buildScript.includes('outfile: "api/index.js"'),
  "apps/server/build.mjs must output api/index.js",
);
assert(
  buildScript.includes('platform: "node"'),
  "apps/server/build.mjs must target node platform",
);
assert(
  buildScript.includes('target: "node20"'),
  "apps/server/build.mjs must target node20",
);

assert(
  serverlessEntry.includes('import app from "../src/app"'),
  "apps/server/api/index.ts must import Express app from src/app",
);
assert(
  serverlessEntry.includes("export default app"),
  "apps/server/api/index.ts must default-export Express app",
);
assert(
  !serverlessEntry.includes(".listen("),
  "apps/server/api/index.ts must not start a listener",
);

assert(
  gitignore.includes("apps/server/api/index.js"),
  ".gitignore must ignore generated serverless bundle",
);
assert(
  vercelignore.includes(".env"),
  ".vercelignore must exclude local env files",
);
assert(
  packageJson?.packageManager?.startsWith("pnpm@"),
  "package.json must pin pnpm packageManager",
);

if (failures.length > 0) {
  console.error("[vercel-check] failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[vercel-check] ok");
