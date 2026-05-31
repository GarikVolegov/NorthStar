export type PromptValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  placeholders: string[];
  unknownPlaceholders: string[];
  missingPlaceholders: string[];
  missingRequiredPlaceholders: string[];
};

export type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  requiredPlaceholders: string[];
  defaultValue: string;
  currentValue: string;
  draftValue: string;
  isOverridden: boolean;
  hasDraft: boolean;
  activeVersionId: number | null;
  activeVersionNumber: number | null;
  draftVersionId: number | null;
  draftVersionNumber: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  validation?: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptVersion = {
  id: number;
  versionNumber: number;
  status: "draft" | "active" | "archived" | "rolled_back";
  value: string;
  notes: string | null;
  createdBy: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  validation?: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptPreview = {
  rendered: string;
  variables: Record<string, string>;
  validation: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptEditorTab = "editor" | "preview" | "versions";

export type AiModelPolicy = {
  activeProvider: string;
  allowPaidModels: boolean;
  openRouterFreeRouter: string;
  roles: Array<{
    role: string;
    tier: string;
    temperature: number;
    maxTokens: number;
    route: {
      model: string;
      provider: string;
      reason: string;
      temperature: number;
      maxTokens: number;
    };
  }>;
};
