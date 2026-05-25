import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { logger } from "../logger";
import { recordRagAlertSample, resetRagAlertSamples } from "../rag/alerts";

describe("RAG alerts", () => {
  const captureMessage = vi.fn<(message: string) => void>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T10:00:00.000Z"));
    resetRagAlertSamples();
    vi.clearAllMocks();
    (globalThis as { Sentry?: { captureMessage: typeof captureMessage } }).Sentry = {
      captureMessage,
    };
  });

  afterEach(() => {
    delete (globalThis as { Sentry?: unknown }).Sentry;
    vi.useRealTimers();
    resetRagAlertSamples();
  });

  it("alerts once for high fallback and empty-result rates inside the cooldown", async () => {
    for (let i = 0; i < 20; i++) {
      recordRagAlertSample({ fallback: i < 2, empty: i < 5 });
    }

    await vi.waitFor(() => {
      expect(captureMessage).toHaveBeenCalledTimes(2);
    });
    expect(captureMessage.mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining("fallback_rate"),
      expect.stringContaining("empty_result_rate"),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(2);

    for (let i = 0; i < 20; i++) {
      recordRagAlertSample({ fallback: true, empty: true });
    }

    await Promise.resolve();
    expect(captureMessage).toHaveBeenCalledTimes(2);
  });
});
