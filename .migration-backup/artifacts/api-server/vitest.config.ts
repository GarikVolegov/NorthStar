import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/lib/ai/providers/**', 'dist/**'],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
