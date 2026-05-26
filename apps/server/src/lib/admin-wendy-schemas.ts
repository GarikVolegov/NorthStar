import { z } from "zod";

const AdminWendyHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(2_000),
});

const AdminWendyCompressedHistorySchema = z.object({
  summary: z.string().max(1_000).optional(),
  recentMessages: z.array(AdminWendyHistoryMessageSchema).max(12),
  totalTurns: z.number().int().min(0).max(500),
});

const CompactRecordSchema = z.record(z.string(), z.unknown());

export const AdminWendyRequestSchema = z.object({
  message: z.string().trim().min(1).max(5_000),
  compressedHistory: AdminWendyCompressedHistorySchema.optional(),
  locale: z.string().max(8).default("it"),
  adminContext: z
    .object({
      section: z.string().trim().min(1).max(80),
      selectedEntity: CompactRecordSchema.optional(),
      filters: CompactRecordSchema.optional(),
      visibleState: CompactRecordSchema.optional(),
    })
    .optional(),
});

export const AdminWendyConfirmRequestSchema = z.object({
  actionToken: z.string().min(20).max(20_000),
  confirmationText: z.string().max(200).optional(),
});

export type AdminWendyRequest = z.infer<typeof AdminWendyRequestSchema>;
export type AdminWendyConfirmRequest = z.infer<typeof AdminWendyConfirmRequestSchema>;
export type AdminWendyRisk = "low" | "medium" | "high";

export interface AdminWendyAction {
  id: string;
  type: string;
  status: "needs_confirmation" | "running" | "executed" | "failed" | "cancelled";
  risk: AdminWendyRisk;
  label: string;
  description: string;
  preview: Array<{ label: string; value: string }>;
  requiresConfirmation: boolean;
  requiresStrongConfirmation: boolean;
  confirmationText?: string;
  actionToken: string;
  payload: Record<string, unknown>;
  sourceTool?: string;
}
