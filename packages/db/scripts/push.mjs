import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../../..");
dotenv.config({ path: resolve(repoRoot, ".env") });
dotenv.config({ path: resolve(repoRoot, ".env.local"), override: true });

execSync("drizzle-kit push --config ./drizzle.config.ts", {
  stdio: "inherit",
  cwd: dbDir,
  env: process.env,
});
