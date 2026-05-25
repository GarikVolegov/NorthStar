import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      all: false,
      reporter: ["text", "json", "html"],
      include: [
        "src/hooks/useWendyChat.ts",
        "src/hooks/useGlobalSearch.ts",
        "src/contexts/AuthContext.tsx",
        "src/components/admin/console/{HomeSection,StatusSection,QualitySection,AgentsSection,shared,utils}.tsx",
        "src/components/admin/console/utils.ts",
        "src/lib/{api-fetch,storage-keys,utils}.ts",
      ],
      exclude: ["src/**/*.test.*", "src/**/*.spec.*", "src/__tests__/**"],
      thresholds: {
        statements: 40,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "../../docs/attached_assets"),
    },
  },
});
