import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    // ── Desktop ────────────────────────────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Mobile (feat/mobile-pwa-optimization) ──────────────────────────
    //
    // Esegui solo i test mobile con:
    //   pnpm playwright test --project="Mobile Chrome"
    //   pnpm playwright test --project="Mobile Safari"
    //
    // In CI aggiungi MOBILE_TESTS=true per attivare automaticamente.
    ...(process.env.MOBILE_TESTS
      ? [
          {
            name: "Mobile Chrome (Pixel 5)",
            use: { ...devices["Pixel 5"] },
          },
          {
            name: "Mobile Safari (iPhone 12)",
            use: { ...devices["iPhone 12"] },
          },
        ]
      : [
          // Sempre attivi anche senza flag per dev locale
          {
            name: "Mobile Chrome (Pixel 5)",
            use: { ...devices["Pixel 5"] },
          },
          {
            name: "Mobile Safari (iPhone 12)",
            use: { ...devices["iPhone 12"] },
          },
        ]),
  ],
});
