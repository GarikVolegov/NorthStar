#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function ensureTypescriptEslintRuntimePatch() {
  const distDir = join(
    process.cwd(),
    "node_modules",
    ".pnpm",
    "@typescript-eslint+types@8.59.4",
    "node_modules",
    "@typescript-eslint",
    "types",
    "dist",
  );
  const jsPath = join(distDir, "parser-options.js");
  const dtsPath = join(distDir, "parser-options.d.ts");

  if (existsSync(jsPath) || !existsSync(dtsPath)) return;

  writeFileSync(
    jsPath,
    `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\n`,
  );
}

ensureTypescriptEslintRuntimePatch();

const targets = [
  "packages/ai-server/src/config",
  "packages/ai-server/src/rag/alerts.ts",
  "packages/ai-server/src/metrics.ts",
  "packages/ai-server/src/growth-agent/retriever.ts",
  "packages/ai-server/src/growth-agent/embedder.ts",
  "packages/ai-server/src/growth-agent/memory-manager.ts",
  "packages/ai-server/src/growth-agent/chain-of-thought.ts",
  "packages/ai-server/src/utils.ts",
  "apps/server/src/lib/admin-ops.ts",
  "apps/server/src/lib/admin-ops.test.ts",
  "apps/server/src/lib/jwt-secret.ts",
  "apps/server/src/lib/jwt-secret.test.ts",
  "apps/server/src/lib/rate-limit-redis.ts",
  "apps/server/src/lib/request-context.ts",
  "apps/server/src/lib/type-guards.ts",
  "apps/server/src/app.ts",
  "apps/server/src/middleware/auth.ts",
  "apps/server/src/middleware/auth.test.ts",
  "apps/server/src/middleware/cost-guard.ts",
  "apps/server/src/middleware/rate-limit.ts",
  "apps/server/src/middleware/rate-limit.test.ts",
  "apps/server/src/middleware/check-feature.ts",
  "apps/server/src/middleware/check-feature.test.ts",
  "apps/server/src/routes/admin/growth-queue.ts",
  "apps/server/src/routes/admin/catalogs.ts",
  "apps/server/src/routes/admin/shared/catalogs.ts",
  "apps/server/src/routes/admin/prompts.ts",
  "apps/server/src/routes/admin/shared/agents.ts",
  "apps/server/src/routes/admin/ops.ts",
  "apps/server/src/routes/admin/memory-graph.ts",
  "apps/server/src/routes/admin/quality.ts",
  "apps/server/src/routes/admin/review.ts",
  "apps/server/src/routes/admin/subscriptions.ts",
  "apps/server/src/routes/affiliazione.ts",
  "apps/server/src/routes/affiliate.ts",
  "apps/server/src/routes/ai-wendy.ts",
  "apps/server/src/routes/auth.ts",
  "apps/server/src/routes/calendar.ts",
  "apps/server/src/routes/contact.ts",
  "apps/server/src/routes/cv.ts",
  "apps/server/src/routes/favorites.ts",
  "apps/server/src/routes/friends.ts",
  "apps/server/src/routes/interview.ts",
  "apps/server/src/routes/journey-type.ts",
  "apps/server/src/routes/onboarding.ts",
  "apps/server/src/routes/profile.ts",
  "apps/server/src/routes/rag-admin.ts",
  "apps/server/src/routes/roadmap.ts",
  "apps/server/src/routes/search-track.ts",
  "apps/server/src/routes/social.ts",
  "apps/server/src/routes/subscription.ts",
  "apps/server/src/routes/users.ts",
  "apps/web/src/__tests__/admin-rag-metrics.test.tsx",
  "apps/web/src/lib/apiClient.ts",
  "apps/web/src/lib/clientLogger.ts",
  "apps/web/src/contexts/WendyProvider.tsx",
  "apps/web/src/contexts/WendyProvider.test.tsx",
  "apps/web/src/hooks/useSectors.ts",
  "apps/web/src/hooks/useProfessions.ts",
  "apps/web/src/hooks/useSectorDetail.ts",
  "apps/web/src/components/auth/LoginDialog.tsx",
  "apps/web/src/components/CvSection.tsx",
  "apps/web/src/components/chat/ChatDrawer.tsx",
  "apps/web/src/pages/admin-metriche.tsx",
  "apps/web/src/pages/admin-status.tsx",
  "apps/web/src/pages/admin-agenti.tsx",
  "apps/web/src/hooks/useVoiceChat.ts",
  "apps/web/src/components/admin/console/HomeSection.tsx",
  "apps/web/src/components/admin/console/StatusSection.tsx",
  "apps/web/src/components/admin/console/QualitySection.tsx",
  "apps/web/src/components/admin/console/AgentsSection.tsx",
  "apps/web/src/components/admin/console/sections.test.tsx",
  "apps/web/src/hooks/useGlobalSearch.test.tsx",
  "apps/web/src/contexts/AuthContext.test.tsx",
  "scripts/check-api-fetch.mjs",
  "scripts/check-file-size.mjs",
  "scripts/check-mojibake.mjs",
  "scripts/check-playwright-e2e.mjs",
  "scripts/check-tech-debt.mjs",
  "scripts/check-db-types.mjs",
  "scripts/lint-ci.mjs",
];

const result = spawnSync(
  "pnpm",
  ["exec", "eslint", ...targets, "--max-warnings=0"],
  { stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
