export type AICapability =
  | "memory"
  | "voice"
  | "reasoning"
  | "vision"
  | "embedding";

export interface AIPluginHealth {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

export interface AIPlugin<TInput = unknown, TOutput = unknown> {
  id: string;
  capability: AICapability;
  version: string;
  provider: string;
  init(): Promise<void>;
  health(): Promise<AIPluginHealth>;
  execute(input: TInput): Promise<TOutput>;
}

export interface AIPluginEntry {
  plugin: AIPlugin;
  registeredAt: Date;
  lastHealth?: AIPluginHealth;
  lastHealthAt?: Date;
  active: boolean;
}

export interface AIPluginSnapshot {
  id: string;
  capability: AICapability;
  version: string;
  provider: string;
  active: boolean;
  registeredAt: string;
  lastHealth?: AIPluginHealth;
  lastHealthAt?: string;
}
