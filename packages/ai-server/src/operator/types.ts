export type OperatorDecision =
  | "reply_now"
  | "agent_task"
  | "routine"
  | "memory_update"
  | "notification"
  | "noop";

export type OperatorEventStatus = "planned" | "dispatched" | "completed" | "failed";

export type OperatorTargetType =
  | "wendy"
  | "agent_task"
  | "routine"
  | "memory"
  | "notification"
  | "none";

export interface OperatorPlanInput {
  source: string;
  triggerType: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OperatorAction {
  decision: OperatorDecision;
  targetType: OperatorTargetType;
  reason: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface OperatorPlan {
  primaryDecision: OperatorDecision;
  actions: OperatorAction[];
  inputSummary: string;
}

export interface OperatorEventInput {
  userId?: number | null;
  source: string;
  triggerType: string;
  decision: OperatorDecision;
  targetType: OperatorTargetType | (string & {});
  targetId?: string | number | null;
  status: OperatorEventStatus;
  inputSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OperatorEventRecord extends OperatorEventInput {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}
