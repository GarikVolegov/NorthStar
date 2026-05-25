import { z } from "zod";

export const AgentStatusSchema = z.enum([
  "idle",
  "thinking",
  "executing",
  "error",
  "offline",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentEventTypeSchema = z.enum([
  "status_change",
  "task_completed",
  "task_failed",
  "system_prompt_updated",
  "paused",
  "resumed",
]);
export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

export const AgentEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: AgentEventTypeSchema,
  description: z.string(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const AgentTaskRefSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  tokensUsed: z.number().int().nullable(),
  modelUsed: z.string().nullable(),
});
export type AgentTaskRef = z.infer<typeof AgentTaskRefSchema>;

export const AgentSnapshotSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  role: z.string(),
  domain: z.string(),
  avatar: z.string(),
  color: z.string(),
  description: z.string(),
  capabilities: z.array(z.string()),
  status: AgentStatusSchema,
  isActive: z.boolean(),
  currentTask: AgentTaskRefSchema.nullable(),
  lastTask: AgentTaskRefSchema.nullable(),
  systemPrompt: z.string(),
  sortOrder: z.number().int(),
  updatedAt: z.string(),
  recentEvents: z.array(AgentEventSchema).default([]),
});
export type AgentSnapshot = z.infer<typeof AgentSnapshotSchema>;

export const RegistryAggregatesSchema = z.object({
  online: z.number().int(),
  executing: z.number().int(),
  tokensTotalToday: z.number().int(),
});
export type RegistryAggregates = z.infer<typeof RegistryAggregatesSchema>;

export const RegistrySnapshotSchema = z.object({
  generatedAt: z.string(),
  agents: z.array(AgentSnapshotSchema),
  aggregates: RegistryAggregatesSchema,
});
export type RegistrySnapshot = z.infer<typeof RegistrySnapshotSchema>;

export const AgentPatchSchema = z
  .object({
    systemPrompt: z.string().min(1).max(8000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (b) => b.systemPrompt !== undefined || b.isActive !== undefined,
    { message: "almeno uno tra systemPrompt e isActive deve essere fornito" },
  );
export type AgentPatch = z.infer<typeof AgentPatchSchema>;
