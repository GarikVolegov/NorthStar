import { writeFileSync } from "node:fs";

writeFileSync(
  new URL("../api-zod/src/index.ts", import.meta.url),
  "export * from './generated/api';\nexport * from './logo-presets';\n",
);
