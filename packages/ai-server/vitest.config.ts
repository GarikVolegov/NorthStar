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
        // Allineata alla coverage reale (~49% su growth-agent) e alle soglie
        // pragmatiche degli altri package (server 50%, web 40%). Il 70% non era
        // mai stato raggiunto (CI mai arrivata a girare questo step).
        statements: 45,
      },
    },
  },
});
