import { defineConfig, devices } from "@playwright/test";

import { projectBrowserDevice } from "./e2e/helpers/responsiveDevices";

const WEB_BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const API_BASE_URL = process.env.API_URL ?? "http://localhost:3001";
const MOBILE_SPEC_MATCH = /.*\.mobile\.spec\.ts/;
const TABLET_CRITICAL_SPEC_MATCH = /.*tablet-critical-surfaces\.mobile\.spec\.ts/;
const ENABLE_RESPONSIVE_PROJECTS =
  process.env.PLAYWRIGHT_RESPONSIVE_PROJECTS === "1" || process.env.CI_RESPONSIVE_QA === "1";

process.env.BASE_URL ??= WEB_BASE_URL;
process.env.API_URL ??= API_BASE_URL;
process.env.TEST_API_URL ??= API_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Aumentato per gestire SSE + lazy loading pesante
    actionTimeout: 15_000,
    navigationTimeout: 25_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(ENABLE_RESPONSIVE_PROJECTS
      ? [
          {
            name: "tablet-chromium",
            testMatch: TABLET_CRITICAL_SPEC_MATCH,
            use: projectBrowserDevice(devices["iPad Mini"]),
          },
          {
            name: "mobile-webkit",
            testMatch: MOBILE_SPEC_MATCH,
            use: {
              browserName: "webkit" as const,
              ...projectBrowserDevice(devices["iPhone 12"]),
            },
          },
        ]
      : []),
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "pnpm run dev:e2e",
        url: WEB_BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: "3001",
          VITE_PORT: "5173",
          BASE_URL: WEB_BASE_URL,
          API_URL: API_BASE_URL,
          TEST_API_URL: API_BASE_URL,
        },
      },
});
