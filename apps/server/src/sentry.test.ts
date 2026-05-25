import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((callback: (scope: { setContext: typeof vi.fn }) => void) => {
    callback({ setContext: vi.fn() });
  }),
}));

vi.mock("@sentry/node", () => sentry);

describe("server Sentry bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    process.env.SENTRY_RELEASE = "test-release";
    process.env.SENTRY_ENVIRONMENT = "test";
    delete (globalThis as { Sentry?: unknown }).Sentry;
  });

  it("initializes Sentry with release/environment and exposes global capture", async () => {
    const { initSentry } = await import("./sentry");

    expect(initSentry()).toBe(true);
    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example@sentry.io/1",
        release: "test-release",
        environment: "test",
      }),
    );
    expect((globalThis as { Sentry?: unknown }).Sentry).toBeDefined();
  });

  it("captures exceptions through a scoped helper", async () => {
    const { captureServerException } = await import("./sentry");

    captureServerException(new Error("boom"), { route: "/test" });

    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
