import { describe, expect, it, vi } from "vitest";
import {
  createPipelineRunFromTemplate,
  confirmPipelineStep,
  cancelPipelineRun,
  type PipelineStore,
  type PipelineRunRecord,
  type PipelineStepExecutor,
  type PipelineStepRecord,
} from "./pipeline-control-room";

describe("pipeline control room", () => {
  it("creates the Research -> Review -> Publish run and blocks at the human review gate", async () => {
    const executeStep: PipelineStepExecutor = async (step) => ({ ok: true, output: { step: step.key } });
    const run = await createPipelineRunFromTemplate({
      templateId: "research-review-publish",
      requestedBy: 7,
      input: { topics: ["focus lavoro"] },
      deps: {
        now: () => new Date("2026-05-27T10:00:00.000Z"),
        store: createMemoryStore(),
        executeStep: vi.fn(executeStep),
      },
    });

    expect(run.status).toBe("blocked");
    expect(run.steps.map((step) => [step.key, step.status])).toEqual([
      ["research_collect", "completed"],
      ["enrich_draft", "completed"],
      ["quality_gate", "completed"],
      ["human_review", "needs_confirmation"],
      ["publish", "pending"],
    ]);
  });

  it("continues dependent steps only after each blocked step is confirmed", async () => {
    const store = createMemoryStore();
    const executeStep = vi.fn<PipelineStepExecutor>(async (step) => ({ ok: true, output: { step: step.key } }));
    const run = await createPipelineRunFromTemplate({
      templateId: "research-review-publish",
      requestedBy: 7,
      input: {},
      deps: { store, executeStep },
    });
    const reviewStep = run.steps.find((step) => step.key === "human_review");
    expect(reviewStep?.status).toBe("needs_confirmation");

    const confirmed = await confirmPipelineStep({
      runId: run.id,
      stepId: reviewStep?.id ?? 0,
      confirmedBy: 7,
      deps: { store, executeStep },
    });

    expect(confirmed.status).toBe("blocked");
    const publishStep = confirmed.steps.find((step) => step.key === "publish");
    expect(publishStep?.status).toBe("needs_confirmation");

    const published = await confirmPipelineStep({
      runId: run.id,
      stepId: publishStep?.id ?? 0,
      confirmedBy: 7,
      deps: { store, executeStep },
    });

    expect(published.status).toBe("completed");
    expect(published.steps.find((step) => step.key === "publish")?.status).toBe("completed");
  });

  it("cancels a blocked run without executing pending publish work", async () => {
    const store = createMemoryStore();
    const executeStep = vi.fn<PipelineStepExecutor>(async (step) => ({ ok: true, output: { step: step.key } }));
    const run = await createPipelineRunFromTemplate({
      templateId: "research-review-publish",
      requestedBy: 7,
      input: {},
      deps: { store, executeStep },
    });

    const cancelled = await cancelPipelineRun({
      runId: run.id,
      cancelledBy: 7,
      deps: { store },
    });

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.steps.find((step) => step.key === "publish")?.status).toBe("cancelled");
  });
});

function createMemoryStore(): PipelineStore {
  let runId = 0;
  let stepId = 0;
  const runs = new Map<number, PipelineRunRecord>();
  const steps = new Map<number, PipelineStepRecord[]>();

  return {
    async createRun(input: Omit<PipelineRunRecord, "id">) {
      const run = { ...input, id: ++runId };
      runs.set(run.id, run);
      return run;
    },
    async createSteps(input: Array<Omit<PipelineStepRecord, "id">>) {
      const created = input.map((step) => ({ ...step, id: ++stepId }));
      for (const step of created) {
        steps.set(step.runId, [...(steps.get(step.runId) ?? []), step]);
      }
      return created;
    },
    async getRun(id: number) {
      const run = runs.get(id);
      if (!run) return null;
      return { run, steps: steps.get(id) ?? [] };
    },
    async updateRun(id: number, patch: Partial<PipelineRunRecord>) {
      const current = runs.get(id);
      if (!current) throw new Error("run missing");
      const next = { ...current, ...patch };
      runs.set(id, next);
      return next;
    },
    async updateStep(id: number, patch: Partial<PipelineStepRecord>) {
      for (const [currentRunId, currentSteps] of steps.entries()) {
        const index = currentSteps.findIndex((step) => step.id === id);
        if (index === -1) continue;
        const current = currentSteps[index];
        if (!current) throw new Error("step missing");
        const next: PipelineStepRecord = { ...current, ...patch };
        currentSteps[index] = next;
        steps.set(currentRunId, currentSteps);
        return next;
      }
      throw new Error("step missing");
    },
  };
}
