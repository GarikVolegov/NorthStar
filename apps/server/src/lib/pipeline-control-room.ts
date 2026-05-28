import { asc, eq } from "drizzle-orm";
import {
  db,
  pipelineRunsTable,
  pipelineStepsTable,
} from "@workspace/db";
import { runGrowthResearchReviewPipeline } from "../routes/admin/shared/pipelines";

export type PipelineRunStatus = "queued" | "running" | "blocked" | "completed" | "failed" | "cancelled";
export type PipelineStepStatus =
  | "pending"
  | "ready"
  | "running"
  | "needs_confirmation"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";
export type PipelineStepRisk = "low" | "medium" | "high";

export interface PipelineRunRecord {
  id: number;
  templateId: string;
  title: string;
  status: string;
  requestedBy: number | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStepRecord {
  id: number;
  runId: number;
  key: string;
  title: string;
  agentKey: string | null;
  status: string;
  risk: string;
  requiresConfirmation: boolean;
  dependsOn: string[];
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  retryCount: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  confirmedAt: Date | null;
  confirmedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRunDetails {
  id: number;
  templateId: string;
  title: string;
  status: PipelineRunStatus;
  requestedBy: number | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: PipelineStepDetails[];
}

export interface PipelineStepDetails extends Omit<PipelineStepRecord, "status" | "risk"> {
  status: PipelineStepStatus;
  risk: PipelineStepRisk;
}

export interface PipelineStore {
  createRun(input: Omit<PipelineRunRecord, "id">): Promise<PipelineRunRecord>;
  createSteps(input: Array<Omit<PipelineStepRecord, "id">>): Promise<PipelineStepRecord[]>;
  getRun(id: number): Promise<{ run: PipelineRunRecord; steps: PipelineStepRecord[] } | null>;
  updateRun(id: number, patch: Partial<PipelineRunRecord>): Promise<PipelineRunRecord>;
  updateStep(id: number, patch: Partial<PipelineStepRecord>): Promise<PipelineStepRecord>;
}

export type PipelineStepExecutor = (
  step: PipelineStepDetails,
  run: PipelineRunDetails,
) => Promise<{ ok: true; output?: Record<string, unknown> } | { ok: false; error: string; output?: Record<string, unknown> }>;

type Deps = {
  store?: PipelineStore;
  executeStep?: PipelineStepExecutor;
  now?: () => Date;
};

type TemplateStep = {
  key: string;
  title: string;
  agentKey: string | null;
  risk: PipelineStepRisk;
  requiresConfirmation: boolean;
  dependsOn: string[];
};

const RESEARCH_REVIEW_PUBLISH_STEPS: TemplateStep[] = [
  {
    key: "research_collect",
    title: "Research collector",
    agentKey: "growth-research",
    risk: "low",
    requiresConfirmation: false,
    dependsOn: [],
  },
  {
    key: "enrich_draft",
    title: "Draft enrichment",
    agentKey: "enricher",
    risk: "low",
    requiresConfirmation: false,
    dependsOn: ["research_collect"],
  },
  {
    key: "quality_gate",
    title: "Supervisor quality gate",
    agentKey: "supervisor",
    risk: "low",
    requiresConfirmation: false,
    dependsOn: ["enrich_draft"],
  },
  {
    key: "human_review",
    title: "Human review gate",
    agentKey: "wendy",
    risk: "medium",
    requiresConfirmation: true,
    dependsOn: ["quality_gate"],
  },
  {
    key: "publish",
    title: "Publish approved content",
    agentKey: "publisher",
    risk: "medium",
    requiresConfirmation: true,
    dependsOn: ["human_review"],
  },
];

const TEMPLATES = {
  "research-review-publish": {
    title: "Research -> Review -> Publish",
    steps: RESEARCH_REVIEW_PUBLISH_STEPS,
  },
} as const;

function currentStore(deps?: Pick<Deps, "store"> | undefined): PipelineStore {
  return deps?.store ?? dbPipelineStore;
}

function currentNow(deps?: Pick<Deps, "now"> | undefined): Date {
  return deps?.now?.() ?? new Date();
}

function recordToDetails(run: PipelineRunRecord, steps: PipelineStepRecord[]): PipelineRunDetails {
  return {
    ...run,
    status: normalizeRunStatus(run.status),
    steps: steps.map((step) => ({
      ...step,
      status: normalizeStepStatus(step.status),
      risk: normalizeRisk(step.risk),
    })),
  };
}

function normalizeRunStatus(status: string): PipelineRunStatus {
  if (status === "queued" || status === "running" || status === "blocked" || status === "completed" || status === "failed" || status === "cancelled") {
    return status;
  }
  return "failed";
}

function normalizeStepStatus(status: string): PipelineStepStatus {
  if (
    status === "pending" ||
    status === "ready" ||
    status === "running" ||
    status === "needs_confirmation" ||
    status === "completed" ||
    status === "failed" ||
    status === "skipped" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "failed";
}

function normalizeRisk(risk: string): PipelineStepRisk {
  if (risk === "low" || risk === "medium" || risk === "high") return risk;
  return "medium";
}

function isRunnable(step: PipelineStepDetails, steps: PipelineStepDetails[]): boolean {
  if (step.status !== "pending" && step.status !== "ready") return false;
  return step.dependsOn.every((dependency) => steps.find((candidate) => candidate.key === dependency)?.status === "completed");
}

function deriveRunStatus(steps: PipelineStepDetails[]): PipelineRunStatus {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "needs_confirmation")) return "blocked";
  if (steps.every((step) => step.status === "completed" || step.status === "skipped")) return "completed";
  return "running";
}

async function persistRunStatus(
  run: PipelineRunDetails,
  deps: Deps | undefined,
): Promise<PipelineRunDetails> {
  const status = deriveRunStatus(run.steps);
  const now = currentNow(deps);
  const patch: Partial<PipelineRunRecord> = {
    status,
    updatedAt: now,
    ...(run.startedAt ? {} : { startedAt: now }),
    ...(status === "completed" || status === "failed" ? { completedAt: now } : {}),
  };
  await currentStore(deps).updateRun(run.id, patch);
  return getPipelineRunDetails({ runId: run.id, deps });
}

async function processRun(runId: number, deps?: Deps): Promise<PipelineRunDetails> {
  const store = currentStore(deps);
  const executeStep = deps?.executeStep ?? defaultExecuteStep;
  let details = await getPipelineRunDetails({ runId, deps });

  while (true) {
    const runnable = details.steps.find((step) => isRunnable(step, details.steps));
    if (!runnable) return persistRunStatus(details, deps);

    const now = currentNow(deps);
    if (runnable.requiresConfirmation && !runnable.confirmedAt) {
      await store.updateStep(runnable.id, { status: "needs_confirmation", updatedAt: now });
      details = await getPipelineRunDetails({ runId, deps });
      return persistRunStatus(details, deps);
    }

    await store.updateStep(runnable.id, { status: "running", startedAt: now, updatedAt: now });
    details = await getPipelineRunDetails({ runId, deps });
    const runningStep = details.steps.find((step) => step.id === runnable.id) ?? runnable;
    const result = await executeStep(runningStep, details);
    if (!result.ok) {
      await store.updateStep(runnable.id, {
        status: "failed",
        errorMessage: result.error,
        output: result.output ?? null,
        completedAt: currentNow(deps),
        updatedAt: currentNow(deps),
      });
      details = await getPipelineRunDetails({ runId, deps });
      return persistRunStatus(details, deps);
    }

    await store.updateStep(runnable.id, {
      status: "completed",
      output: result.output ?? {},
      completedAt: currentNow(deps),
      updatedAt: currentNow(deps),
    });
    details = await getPipelineRunDetails({ runId, deps });
  }
}

export async function createPipelineRunFromTemplate(input: {
  templateId: keyof typeof TEMPLATES;
  requestedBy: number;
  input?: Record<string, unknown>;
  deps?: Deps;
}): Promise<PipelineRunDetails> {
  const template = TEMPLATES[input.templateId];
  if (!template) throw new Error(`Pipeline template not found: ${input.templateId}`);
  const store = currentStore(input.deps);
  const now = currentNow(input.deps);
  const run = await store.createRun({
    templateId: input.templateId,
    title: template.title,
    status: "queued",
    requestedBy: input.requestedBy,
    input: input.input ?? {},
    output: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await store.createSteps(template.steps.map((step) => ({
    runId: run.id,
    key: step.key,
    title: step.title,
    agentKey: step.agentKey,
    status: step.dependsOn.length ? "pending" : "ready",
    risk: step.risk,
    requiresConfirmation: step.requiresConfirmation,
    dependsOn: step.dependsOn,
    input: input.input ?? {},
    output: null,
    retryCount: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    createdAt: now,
    updatedAt: now,
  })));
  return processRun(run.id, input.deps);
}

export async function getPipelineRunDetails(input: {
  runId: number;
  deps?: Pick<Deps, "store"> | undefined;
}): Promise<PipelineRunDetails> {
  const details = await currentStore(input.deps).getRun(input.runId);
  if (!details) throw new Error("Pipeline run not found");
  return recordToDetails(details.run, details.steps);
}

export async function confirmPipelineStep(input: {
  runId: number;
  stepId: number;
  confirmedBy: number;
  deps?: Deps;
}): Promise<PipelineRunDetails> {
  const details = await getPipelineRunDetails({ runId: input.runId, deps: input.deps });
  const step = details.steps.find((candidate) => candidate.id === input.stepId);
  if (!step) throw new Error("Pipeline step not found");
  if (step.status !== "needs_confirmation") throw new Error("Pipeline step is not waiting for confirmation");
  const now = currentNow(input.deps);
  await currentStore(input.deps).updateStep(input.stepId, {
    status: "ready",
    confirmedAt: now,
    confirmedBy: input.confirmedBy,
    updatedAt: now,
  });
  return processRun(input.runId, input.deps);
}

export async function cancelPipelineRun(input: {
  runId: number;
  cancelledBy: number;
  deps?: Pick<Deps, "store" | "now"> | undefined;
}): Promise<PipelineRunDetails> {
  const details = await getPipelineRunDetails({ runId: input.runId, deps: input.deps });
  const now = currentNow(input.deps);
  await currentStore(input.deps).updateRun(input.runId, {
    status: "cancelled",
    cancelledAt: now,
    updatedAt: now,
    output: { cancelledBy: input.cancelledBy },
  });
  await Promise.all(
    details.steps
      .filter((step) => step.status !== "completed" && step.status !== "failed")
      .map((step) => currentStore(input.deps).updateStep(step.id, { status: "cancelled", updatedAt: now })),
  );
  return getPipelineRunDetails({ runId: input.runId, deps: input.deps });
}

async function defaultExecuteStep(
  step: PipelineStepDetails,
  run: PipelineRunDetails,
): ReturnType<PipelineStepExecutor> {
  if (step.key === "research_collect") {
    const result = await runGrowthResearchReviewPipeline({ body: run.input });
    return { ok: true, output: { runId: result.runId, added: result.added, attempted: result.attempted, warnings: result.warnings } };
  }
  if (step.key === "enrich_draft") {
    return { ok: true, output: { draftState: "pending_review", sourceStep: "research_collect" } };
  }
  if (step.key === "quality_gate") {
    return { ok: true, output: { quality: "requires_human_review", supervisor: "passed_for_review" } };
  }
  if (step.key === "human_review") {
    return { ok: true, output: { reviewedBy: step.confirmedBy, reviewPolicy: "human_approved" } };
  }
  if (step.key === "publish") {
    return { ok: true, output: { published: true, publishPolicy: "confirmed_by_admin" } };
  }
  return { ok: true, output: { completed: true } };
}

function mapRun(row: typeof pipelineRunsTable.$inferSelect): PipelineRunRecord {
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    status: row.status,
    requestedBy: row.requestedBy,
    input: row.inputJson ?? {},
    output: row.outputJson ?? null,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapStep(row: typeof pipelineStepsTable.$inferSelect): PipelineStepRecord {
  return {
    id: row.id,
    runId: row.runId,
    key: row.key,
    title: row.title,
    agentKey: row.agentKey,
    status: row.status,
    risk: row.risk,
    requiresConfirmation: row.requiresConfirmation,
    dependsOn: row.dependsOn ?? [],
    input: row.inputJson ?? {},
    output: row.outputJson ?? null,
    retryCount: row.retryCount,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    confirmedAt: row.confirmedAt,
    confirmedBy: row.confirmedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const dbPipelineStore: PipelineStore = {
  async createRun(input) {
    const [run] = await db.insert(pipelineRunsTable).values({
      templateId: input.templateId,
      title: input.title,
      status: normalizeRunStatus(input.status),
      requestedBy: input.requestedBy,
      inputJson: input.input,
      outputJson: input.output,
      errorMessage: input.errorMessage,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      cancelledAt: input.cancelledAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }).returning();
    if (!run) throw new Error("Pipeline run was not created");
    return mapRun(run);
  },
  async createSteps(input) {
    const rows = await db.insert(pipelineStepsTable).values(input.map((step) => ({
      runId: step.runId,
      key: step.key,
      title: step.title,
      agentKey: step.agentKey,
      status: normalizeStepStatus(step.status),
      risk: normalizeRisk(step.risk),
      requiresConfirmation: step.requiresConfirmation,
      dependsOn: step.dependsOn,
      inputJson: step.input,
      outputJson: step.output,
      retryCount: step.retryCount,
      errorMessage: step.errorMessage,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      confirmedAt: step.confirmedAt,
      confirmedBy: step.confirmedBy,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
    }))).returning();
    return rows.map(mapStep);
  },
  async getRun(id) {
    const [run] = await db.select().from(pipelineRunsTable).where(eq(pipelineRunsTable.id, id)).limit(1);
    if (!run) return null;
    const steps = await db
      .select()
      .from(pipelineStepsTable)
      .where(eq(pipelineStepsTable.runId, id))
      .orderBy(asc(pipelineStepsTable.id));
    return { run: mapRun(run), steps: steps.map(mapStep) };
  },
  async updateRun(id, patch) {
    const [run] = await db.update(pipelineRunsTable).set({
      ...(patch.templateId ? { templateId: patch.templateId } : {}),
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.status ? { status: normalizeRunStatus(patch.status) } : {}),
      ...(patch.requestedBy !== undefined ? { requestedBy: patch.requestedBy } : {}),
      ...(patch.input !== undefined ? { inputJson: patch.input } : {}),
      ...(patch.output !== undefined ? { outputJson: patch.output } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
      ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
      ...(patch.cancelledAt !== undefined ? { cancelledAt: patch.cancelledAt } : {}),
      ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {}),
    }).where(eq(pipelineRunsTable.id, id)).returning();
    if (!run) throw new Error("Pipeline run not found");
    return mapRun(run);
  },
  async updateStep(id, patch) {
    const [step] = await db.update(pipelineStepsTable).set({
      ...(patch.key ? { key: patch.key } : {}),
      ...(patch.title ? { title: patch.title } : {}),
      ...(patch.agentKey !== undefined ? { agentKey: patch.agentKey } : {}),
      ...(patch.status ? { status: normalizeStepStatus(patch.status) } : {}),
      ...(patch.risk ? { risk: normalizeRisk(patch.risk) } : {}),
      ...(patch.requiresConfirmation !== undefined ? { requiresConfirmation: patch.requiresConfirmation } : {}),
      ...(patch.dependsOn !== undefined ? { dependsOn: patch.dependsOn } : {}),
      ...(patch.input !== undefined ? { inputJson: patch.input } : {}),
      ...(patch.output !== undefined ? { outputJson: patch.output } : {}),
      ...(patch.retryCount !== undefined ? { retryCount: patch.retryCount } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
      ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
      ...(patch.confirmedAt !== undefined ? { confirmedAt: patch.confirmedAt } : {}),
      ...(patch.confirmedBy !== undefined ? { confirmedBy: patch.confirmedBy } : {}),
      ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {}),
    }).where(eq(pipelineStepsTable.id, id)).returning();
    if (!step) throw new Error("Pipeline step not found");
    return mapStep(step);
  },
};
