import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "..");
dotenv.config({ path: resolve(__dirname, "../../../.env") });

execSync("drizzle-kit push --config ./drizzle.config.ts", {
  stdio: "inherit",
  cwd: dbDir,
  env: process.env,
});
