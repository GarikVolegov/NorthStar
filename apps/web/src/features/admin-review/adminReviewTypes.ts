import type {
  AgentRun,
  SuggestionStatus,
} from "@/components/admin/console";

export type Suggestion = {
  id: number;
  agentRunId: number | null;
  entityType: string;
  entityName: string;
  payloadJson: Record<string, unknown> | null;
  confidenceScore: number | null;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  agentName?: string | null;
  queuePriority?: string | null;
  queueStatus?: string | null;
};

export type AuditLogEntry = {
  id: number;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

export type DashboardStats = {
  pending: number;
  approved: number;
  rejected: number;
  applied?: number;
  archived: number;
  totalRuns: number;
};

export type SuggestionDetail = {
  suggestion: Suggestion;
  agentRun: AgentRun | null;
  queueItem: { id: number; queueStatus: string; priority: string } | null;
  auditTrail?: Array<{
    id: number;
    actorId: number | null;
    action: string;
    category: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

export type MemoryGraphOverview = {
  generatedAt: string;
  health: {
    nodes: number;
    edges: number;
    candidates: number;
    lowConfidenceEdges: number;
    staleEmbeddings: number;
    orphanNodes: number;
  };
  sourceBreakdown: Array<{ sourceType: string; count: number }>;
  candidateRelations: Array<{
    id: number;
    userId: number;
    sourceId: number;
    targetId: number;
    label: string | null;
    relationType: string;
    confidence: number;
    reason: string | null;
    createdAt: string;
    source: { id: number; title: string; type: string; sourceType: string; confidence: number; status: string } | null;
    target: { id: number; title: string; type: string; sourceType: string; confidence: number; status: string } | null;
  }>;
  controls: Array<{ key: string; label: string; description: string }>;
};

export type CatalogType = "sectors" | "professions" | "education_paths" | "growth_articles";

export type CatalogOverviewItem = {
  type: CatalogType;
  label: string;
  total: number;
  active: number;
  archived: number;
  drafts: number;
};

export type CatalogDraft = {
  id: number;
  catalogType: CatalogType;
  entityId: number | null;
  status: "draft" | "published" | "archived";
  payload: Record<string, unknown>;
  notes: string | null;
  createdBy: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CatalogPreview = {
  title: string;
  subtitle: string;
  description: string;
  url: string;
  badges: string[];
};

export type CatalogEntity = Record<string, unknown>;

export type CatalogResponse = {
  type: CatalogType;
  label: string;
  items: CatalogEntity[];
  drafts: CatalogDraft[];
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type GrowthQueueStatus = "all" | "draft" | "pending" | "published" | "rejected";

export type GrowthArticle = {
  id: number;
  title: string;
  slug: string;
  category: string;
  subcategory: string | null;
  description: string;
  content: string;
  tags: string[];
  difficulty: string;
  status: Exclude<GrowthQueueStatus, "all">;
  readTimeMinutes: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type GrowthArticleForm = {
  title: string;
  slug: string;
  category: string;
  subcategory: string;
  description: string;
  content: string;
  tags: string[] | string;
  difficulty: string;
  readTimeMinutes: number | string;
};

export type GrowthArticlePreview = Record<string, unknown>;

export type GrowthQueueResponse = {
  generatedAt?: string;
  queue: GrowthArticle[];
  stats: {
    draft: number;
    pending: number;
    published: number;
    rejected: number;
    total: number;
  };
};

export type GrowthArticleDetail = {
  article: GrowthArticle;
  preview: GrowthArticlePreview;
  auditTrail: Array<{
    id: number;
    actorId: number | null;
    action: string;
    category: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
};
