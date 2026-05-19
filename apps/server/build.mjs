import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const serverDir = fileURLToPath(new URL(".", import.meta.url));
const entryPoint = fileURLToPath(new URL("./api/index.ts", import.meta.url));

await esbuild.build({
  absWorkingDir: serverDir,
  entryPoints: [entryPoint],
  bundle: true,
  outfile: "api/index.js",
  platform: "node",
  target: "node20",
  format: "esm",
  tsconfig: "tsconfig.json",
  external: ["dotenv", "pg-native"],
  banner: {
    js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
  packages: "bundle",
});

console.log("✅ Build complete: api/index.js");
