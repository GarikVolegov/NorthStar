import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyNeuralEdgeDecay: vi.fn(),
  dispatchQueuedAgentTasks: vi.fn(),
  executeAgentTask: vi.fn(),
  recoverStaleAgentTasks: vi.fn(),
  refreshCatalog: vi.fn(),
  runCollector: vi.fn(),
  runEnricher: vi.fn(),
  runFastCollector: vi.fn(),
  runGrowthLibraryAgent: vi.fn(),
  runJobPostingsAgent: vi.fn(),
  runNewsPublisher: vi.fn(),
  runSectorDataAgent: vi.fn(),
  rootLoggerInfo: vi.fn(),
  rootLoggerError: vi.fn(),
  rootLoggerWarn: vi.fn(),
  safeRunRoutineScheduler: vi.fn(),
  runBriefingGenerator: vi.fn(),
  runProactiveInsightGenerator: vi.fn(),
  runVaultIngest: vi.fn(),
  runWeakSignalDetector: vi.fn(),
  writeAgentRunSnapshot: vi.fn(),
  notifyAgentTaskFinished: vi.fn(),
}));

vi.mock("@workspace/ai-server", () => ({
  applyNeuralEdgeDecay: mocks.applyNeuralEdgeDecay,
  dispatchQueuedAgentTasks: mocks.dispatchQueuedAgentTasks,
  executeAgentTask: mocks.executeAgentTask,
  recoverStaleAgentTasks: mocks.recoverStaleAgentTasks,
  refreshCatalog: mocks.refreshCatalog,
  runCollector: mocks.runCollector,
  runEnricher: mocks.runEnricher,
  runGrowthLibraryAgent: mocks.runGrowthLibraryAgent,
  runJobPostingsAgent: mocks.runJobPostingsAgent,
  runNewsPublisher: mocks.runNewsPublisher,
  runSectorDataAgent: mocks.runSectorDataAgent,
}));

vi.mock("../middleware/logger", () => ({
  rootLogger: {
    info: mocks.rootLoggerInfo,
    error: mocks.rootLoggerError,
    warn: mocks.rootLoggerWarn,
  },
}));

vi.mock("./fast-collector", () => ({
  runFastCollector: mocks.runFastCollector,
}));

vi.mock("./routine-scheduler", () => ({
  safeRunRoutineScheduler: mocks.safeRunRoutineScheduler,
}));

vi.mock("./briefing-generator", () => ({
  runBriefingGenerator: mocks.runBriefingGenerator,
}));

vi.mock("./proactive-insight-generator", () => ({
  runProactiveInsightGenerator: mocks.runProactiveInsightGenerator,
}));

vi.mock("./vault-ingest", () => ({
  runVaultIngest: mocks.runVaultIngest,
}));

vi.mock("./weak-signal-detector", () => ({
  runWeakSignalDetector: mocks.runWeakSignalDetector,
}));

vi.mock("../lib/agent-runs", () => ({
  writeAgentRunSnapshot: mocks.writeAgentRunSnapshot,
}));

vi.mock("../services/agents/agent-task-notifications", () => ({
  notifyAgentTaskFinished: mocks.notifyAgentTaskFinished,
}));

async function loadCron() {
  vi.resetModules();
  return await import("./cron");
}

describe("cron startup guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.CRON_STARTUP_DELAY_MS = "1000";
    delete process.env.CRON_RUN_ON_STARTUP;
    delete process.env.NEWS_RUN_ON_STARTUP;

    mocks.applyNeuralEdgeDecay.mockResolvedValue({ archivedEdges: 0, decayDays: 30 });
    mocks.dispatchQueuedAgentTasks.mockResolvedValue({ dispatched: 0 });
    mocks.recoverStaleAgentTasks.mockResolvedValue({ recovered: 0, failedTaskIds: [] });
    mocks.refreshCatalog.mockResolvedValue({ candidates: [], source: "test", message: "ok" });
    mocks.runCollector.mockResolvedValue({ totalCollected: 0, totalInserted: 0, bySource: {}, durationMs: 0 });
    mocks.runEnricher.mockResolvedValue({ processed: 0, enriched: 0, filtered: 0, durationMs: 0 });
    mocks.runFastCollector.mockResolvedValue({ totalCollected: 0, totalInserted: 0, bySource: {}, durationMs: 0 });
    mocks.runGrowthLibraryAgent.mockResolvedValue({ curated: 0, generated: 0, gaps: [], durationMs: 0 });
    mocks.runJobPostingsAgent.mockResolvedValue({ inserted: 0 });
    mocks.runNewsPublisher.mockResolvedValue({ transferred: 0, missingCoverage: [], durationMs: 0 });
    mocks.runSectorDataAgent.mockResolvedValue({ sectorsUpdated: 0, professionsUpdated: 0, durationMs: 0 });
    mocks.safeRunRoutineScheduler.mockResolvedValue(undefined);
    mocks.runBriefingGenerator.mockResolvedValue(undefined);
    mocks.runProactiveInsightGenerator.mockResolvedValue({});
    mocks.runVaultIngest.mockResolvedValue({
      scanned: 0,
      ingested: 0,
      skippedRuntimeFalse: 0,
      skippedUnchanged: 0,
      errors: 0,
      durationMs: 0,
    });
    mocks.runWeakSignalDetector.mockResolvedValue({});
    mocks.writeAgentRunSnapshot.mockResolvedValue(undefined);
    mocks.notifyAgentTaskFinished.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_STARTUP_DELAY_MS;
    delete process.env.CRON_RUN_ON_STARTUP;
    delete process.env.NEWS_RUN_ON_STARTUP;
  });

  it("does not run collector or news jobs on development startup unless CRON_RUN_ON_STARTUP is true", async () => {
    const { startCronJobs } = await loadCron();

    startCronJobs();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.runCollector).not.toHaveBeenCalled();
    expect(mocks.runEnricher).not.toHaveBeenCalled();
    expect(mocks.runFastCollector).not.toHaveBeenCalled();
    expect(mocks.runNewsPublisher).not.toHaveBeenCalled();
  });

  it("keeps production startup jobs enabled by default", async () => {
    process.env.NODE_ENV = "production";
    const { startCronJobs } = await loadCron();

    startCronJobs();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.runCollector).toHaveBeenCalledTimes(1);
    expect(mocks.runEnricher).toHaveBeenCalledTimes(1);
    expect(mocks.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(mocks.runFastCollector).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(45_000);

    expect(mocks.runFastCollector).toHaveBeenCalledTimes(1);
    expect(mocks.runNewsPublisher).toHaveBeenCalledTimes(2);
  });
});
