import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

interface PlannedFile {
  path: string;
  content: string;
}

function toKebab(input: string): string {
  return input
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toPascal(input: string): string {
  return toKebab(input)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function manifestTemplate(feature: string): string {
  const pascal = toPascal(feature);
  return `import type { FeatureManifest } from "@workspace/ai-server";

export const ${pascal}FeatureManifest: FeatureManifest = {
  id: "${feature}",
  name: "${pascal}",
  owner: "full-stack",
  status: "pilot",
  webRoutes: [{ path: "/${feature}", auth: "authenticated", title: "${pascal}", smoke: true }],
  apiRoutes: [
    {
      method: "GET",
      path: "/api/${feature}",
      auth: "authenticated",
      schema: "${pascal}QuerySchema",
      smoke: true,
    },
  ],
  wendyTools: [],
  telemetry: ["${feature}.view"],
  smoke: ["${feature}:view"],
  migrations: [],
  tests: ["apps/server/src/features/${feature}/${feature}.test.ts"],
};
`;
}

function plannedFiles(feature: string): PlannedFile[] {
  const pascal = toPascal(feature);
  return [
    {
      path: `apps/server/src/features/${feature}/schemas.ts`,
      content: `import { z } from "zod";

export const ${pascal}QuerySchema = z.object({});
export type ${pascal}Query = z.infer<typeof ${pascal}QuerySchema>;
`,
    },
    {
      path: `apps/server/src/features/${feature}/service.ts`,
      content: `export interface ${pascal}ServiceResult {
  ok: true;
}

export async function get${pascal}(): Promise<${pascal}ServiceResult> {
  return { ok: true };
}
`,
    },
    {
      path: `apps/server/src/features/${feature}/manifest.ts`,
      content: manifestTemplate(feature),
    },
    {
      path: `apps/web/src/features/${feature}/${feature}Api.ts`,
      content: `import { getJson } from "../../lib/apiClient";

export interface ${pascal}Response {
  ok: true;
}

export function get${pascal}(): Promise<${pascal}Response> {
  return getJson<${pascal}Response>("/api/${feature}");
}
`,
    },
    {
      path: `apps/web/src/features/${feature}/${feature}Types.ts`,
      content: `export interface ${pascal}ViewModel {
  title: string;
}
`,
    },
  ];
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const rawName = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  const json = process.argv.includes("--json");
  if (!rawName) {
    throw new Error("Usage: pnpm run create:feature <name> [--dry-run] [--json]");
  }

  const feature = toKebab(rawName);
  if (!feature) throw new Error(`Invalid feature name: ${rawName}`);

  const files = plannedFiles(feature);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const target = path.resolve(file.path);
    if (await exists(target)) {
      skipped.push(file.path);
      continue;
    }
    created.push(file.path);
    if (!dryRun) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
  }

  const result = { feature, dryRun, created, skipped };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Feature scaffold: ${feature}`);
    console.log(`Created: ${created.length}`);
    for (const file of created) console.log(`  + ${file}`);
    for (const file of skipped) console.log(`  = ${file}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
