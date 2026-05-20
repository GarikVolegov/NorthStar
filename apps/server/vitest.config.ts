import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      all: false,
      reporter: ["text", "json", "html"],
      include: ["src/middleware/**/*.ts", "src/lib/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/dist/**",
        "src/**/*.d.ts",
        "src/lib/tracing.ts",
        "src/lib/rate-limit-redis.ts",
        "src/lib/redis-url.ts",
        "src/middleware/logger.ts",
      ],
      thresholds: {
        statements: 50,
      },
    },
  },
});
