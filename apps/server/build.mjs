import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["api/index.ts"],
  bundle: true,
  outfile: "api/index.js",
  platform: "node",
  target: "node20",
  format: "esm",
  tsconfig: "tsconfig.json",
  external: ["pg-native"],
  packages: "bundle",
});

console.log("✅ Build complete: api/index.js");
