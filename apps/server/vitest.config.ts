import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    /**
     * Ogni file di test gira in un worker isolato.
     * Per i test di integrazione con DB usiamo threads: false (evita
     * conflitti con ioredis / pg driver in ambienti con worker_threads
     * limitati come alcuni CI).
     */
    pool:        "forks",
    poolOptions: { forks: { singleFork: false } },

    /** Timeout generoso per le query DB (default vitest: 5000ms) */
    testTimeout: 30_000,
    hookTimeout: 30_000,

    /** Pattern: tutti i file *.test.ts / *.spec.ts */
    include: ["src/**/*.{test,spec}.ts"],

    /** Variabili di ambiente per i test */
    env: {
      NODE_ENV:   "test",
      LOG_LEVEL:  "warn",  // silenzia i log durante i test
      JWT_SECRET: "northstar-test-secret-vitest",
    },

    /** Sequenziale all'interno del file (i test DB si aspettano l'un l'altro) */
    sequence: { shuffle: false },
  },
  resolve: {
    alias: {
      "@workspace/db": path.resolve(__dirname, "../../lib/db/src/index.ts"),
    },
  },
});
