import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 10_000,
    setupFiles: [],
    coverage: {
      provider: "v8",
      all: false,
      include: ["src/growth-agent/**/*.ts", "src/utils.ts"],
      exclude: ["src/**/*.test.ts", "src/**/__tests__/**", "src/vendor.d.ts", "dist/**"],
      thresholds: {
        statements: 70,
      },
    },
  },
});
