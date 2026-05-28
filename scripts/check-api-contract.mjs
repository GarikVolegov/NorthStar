import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "packages/api-spec/openapi.yaml",
  "packages/api-spec/orval.config.ts",
  "packages/api-client-react/src/custom-fetch.ts",
  "packages/api-client-react/src/generated/api.ts",
  "packages/api-zod/src/generated/api.ts",
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) {
    failures.push(`Missing required API contract file: ${file}`);
  }
}

const read = (file) => readFileSync(path.join(root, file), "utf8");

if (failures.length === 0) {
  const orvalConfig = read("packages/api-spec/orval.config.ts");
  const openApi = read("packages/api-spec/openapi.yaml");
  const reactClient = read("packages/api-client-react/src/generated/api.ts");
  const zodClient = read("packages/api-zod/src/generated/api.ts");

  const expectedConfigSnippets = [
    '"packages", "api-client-react", "src"',
    '"packages", "api-zod", "src"',
    'path.resolve(apiClientReactSrc, "custom-fetch.ts")',
  ];

  for (const snippet of expectedConfigSnippets) {
    if (!orvalConfig.includes(snippet)) {
      failures.push(`Orval config is missing expected path/config snippet: ${snippet}`);
    }
  }

  const staleConfigSnippets = [
    '"lib", "api-client-react", "src"',
    '"lib", "api-zod", "src"',
  ];

  for (const snippet of staleConfigSnippets) {
    if (orvalConfig.includes(snippet)) {
      failures.push(`Orval config still points at stale repo path: ${snippet}`);
    }
  }

  const expectedSpecSnippets = [
    "  /healthz:",
    "      operationId: healthCheck",
    "  /calendar/quota:",
    "      operationId: getCalendarQuota",
    "    CalendarQuota:",
  ];

  for (const snippet of expectedSpecSnippets) {
    if (!openApi.includes(snippet)) {
      failures.push(`OpenAPI spec is missing expected endpoint/schema snippet: ${snippet.trim()}`);
    }
  }

  const expectedGeneratedSnippets = [
    { file: "packages/api-client-react/src/generated/api.ts", text: "/api/healthz", body: reactClient },
    { file: "packages/api-client-react/src/generated/api.ts", text: "/api/calendar/quota", body: reactClient },
    { file: "packages/api-zod/src/generated/api.ts", text: "GetCalendarQuotaResponse", body: zodClient },
  ];

  for (const { file, text, body } of expectedGeneratedSnippets) {
    if (!body.includes(text)) {
      failures.push(`Generated client is missing ${text} in ${file}`);
    }
  }
}

if (failures.length > 0) {
  console.error("API contract validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("API contract validation passed.");
