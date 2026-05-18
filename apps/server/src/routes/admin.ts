import { Router, type Request, type Response } from "express";
import {
  affiliationLeadsTable,
  aiRequestLogTable,
  adminCatalogDraftsTable,
  agentPromptVersionsTable,
  agentPromptsTable,
  agentRunsTable,
  agentSuggestionsTable,
  auditLogsTable,
  auditLogTable,
  calendarEventsTable,
  coachSessionsTable,
  contactMessagesTable,
  db,
  checkDatabaseHealth,
  discoveryItemsTable,
  educationPathsTable,
  growthArticlesTable,
  knowledgeEdgesTable,
  knowledgeNodesTable,
  llmUsageTable,
  professionEducationPathsTable,
  professionsTable,
  qualityMetrics,
  responseFeedbackTable,
  reviewQueueTable,
  sectorsTable,
  supervisorLogs,
  subscriptionsTable,
  testSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { register } from "@workspace/ai-server/metrics";
import {
  runCollector,
  runEnricher,
  runNewsPublisher,
  runSectorDataAgent,
  searchWeb,
  generateEmbeddingsBatch,
  buildEmbeddingText,
  getModelRoutingPolicy,
  getMemoryGraphHealth,
  ingestUserMemoryGraph,
} from "@workspace/ai-server";
import { writeAuditLog } from "../middleware/audit";
import { rootLogger } from "../middleware/logger";
import { executionMonitor } from "../lib/execution-monitor";
import { requireAdminAccess } from "../middleware/auth";
import { invalidatePlanCache } from "../middleware/check-feature";
import { getAdminOpsStatus, queueDockerOperation, validateOpsAction } from "../lib/admin-ops";
import { setMaintenanceMode } from "../lib/maintenance-mode";

const router = Router();

type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  requiredPlaceholders?: string[];
  defaultValue: string;
};

const DEFAULT_PROMPTS: AgentPrompt[] = [
  {
    key: "wendy.system",
    label: "Wendy - Sistema",
    description: "Identita operativa dell'assistente principale.",
    placeholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    requiredPlaceholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    defaultValue:
      "Sei Wendy, assistente operativa di NorthStar. Aiuta l'utente a orientarsi, pianificare e usare i tool dell'app in modo concreto.\n\nContesto utente:\n{{USER_CONTEXT}}\n\nTool disponibili:\n{{TOOLS}}",
  },
  {
    key: "knowledge.auto_link",
    label: "Knowledge Graph - Collegamenti",
    description: "Istruzioni per suggerire relazioni semantiche tra nodi.",
    placeholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    requiredPlaceholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    defaultValue:
      "Analizza il nodo sorgente e collega solo candidati con relazione semantica chiara.\n\nNodo sorgente:\n{{SOURCE_NODE}}\n\nCandidati:\n{{CANDIDATES}}\n\nRestituisci etichette brevi e motivazioni verificabili.",
  },
  {
    key: "memory_graph.retrieval",
    label: "Cervello Wendy - Retrieval",
    description: "Regole per usare memoria semantica, grafo e provenance nelle risposte Wendy.",
    placeholders: ["{{QUERY}}", "{{MEMORY_RESULTS}}", "{{RELATIONS}}"],
    requiredPlaceholders: ["{{QUERY}}", "{{MEMORY_RESULTS}}"],
    defaultValue:
      "Usa la memoria personale recuperata solo quando e rilevante per la query.\n\nQuery:\n{{QUERY}}\n\nNodi memoria:\n{{MEMORY_RESULTS}}\n\nRelazioni:\n{{RELATIONS}}\n\nCita le fonti interne, segnala confidence bassa e non inventare dettagli non presenti.",
  },
  {
    key: "growth.research",
    label: "Growth Research",
    description: "Guida per generare contenuti di crescita professionale.",
    placeholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    requiredPlaceholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    defaultValue:
      "Crea contenuti pratici, aggiornati e orientati all'azione.\n\nTema:\n{{TOPIC}}\n\nAudience:\n{{AUDIENCE}}\n\nEvita generalita e includi passi concreti per professionisti e team.",
  },
];

const RUNNABLE_AGENTS = [
  {
    key: "news-research",
    label: "News Research",
    description: "Esegue collector, enrichment e publisher per portare notizie reali nella piattaforma.",
    endpoint: "/admin/research/news/run",
    method: "POST",
    risk: "low",
    requiresInput: true,
  },
  {
    key: "growth-research",
    label: "Growth Research",
    description: "Cerca fonti web/documentali e crea bozze pending nella Coda Crescita.",
    endpoint: "/admin/research/growth/run",
    method: "POST",
    risk: "low",
    requiresInput: false,
  },
  {
    key: "collector",
    label: "Collector Notizie",
    description: "Avvia il collector di notizie configurato nel server AI.",
    endpoint: "/admin/agents/collect",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "enricher",
    label: "Enricher LLM",
    description: "Arricchisce batch di contenuti tramite LLM.",
    endpoint: "/admin/agents/enrich",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "sector-data",
    label: "Sector Data",
    description: "Aggiorna dati mercato per settori e professioni.",
    endpoint: "/admin/agents/sector-data",
    method: "POST",
    risk: "medium",
    requiresInput: false,
  },
  {
    key: "backfill-embeddings",
    label: "Backfill Embeddings",
    description: "Genera embedding mancanti per settori e professioni.",
    endpoint: "/admin/agents/backfill",
    method: "POST",
    risk: "high",
    requiresInput: false,
  },
] as const;

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

router.use(requireAdminAccess);

function adminAuth(_req: Request, _res: Response): boolean {
  return true;
}

type CatalogType = "sectors" | "professions" | "education_paths" | "growth_articles";
type CatalogValidation = {
  ok: boolean;
  fields: Record<string, string>;
  payload: Record<string, any>;
};

const CATALOG_TYPES: CatalogType[] = [
  "sectors",
  "professions",
  "education_paths",
  "growth_articles",
];

const CATALOG_LABELS: Record<CatalogType, string> = {
  sectors: "Settori",
  professions: "Professioni",
  education_paths: "Percorsi",
  growth_articles: "Articoli crescita",
};

const CATALOG_ENUMS = {
  riasec: ["R", "I", "A", "S", "E", "C"],
  automationRisk: ["low", "medium", "high"],
  scalability: ["low", "medium", "high"],
  trend: ["declining", "stable", "growing", "booming"],
  workMode: ["dipendente", "autonomo", "ibrido"],
  educationType: ["universitario", "professionale", "online", "bootcamp"],
  articleStatus: ["draft", "pending", "published", "rejected", "archived"],
  difficulty: ["base", "intermedio", "avanzato"],
} as const;

const GROWTH_QUEUE_STATUSES = ["draft", "pending", "published", "rejected"] as const;
type GrowthQueueStatus = (typeof GROWTH_QUEUE_STATUSES)[number];

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

const SUBSCRIPTION_PLANS = ["free", "pro", "team"] as const;
type AdminSubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
type AdminSubscriptionStatus = "free" | "active" | "expired" | "cancelled";

function isSubscriptionPlan(value: unknown): value is AdminSubscriptionPlan {
  return typeof value === "string" && SUBSCRIPTION_PLANS.includes(value as AdminSubscriptionPlan);
}

function parseAdminValidUntil(value: unknown): Date | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function maskStripeId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length <= 8 ? value : `...${value.slice(-8)}`;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function subscriptionStatus(row: { id?: number | null; validUntil?: Date | null; cancelledAt?: Date | null } | null): AdminSubscriptionStatus {
  if (!row?.id) return row?.cancelledAt ? "cancelled" : "free";
  if (row.cancelledAt) return "cancelled";
  if (row.validUntil && row.validUntil < new Date()) return "expired";
  return "active";
}

function effectivePlan(row: { plan?: string | null; id?: number | null; validUntil?: Date | null; cancelledAt?: Date | null } | null): AdminSubscriptionPlan {
  return subscriptionStatus(row) === "active" && isSubscriptionPlan(row?.plan) ? row.plan : "free";
}

function numberValue(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function integerValue(value: unknown, fallback = 0) {
  const n = Math.round(numberValue(value, fallback));
  return Number.isFinite(n) ? n : fallback;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return fallback;
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item ?? "").trim())
          .filter(Boolean),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
) {
  const normalized = stringValue(value, fallback);
  return allowed.includes(normalized) ? normalized : fallback;
}

function hasInvalidEnumValues(values: string[], allowed: readonly string[]) {
  return values.some((value) => !allowed.includes(value));
}

function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = asRecord(item);
      return {
        step: integerValue(row.step, index + 1),
        title: stringValue(row.title),
        description: stringValue(row.description),
      };
    })
    .filter((step) => step.title && step.description);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeGrowthArticlePayload(input: unknown, current?: typeof growthArticlesTable.$inferSelect) {
  const raw = asRecord(input);
  const title = stringValue(raw.title, current?.title ?? "");
  const fields: Record<string, string> = {};
  const payload = {
    title,
    slug: slugify(stringValue(raw.slug, current?.slug ?? "") || title),
    category: stringValue(raw.category, current?.category ?? ""),
    subcategory: stringValue(raw.subcategory, current?.subcategory ?? "") || null,
    description: stringValue(raw.description, current?.description ?? ""),
    content: stringValue(raw.content, current?.content ?? ""),
    tags: raw.tags === undefined ? current?.tags ?? [] : arrayValue(raw.tags),
    difficulty: enumValue(
      raw.difficulty,
      CATALOG_ENUMS.difficulty,
      CATALOG_ENUMS.difficulty.includes(current?.difficulty as any)
        ? (current?.difficulty as (typeof CATALOG_ENUMS.difficulty)[number])
        : "base",
    ),
    personalityMatches:
      raw.personalityMatches === undefined ? current?.personalityMatches ?? [] : arrayValue(raw.personalityMatches),
    sectorLinks: raw.sectorLinks === undefined ? current?.sectorLinks ?? [] : arrayValue(raw.sectorLinks),
    status: enumValue(raw.status, GROWTH_QUEUE_STATUSES, (current?.status as GrowthQueueStatus) ?? "draft"),
    readTimeMinutes: Math.max(1, integerValue(raw.readTimeMinutes, current?.readTimeMinutes ?? 3)),
  };
  if (!payload.title) fields.title = "Titolo obbligatorio.";
  if (!payload.slug) fields.slug = "Slug obbligatorio.";
  if (!payload.category) fields.category = "Categoria obbligatoria.";
  if (!payload.description) fields.description = "Descrizione obbligatoria.";
  if (!payload.content || payload.content.length < 40) fields.content = "Contenuto obbligatorio, almeno 40 caratteri.";
  if (!GROWTH_QUEUE_STATUSES.includes(payload.status as GrowthQueueStatus)) fields.status = "Status non valido.";
  return { ok: Object.keys(fields).length === 0, fields, payload };
}

function previewGrowthArticle(article: Record<string, any>) {
  return {
    title: article.title,
    slug: article.slug,
    url: article.slug ? `/crescita/articolo/${article.slug}` : "",
    category: article.category,
    subcategory: article.subcategory ?? null,
    description: article.description,
    content: article.content,
    tags: article.tags ?? [],
    difficulty: article.difficulty,
    readTimeMinutes: article.readTimeMinutes,
    status: article.status,
  };
}

async function ensureGrowthArticleSlug(slug: string, articleId: number) {
  if (!slug) return {};
  const [existing] = await db
    .select({ id: growthArticlesTable.id })
    .from(growthArticlesTable)
    .where(and(eq(growthArticlesTable.slug, slug), ne(growthArticlesTable.id, articleId)))
    .limit(1);
  return existing ? { slug: "Slug gia usato da un altro articolo." } : {};
}

async function writeGrowthArticleAudit(
  req: Request,
  action: string,
  articleId: number,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { articleId, workflow: "growth_queue", ...metadata },
  });
}

function validateCatalogPayload(type: CatalogType, input: unknown): CatalogValidation {
  const raw = asRecord(input);
  const fields: Record<string, string> = {};

  if (type === "sectors") {
    const riasecTypes = arrayValue(raw.riasecTypes);
    const workMode = arrayValue(raw.workMode);
    const payload = {
      name: stringValue(raw.name),
      description: stringValue(raw.description),
      riasecTypes,
      skills: arrayValue(raw.skills),
      avgSalaryMin: integerValue(raw.avgSalaryMin),
      avgSalaryMax: integerValue(raw.avgSalaryMax),
      growthRate: numberValue(raw.growthRate),
      automationRisk: enumValue(raw.automationRisk, CATALOG_ENUMS.automationRisk, "medium"),
      scalability: enumValue(raw.scalability, CATALOG_ENUMS.scalability, "medium"),
      trend: enumValue(raw.trend, CATALOG_ENUMS.trend, "stable"),
      timeToAutonomy: stringValue(raw.timeToAutonomy, "6-12 mesi"),
      advantages: arrayValue(raw.advantages),
      disadvantages: arrayValue(raw.disadvantages),
      opportunities: arrayValue(raw.opportunities),
      icon: stringValue(raw.icon, "briefcase"),
      color: stringValue(raw.color, "#6366f1"),
      isActive: booleanValue(raw.isActive, true),
      workMode: workMode.length ? workMode : ["dipendente", "ibrido"],
      autonomyScore: integerValue(raw.autonomyScore, 5),
      stabilityScore: integerValue(raw.stabilityScore, 5),
      clientAcquisitionRequired: booleanValue(raw.clientAcquisitionRequired, false),
      freelanceSteps: normalizeSteps(raw.freelanceSteps),
      dipendentiSteps: normalizeSteps(raw.dipendentiSteps),
      remoteFriendly: booleanValue(raw.remoteFriendly, true),
    };
    if (!payload.name) fields.name = "Nome obbligatorio.";
    if (!payload.description) fields.description = "Descrizione obbligatoria.";
    if (payload.avgSalaryMin < 0) fields.avgSalaryMin = "Il salario minimo deve essere positivo.";
    if (payload.avgSalaryMax < payload.avgSalaryMin) fields.avgSalaryMax = "Il salario massimo deve essere maggiore o uguale al minimo.";
    if (hasInvalidEnumValues(payload.riasecTypes, CATALOG_ENUMS.riasec)) fields.riasecTypes = "RIASEC non valido.";
    if (hasInvalidEnumValues(payload.workMode, CATALOG_ENUMS.workMode)) fields.workMode = "Modalita lavoro non valida.";
    return { ok: Object.keys(fields).length === 0, fields, payload };
  }

  if (type === "professions") {
    const riasecFit = arrayValue(raw.riasecFit);
    const workModes = arrayValue(raw.workModes);
    const payload = {
      title: stringValue(raw.title),
      sector: stringValue(raw.sector),
      sectorId: raw.sectorId == null || raw.sectorId === "" ? null : integerValue(raw.sectorId),
      description: stringValue(raw.description),
      riasecFit,
      skills: arrayValue(raw.skills),
      workModes,
      salaryRange: stringValue(raw.salaryRange),
      growthOutlook: stringValue(raw.growthOutlook),
      autonomyScore: integerValue(raw.autonomyScore, 5),
      stabilityScore: integerValue(raw.stabilityScore, 5),
      isActive: booleanValue(raw.isActive, true),
    };
    if (!payload.title) fields.title = "Titolo obbligatorio.";
    if (!payload.sector && !payload.sectorId) fields.sector = "Settore o sectorId obbligatorio.";
    if (!payload.salaryRange) fields.salaryRange = "Fascia salario obbligatoria.";
    if (!payload.growthOutlook) fields.growthOutlook = "Prospettiva crescita obbligatoria.";
    if (hasInvalidEnumValues(riasecFit, CATALOG_ENUMS.riasec)) fields.riasecFit = "RIASEC non valido.";
    if (hasInvalidEnumValues(workModes, CATALOG_ENUMS.workMode)) fields.workModes = "Modalita lavoro non valida.";
    return { ok: Object.keys(fields).length === 0, fields, payload };
  }

  if (type === "education_paths") {
    const payload = {
      path: stringValue(raw.path),
      type: enumValue(raw.type, CATALOG_ENUMS.educationType, "online"),
      duration: stringValue(raw.duration),
      cost: stringValue(raw.cost),
      steps: arrayValue(raw.steps),
      careerOutcomes: arrayValue(raw.careerOutcomes),
      sectorFit: arrayValue(raw.sectorFit),
      professionIds: Array.isArray(raw.professionIds)
        ? raw.professionIds.map((id) => integerValue(id)).filter((id) => id > 0)
        : [],
      isActive: booleanValue(raw.isActive, true),
    };
    if (!payload.path) fields.path = "Nome percorso obbligatorio.";
    if (!payload.duration) fields.duration = "Durata obbligatoria.";
    if (!payload.cost) fields.cost = "Costo obbligatorio.";
    if (payload.steps.length === 0) fields.steps = "Almeno uno step obbligatorio.";
    if (payload.careerOutcomes.length === 0) fields.careerOutcomes = "Almeno un outcome obbligatorio.";
    return { ok: Object.keys(fields).length === 0, fields, payload };
  }

  const title = stringValue(raw.title);
  const payload = {
    title,
    slug: slugify(stringValue(raw.slug) || title),
    category: stringValue(raw.category),
    subcategory: stringValue(raw.subcategory) || null,
    description: stringValue(raw.description),
    content: stringValue(raw.content),
    tags: arrayValue(raw.tags),
    difficulty: enumValue(raw.difficulty, CATALOG_ENUMS.difficulty, "base"),
    personalityMatches: arrayValue(raw.personalityMatches),
    sectorLinks: arrayValue(raw.sectorLinks),
    status: enumValue(raw.status, CATALOG_ENUMS.articleStatus, "draft"),
    readTimeMinutes: Math.max(1, integerValue(raw.readTimeMinutes, 3)),
  };
  if (!payload.title) fields.title = "Titolo obbligatorio.";
  if (!payload.slug) fields.slug = "Slug obbligatorio.";
  if (!payload.category) fields.category = "Categoria obbligatoria.";
  if (!payload.description) fields.description = "Descrizione obbligatoria.";
  if (!payload.content || payload.content.length < 40) fields.content = "Contenuto obbligatorio, almeno 40 caratteri.";
  return { ok: Object.keys(fields).length === 0, fields, payload };
}

async function writeCatalogAudit(
  req: Request,
  action: string,
  type: CatalogType,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { catalogType: type, ...metadata },
  });
}

async function writeAgentRunSnapshot(params: {
  agentName: string;
  taskType: string;
  startedAt: Date;
  status: "completed" | "failed";
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
}) {
  const finishedAt = new Date();
  const [run] = await db
    .insert(agentRunsTable)
    .values({
      agentName: params.agentName,
      taskType: params.taskType,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      status: params.status,
      startedAt: params.startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - params.startedAt.getTime(),
      errorMessage: params.errorMessage,
    })
    .returning();
  return run;
}

function compactText(value: unknown, max = 700) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function estimateReadTimeMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 180));
}

function growthResearchTags(topic: string, extra: string[] = []) {
  const topicTags = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length > 3)
    .slice(0, 4);
  return Array.from(new Set(["ricerca", "crescita", "documenti", ...topicTags, ...extra])).slice(0, 8);
}

function buildGrowthResearchArticle(input: {
  title: string;
  url?: string | null;
  source: string;
  summary: string;
  topic: string;
  index: number;
}) {
  const title = compactText(input.title, 140) || `Ricerca crescita: ${input.topic}`;
  const summary = compactText(input.summary, 900);
  const url = input.url ? compactText(input.url, 500) : "";
  const content = [
    `# ${title}`,
    "",
    "## Fonte",
    url ? `${input.source}: ${url}` : input.source,
    "",
    "## Sintesi",
    summary || "Fonte raccolta dall'agente di ricerca. Da completare in revisione editoriale.",
    "",
    "## Perche conta per NorthStar",
    `Questo spunto e collegato al tema "${input.topic}" e puo aiutare Wendy a proporre contenuti pratici per orientamento, lavoro e crescita professionale.`,
    "",
    "## Spunti da validare",
    "- Verificare accuratezza e freschezza della fonte.",
    "- Adattare esempi e tono al pubblico NorthStar.",
    "- Trasformare la ricerca in una guida applicabile prima della pubblicazione.",
  ].join("\n");

  return {
    title,
    slug: slugify(`${title}-${Date.now()}-${input.index}`),
    category: "crescita-professionale",
    subcategory: "ricerca",
    description: summary.slice(0, 240) || `Bozza generata dall'agente ricerca crescita su ${input.topic}.`,
    content,
    tags: growthResearchTags(input.topic, [input.source.toLowerCase().replace(/\s+/g, "-")]),
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    status: "pending",
    readTimeMinutes: estimateReadTimeMinutes(content),
    updatedAt: new Date(),
  } satisfies typeof growthArticlesTable.$inferInsert;
}

function findDefaultPrompt(key: string) {
  return DEFAULT_PROMPTS.find((prompt) => prompt.key === key);
}

function extractPromptPlaceholders(value: string) {
  return Array.from(new Set(value.match(/{{\s*[A-Z0-9_]+\s*}}/g) ?? []))
    .map((placeholder) => placeholder.replace(/\s+/g, ""));
}

function validatePromptValue(
  value: string,
  allowedPlaceholders: string[],
  requiredPlaceholders: string[],
) {
  const placeholders = extractPromptPlaceholders(value);
  const unknownPlaceholders = placeholders.filter(
    (placeholder) => !allowedPlaceholders.includes(placeholder),
  );
  const missingRequiredPlaceholders = requiredPlaceholders.filter(
    (placeholder) => !placeholders.includes(placeholder),
  );
  const missingPlaceholders = allowedPlaceholders.filter(
    (placeholder) =>
      !placeholders.includes(placeholder) &&
      !missingRequiredPlaceholders.includes(placeholder),
  );
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value.trim().length < 10) errors.push("Il prompt deve contenere almeno 10 caratteri.");
  if (unknownPlaceholders.length > 0) {
    errors.push(`Placeholder non supportati: ${unknownPlaceholders.join(", ")}`);
  }
  if (missingRequiredPlaceholders.length > 0) {
    errors.push(`Placeholder obbligatori mancanti: ${missingRequiredPlaceholders.join(", ")}`);
  }
  if (missingPlaceholders.length > 0) {
    warnings.push(`Placeholder non usati: ${missingPlaceholders.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    placeholders,
    unknownPlaceholders,
    missingPlaceholders,
    missingRequiredPlaceholders,
  };
}

function sampleVariables(placeholders: string[], provided?: Record<string, unknown>) {
  const defaults: Record<string, string> = {
    USER_CONTEXT: "Utente: Product Manager, obiettivo: pianificare crescita professionale nei prossimi 90 giorni.",
    TOOLS: "calendar.createEvent, objectives.create, knowledge.linkNodes, news.search",
    SOURCE_NODE: "Nodo: AI Strategy - competenze, decisioni e opportunita correlate.",
    CANDIDATES: "Product Strategy, Automazione Processi, Roadmap Competenze",
    TOPIC: "leadership operativa con AI",
    AUDIENCE: "professionisti e team business",
  };
  const variables: Record<string, string> = {};
  for (const placeholder of placeholders) {
    const key = placeholder.replace(/[{}]/g, "");
    variables[key] = String(provided?.[key] ?? defaults[key] ?? `[${key}]`);
  }
  return variables;
}

function renderPrompt(value: string, variables: Record<string, string>) {
  return value.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? `[${key}]`);
}

function safeSnippet(value: string | null | undefined, max = 180) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function isMissingDbSchemaError(err: unknown) {
  const error = err as { code?: string; message?: string };
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("column") && message.includes("does not exist") ||
    message.includes("schema") && message.includes("does not exist")
  );
}

function qualityStatus(score: number | null, rewriteRate: number, clarificationRate = 0) {
  if ((score != null && score < 0.6) || rewriteRate > 0.3) return "critical";
  if ((score != null && score < 0.75) || rewriteRate > 0.15 || clarificationRate > 0.2) return "attention";
  return "healthy";
}

async function ensurePromptRegistry(prompt: AgentPrompt) {
  const requiredPlaceholders = prompt.requiredPlaceholders ?? [];
  const now = new Date();
  const existing = await db
    .select()
    .from(agentPromptsTable)
    .where(eq(agentPromptsTable.key, prompt.key))
    .limit(1);

  let record = existing[0];
  if (!record) {
    [record] = await db
      .insert(agentPromptsTable)
      .values({
        key: prompt.key,
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .returning();
  } else {
    [record] = await db
      .update(agentPromptsTable)
      .set({
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
  }

  const active = await db
    .select()
    .from(agentPromptVersionsTable)
    .where(and(
      eq(agentPromptVersionsTable.promptId, record.id),
      eq(agentPromptVersionsTable.status, "active"),
    ))
    .orderBy(desc(agentPromptVersionsTable.createdAt))
    .limit(1);

  if (!active[0]) {
    const [version] = await db
      .insert(agentPromptVersionsTable)
      .values({
        promptId: record.id,
        versionNumber: 1,
        status: "active",
        value: prompt.defaultValue,
        notes: "Versione default iniziale",
        publishedAt: now,
      })
      .returning();
    [record] = await db
      .update(agentPromptsTable)
      .set({ activeVersionId: version.id, updatedAt: now })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
  }

  return record;
}

async function getNextPromptVersionNumber(promptId: number) {
  const [row] = await db
    .select({
      next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
    })
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId));
  return Number(row?.next) || 1;
}

async function getPromptVersions(promptId: number) {
  return db
    .select()
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId))
    .orderBy(desc(agentPromptVersionsTable.versionNumber));
}

async function getPromptPayload(prompt: AgentPrompt) {
  const registry = await ensurePromptRegistry(prompt);
  const versions = await getPromptVersions(registry.id);
  const activeVersion =
    versions.find((version) => version.id === registry.activeVersionId) ??
    versions.find((version) => version.status === "active") ??
    null;
  const draftVersion = versions.find((version) => version.status === "draft") ?? null;
  const currentValue = activeVersion?.value ?? registry.defaultValue;
  const draftValue = draftVersion?.value ?? currentValue;
  const validation = validatePromptValue(
    draftValue,
    registry.placeholders,
    registry.requiredPlaceholders,
  );

  return {
    key: registry.key,
    label: registry.label,
    description: registry.description,
    placeholders: registry.placeholders,
    requiredPlaceholders: registry.requiredPlaceholders,
    defaultValue: registry.defaultValue,
    currentValue,
    draftValue,
    isOverridden: currentValue !== registry.defaultValue,
    hasDraft: Boolean(draftVersion),
    activeVersionId: activeVersion?.id ?? null,
    activeVersionNumber: activeVersion?.versionNumber ?? null,
    draftVersionId: draftVersion?.id ?? null,
    draftVersionNumber: draftVersion?.versionNumber ?? null,
    updatedAt: activeVersion?.publishedAt?.toISOString() ?? activeVersion?.updatedAt.toISOString() ?? null,
    updatedBy: activeVersion?.createdBy ? `User #${activeVersion.createdBy}` : null,
    validation,
  };
}

function getDefaultPromptPayload(prompt: AgentPrompt) {
  const requiredPlaceholders = prompt.requiredPlaceholders ?? [];
  const validation = validatePromptValue(
    prompt.defaultValue,
    prompt.placeholders,
    requiredPlaceholders,
  );

  return {
    key: prompt.key,
    label: prompt.label,
    description: prompt.description,
    placeholders: prompt.placeholders,
    requiredPlaceholders,
    defaultValue: prompt.defaultValue,
    currentValue: prompt.defaultValue,
    draftValue: prompt.defaultValue,
    isOverridden: false,
    hasDraft: false,
    activeVersionId: null,
    activeVersionNumber: null,
    draftVersionId: null,
    draftVersionNumber: null,
    updatedAt: null,
    updatedBy: null,
    validation,
    persistenceUnavailable: true,
    reason: "prompts_persistence_unavailable",
    setupAction: "run_migrations",
  };
}

function persistenceFallback(reason: string, setupAction: "run_migrations" | "check_database" | "check_schema" = "run_migrations") {
  return {
    persistenceUnavailable: true,
    reason,
    setupAction,
  };
}

function emptyQualityOverview(days: number, reason?: string) {
  return {
    generatedAt: new Date().toISOString(),
    days,
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    summary: {
      total: 0,
      avgEvalScore: null,
      avgSupervisorScore: null,
      rewriteRate: 0,
      clarificationRate: 0,
      toolUsageRate: 0,
      rewrites: 0,
      clarifications: 0,
      uiTools: 0,
      avgResponseTimeMs: null,
      supervisorRewriteCount: 0,
      avgScoreBeforeRewrite: null,
      avgScoreAfterRewrite: null,
      feedbackTotal: 0,
      negativeFeedback: 0,
      positiveFeedback: 0,
      negativeFeedbackRate: 0,
    },
    trends: [],
    domains: [],
    problemConversations: [],
    rewriteReasons: [],
    alerts: reason
      ? [{
          level: "attention" as const,
          title: "Metriche qualita non disponibili",
          message: "Applica le migration quality/feedback per popolare questa sezione.",
          domain: null,
        }]
      : [],
  };
}

function emptyAgentsOverview(days: number, reason?: string) {
  return {
    generatedAt: new Date().toISOString(),
    days,
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    summary: {
      totalRuns: 0,
      totalAgents: 0,
      successRate30d: 100,
      avgDurationMs: null,
      failedRuns: 0,
      runningRuns: 0,
      degradedAgents: 0,
      criticalAgents: 0,
      costUsd30d: 0,
      totalTokens30d: 0,
      aiRequests30d: 0,
      aiErrors30d: 0,
    },
    agents: [],
    recentRuns: [],
    recentErrors: [],
    costs: {
      days,
      estimatedCostUsd: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      aiRequestCostUsd: 0,
      aiRequestTokens: 0,
      aiRequestCount: 0,
      aiErrorCount: 0,
      byProvider: [],
    },
    runnableAgents: RUNNABLE_AGENTS,
  };
}

function emptyCatalogList(type: CatalogType, reason?: string) {
  return {
    type,
    label: CATALOG_LABELS[type],
    items: [],
    drafts: [],
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
  };
}

function emptyCatalogOverview(reason?: string) {
  return {
    generatedAt: new Date().toISOString(),
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    items: CATALOG_TYPES.map((type) => ({
      type,
      label: CATALOG_LABELS[type],
      total: 0,
      active: 0,
      archived: 0,
      drafts: 0,
    })),
  };
}

const ADMIN_ENV_CHECKS = [
  { key: "DATABASE_URL", label: "Database", critical: true },
  { key: "JWT_SECRET", label: "Auth token", critical: true },
  { key: "CLERK_SECRET_KEY", label: "Clerk server", critical: true },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter AI", critical: true },
  { key: "ADMIN_BREAK_GLASS_KEY", label: "Break-glass admin", critical: true },
  { key: "STRIPE_SECRET_KEY", label: "Stripe", critical: false },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook", critical: false },
  { key: "RESEND_API_KEY", label: "Email", critical: false },
  { key: "TAVILY_API_KEY", label: "Web research", critical: false },
  { key: "REDIS_URL", label: "Redis/rate limit", critical: false },
] as const;

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function envStatus() {
  const items = ADMIN_ENV_CHECKS.map((item) => ({
    ...item,
    configured: Boolean(process.env[item.key]),
  }));
  const missingCritical = items.filter((item) => item.critical && !item.configured);
  const missingOptional = items.filter((item) => !item.critical && !item.configured);
  return {
    total: items.length,
    configured: items.filter((item) => item.configured).length,
    missingCritical: missingCritical.map((item) => item.key),
    missingOptional: missingOptional.map((item) => item.key),
    items,
  };
}

async function getBusinessStatusSnapshot(daysInput: unknown) {
  const days = [7, 30].includes(Number(daysInput)) ? Number(daysInput) : 30;
  const now = new Date();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const errorReport = executionMonitor.getReport();
  const dbReady = await checkDatabaseHealth();

  const [
    userStats,
    testStats,
    topSectors,
    contactStats,
    leadStats,
    agentStats,
    recentFailedRuns,
    aiStats,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        premium: sql<number>`count(*) filter (where exists (
          select 1 from subscriptions s
          where s.user_id = ${usersTable.id}
            and s.cancelled_at is null
            and (s.valid_until is null or s.valid_until >= now())
            and s.plan in ('pro', 'team')
        ))::int`,
        new7d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since7d})::int`,
        new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30d})::int`,
      })
      .from(usersTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since})::int`,
        recent7d: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since7d})::int`,
        recent30d: sql<number>`count(*) filter (where ${testSessionsTable.createdAt} >= ${since30d})::int`,
        confirmed: sql<number>`count(*) filter (where ${testSessionsTable.confirmedSectorId} is not null)::int`,
      })
      .from(testSessionsTable),
    db
      .select({
        sectorId: testSessionsTable.confirmedSectorId,
        count: sql<number>`count(*)::int`,
      })
      .from(testSessionsTable)
      .where(sql`${testSessionsTable.confirmedSectorId} is not null`)
      .groupBy(testSessionsTable.confirmedSectorId)
      .orderBy(sql`count(*) desc`)
      .limit(5),
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
        open: sql<number>`count(*) filter (where ${contactMessagesTable.status} in ('new', 'in_progress'))::int`,
      })
      .from(contactMessagesTable)
      .where(isNull(contactMessagesTable.deletedAt)),
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
        contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
        converted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'converted')::int`,
        unread: sql<number>`count(*) filter (where ${affiliationLeadsTable.read} = false)::int`,
      })
      .from(affiliationLeadsTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
        running: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'running')::int`,
        avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
      })
      .from(agentRunsTable)
      .where(gte(agentRunsTable.startedAt, since)),
    db
      .select({
        id: agentRunsTable.id,
        agentName: agentRunsTable.agentName,
        taskType: agentRunsTable.taskType,
        status: agentRunsTable.status,
        errorMessage: agentRunsTable.errorMessage,
        startedAt: agentRunsTable.startedAt,
      })
      .from(agentRunsTable)
      .where(and(gte(agentRunsTable.startedAt, since), sql`${agentRunsTable.status} in ('failed', 'cancelled')`))
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(5),
    db
      .select({
        requests: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
      })
      .from(aiRequestLogTable)
      .where(gte(aiRequestLogTable.createdAt, since)),
  ]);

  const users = userStats[0] ?? { total: 0, premium: 0, new7d: 0, new30d: 0 };
  const tests = testStats[0] ?? { total: 0, recent: 0, recent7d: 0, recent30d: 0, confirmed: 0 };
  const contacts = contactStats[0] ?? { total: 0, unread: 0, open: 0 };
  const leads = leadStats[0] ?? { total: 0, pending: 0, contacted: 0, converted: 0, unread: 0 };
  const agents = agentStats[0] ?? { total: 0, failed: 0, running: 0, avgDurationMs: null };
  const ai = aiStats[0] ?? { requests: 0, errors: 0 };
  const env = envStatus();
  const agentErrorRate = percent(Number(agents.failed) || 0, Number(agents.total) || 0);
  const aiErrorRate = percent(Number(ai.errors) || 0, Number(ai.requests) || 0);
  const recentErrors = errorReport.errors.slice(0, 5).map((error) => ({
    file: error.file,
    function: error.function,
    message: error.message,
    code: error.code ?? null,
    capturedAt: error.capturedAt,
    occurrences: error.occurrences,
  }));

  const services = {
    api: { status: "ok", label: "API", uptimeSeconds: Math.floor(process.uptime()) },
    database: { status: dbReady ? "ok" : "error", label: "Database" },
    auth: { status: process.env.JWT_SECRET && process.env.CLERK_SECRET_KEY ? "ok" : "not_configured", label: "Clerk/Auth" },
    ai: { status: process.env.OPENROUTER_API_KEY ? "ok" : "not_configured", label: "OpenRouter AI" },
    stripe: { status: process.env.STRIPE_SECRET_KEY ? "ok" : "not_configured", label: "Stripe" },
  };

  const criticalReasons: string[] = [];
  const attentionReasons: string[] = [];
  if (!dbReady) criticalReasons.push("Database non pronto");
  if (env.missingCritical.length > 0) criticalReasons.push(`${env.missingCritical.length} env critiche mancanti`);
  if (errorReport.errors.length >= 5) criticalReasons.push(`${errorReport.errors.length} errori unici recenti`);
  if (agentErrorRate > 20) criticalReasons.push(`Agent error rate ${agentErrorRate}%`);
  if (errorReport.totalCaptured > 0) attentionReasons.push(`${errorReport.totalCaptured} errori catturati`);
  if (env.missingOptional.length > 0) attentionReasons.push(`${env.missingOptional.length} env opzionali mancanti`);
  if ((Number(contacts.unread) || 0) > 0) attentionReasons.push(`${contacts.unread} messaggi non letti`);
  if ((Number(leads.pending) || 0) > 0) attentionReasons.push(`${leads.pending} lead pending`);
  if (agentErrorRate > 0) attentionReasons.push(`Agenti con errori ${agentErrorRate}%`);

  const status = criticalReasons.length > 0 ? "critical" : attentionReasons.length > 0 ? "attention" : "healthy";

  return {
    generatedAt: new Date().toISOString(),
    days,
    business: {
      users: {
        total: Number(users.total) || 0,
        new7d: Number(users.new7d) || 0,
        new30d: Number(users.new30d) || 0,
        premium: Number(users.premium) || 0,
        conversionRate: percent(Number(users.premium) || 0, Number(users.total) || 0),
      },
      tests: {
        total: Number(tests.total) || 0,
        recent: Number(tests.recent) || 0,
        recent7d: Number(tests.recent7d) || 0,
        recent30d: Number(tests.recent30d) || 0,
        confirmed: Number(tests.confirmed) || 0,
        completionRate: percent(Number(tests.confirmed) || 0, Number(tests.total) || 0),
      },
      topSectors,
    },
    funnels: {
      userToTestRate: percent(Number(tests.total) || 0, Number(users.total) || 0),
      userToPremiumRate: percent(Number(users.premium) || 0, Number(users.total) || 0),
      leadConversionRate: percent(Number(leads.converted) || 0, Number(leads.total) || 0),
    },
    technical: {
      status,
      label: status === "healthy" ? "Tutto stabile" : status === "attention" ? "Attenzione" : "Intervento richiesto",
      reasons: [...criticalReasons, ...attentionReasons],
      uptimeSeconds: Math.floor(process.uptime()),
      services,
      dbReady,
      errors: {
        totalCaptured: errorReport.totalCaptured,
        unique: errorReport.errors.length,
        recent: recentErrors,
        brokenComponents: errorReport.brokenComponents.slice(0, 5),
      },
      agents: {
        totalRuns: Number(agents.total) || 0,
        failedRuns: Number(agents.failed) || 0,
        runningRuns: Number(agents.running) || 0,
        errorRate: agentErrorRate,
        avgDurationMs: agents.avgDurationMs ?? null,
        recentFailures: recentFailedRuns,
      },
      ai: {
        requests: Number(ai.requests) || 0,
        errors: Number(ai.errors) || 0,
        errorRate: aiErrorRate,
      },
    },
    env,
    inbox: {
      messages: contacts,
      leads,
    },
    actions: [
      { label: "Review suggerimenti", section: "queue", path: "/admin/review", count: null },
      { label: "Coda crescita", section: "crescita", path: "/admin/crescita", count: null },
      { label: "Agenti", section: "agents", path: "/admin/agenti", count: Number(agents.failed) || 0 },
      { label: "Status", section: "status", path: "/admin/status", count: criticalReasons.length + attentionReasons.length },
      { label: "Messaggi", section: "messaggi", path: "/admin/messaggi", count: Number(contacts.unread) || 0 },
      { label: "Affiliazione", section: "affiliazione", path: "/admin/affiliazione", count: Number(leads.pending) || 0 },
    ],
  };
}

router.get("/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const now = new Date();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const errorReport = executionMonitor.getReport();

    const [
      suggestionStats,
      growthStats,
      inboxStats,
      leadStats,
      userStats,
      testStats,
      calendarStats,
      agentRows,
      failedRuns,
    ] = await Promise.all([
      db
        .select({
          status: agentSuggestionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(agentSuggestionsTable)
        .groupBy(agentSuggestionsTable.status),
      db
        .select({
          status: growthArticlesTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(growthArticlesTable)
        .groupBy(growthArticlesTable.status),
      db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
        })
        .from(contactMessagesTable)
        .where(isNull(contactMessagesTable.deletedAt)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
          contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
        })
        .from(affiliationLeadsTable),
      db
        .select({
          total: sql<number>`count(*)::int`,
          premium: sql<number>`count(*) filter (where exists (
            select 1 from subscriptions s
            where s.user_id = ${usersTable.id}
              and s.cancelled_at is null
              and (s.valid_until is null or s.valid_until >= now())
              and s.plan in ('pro', 'team')
          ))::int`,
          new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30d})::int`,
        })
        .from(usersTable),
      db.select({ total: sql<number>`count(*)::int` }).from(testSessionsTable),
      db
        .select({
          upcoming: sql<number>`count(*) filter (where ${calendarEventsTable.endAt} >= ${now})::int`,
          next24h: sql<number>`count(*) filter (where ${calendarEventsTable.startAt} >= ${now} and ${calendarEventsTable.startAt} < ${new Date(Date.now() + 24 * 60 * 60 * 1000)})::int`,
        })
        .from(calendarEventsTable),
      db
        .select({
          agentName: agentRunsTable.agentName,
          totalCalls30d: sql<number>`count(*)::int`,
          errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
          avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since30d))
        .groupBy(agentRunsTable.agentName)
        .orderBy(agentRunsTable.agentName),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          taskType: agentRunsTable.taskType,
          startedAt: agentRunsTable.startedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          status: agentRunsTable.status,
        })
        .from(agentRunsTable)
        .where(sql`${agentRunsTable.status} in ('failed', 'cancelled')`)
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(5),
    ]);

    const suggestionByStatus = Object.fromEntries(
      suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
    );
    const growthByStatus = Object.fromEntries(
      growthStats.map((row) => [row.status, Number(row.count) || 0]),
    );
    const pendingReview = suggestionByStatus.pending_review ?? 0;
    const growthPending = growthByStatus.pending ?? growthByStatus.draft ?? 0;
    const unreadMessages = Number(inboxStats[0]?.unread) || 0;
    const pendingLeads = Number(leadStats[0]?.pending) || 0;

    const agents = agentRows.map((row) => {
      const total = Number(row.totalCalls30d) || 0;
      const errors = Number(row.errorCount30d) || 0;
      const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0;
      const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      return {
        agentName: row.agentName,
        totalCalls30d: total,
        errorCount30d: errors,
        errorRate30d: errorRate,
        successRate30d: successRate,
        avgDurationMs: row.avgDurationMs ?? null,
        status: errorRate > 20 ? "critical" : errorRate >= 5 ? "degraded" : "healthy",
      };
    });

    const criticalAgents = agents.filter((agent) => agent.status === "critical");
    const degradedAgents = agents.filter((agent) => agent.status === "degraded");
    const actionItems = pendingReview + growthPending + unreadMessages + pendingLeads;
    const reasons: string[] = [];
    if (pendingReview > 0) reasons.push(`${pendingReview} richieste in revisione`);
    if (growthPending > 0) reasons.push(`${growthPending} articoli crescita pending`);
    if (unreadMessages > 0) reasons.push(`${unreadMessages} messaggi non letti`);
    if (pendingLeads > 0) reasons.push(`${pendingLeads} lead da contattare`);
    if (criticalAgents.length > 0) reasons.push(`${criticalAgents.length} agenti critici`);
    if (degradedAgents.length > 0) reasons.push(`${degradedAgents.length} agenti degradati`);
    if (errorReport.totalCaptured > 0) reasons.push(`${errorReport.totalCaptured} errori catturati`);

    const healthStatus =
      criticalAgents.length > 0 || errorReport.errors.length >= 5
        ? "critical"
        : reasons.length > 0
          ? "attention"
          : "healthy";

    res.json({
      generatedAt: new Date().toISOString(),
      health: {
        status: healthStatus,
        label:
          healthStatus === "healthy"
            ? "Tutto stabile"
            : healthStatus === "attention"
              ? "Attenzione"
              : "Intervento richiesto",
        reasons,
        criticalCount: criticalAgents.length + (errorReport.errors.length >= 5 ? 1 : 0),
        actionItems,
      },
      queues: {
        reviewPending: pendingReview,
        growthPending,
        totalOpen: pendingReview + growthPending,
      },
      errors: {
        totalCaptured: errorReport.totalCaptured,
        unique: errorReport.errors.length,
        brokenComponents: errorReport.brokenComponents.slice(0, 5),
        recent: errorReport.errors.slice(0, 5).map((error) => ({
          file: error.file,
          function: error.function,
          message: error.message,
          code: error.code ?? null,
          capturedAt: error.capturedAt,
          occurrences: error.occurrences,
        })),
      },
      agents: {
        total: agents.length,
        critical: criticalAgents.length,
        degraded: degradedAgents.length,
        failedRecent: failedRuns.map((run) => ({
          id: run.id,
          agentName: run.agentName,
          taskType: run.taskType,
          startedAt: run.startedAt,
          durationMs: run.durationMs,
          errorMessage: run.errorMessage,
          status: run.status,
        })),
        health: agents,
      },
      metrics: {
        users: userStats[0] ?? { total: 0, premium: 0, new30d: 0 },
        tests: testStats[0] ?? { total: 0 },
        calendar: calendarStats[0] ?? { upcoming: 0, next24h: 0 },
      },
      inbox: {
        unreadMessages,
        pendingLeads,
        contactedLeads: Number(leadStats[0]?.contacted) || 0,
        totalMessages: Number(inboxStats[0]?.total) || 0,
        totalLeads: Number(leadStats[0]?.total) || 0,
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/overview] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const [suggestionStats, runStats] = await Promise.all([
      db
        .select({
          status: agentSuggestionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(agentSuggestionsTable)
        .groupBy(agentSuggestionsTable.status),
      db
        .select({ totalRuns: sql<number>`count(*)::int` })
        .from(agentRunsTable),
    ]);

    const byStatus = Object.fromEntries(
      suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
    );

    res.json({
      pending: byStatus.pending_review ?? 0,
      approved: byStatus.approved ?? 0,
      rejected: byStatus.rejected ?? 0,
      applied: byStatus.applied ?? 0,
      archived: byStatus.archived ?? 0,
      totalRuns: runStats[0]?.totalRuns ?? 0,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/stats] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const limit = getLimit(req);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const confidenceMin = Number(req.query.confidence_min);

    const conditions = [];
    if (status && status !== "all") conditions.push(eq(agentSuggestionsTable.status, status as any));
    if (entityType && entityType !== "all") conditions.push(eq(agentSuggestionsTable.entityType, entityType));
    if (search) conditions.push(ilike(agentSuggestionsTable.entityName, `%${search}%`));
    if (Number.isFinite(confidenceMin) && confidenceMin > 0) {
      conditions.push(sql`${agentSuggestionsTable.confidenceScore} >= ${confidenceMin}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db
      .select({
        id: agentSuggestionsTable.id,
        agentRunId: agentSuggestionsTable.agentRunId,
        entityType: agentSuggestionsTable.entityType,
        entityName: agentSuggestionsTable.entityName,
        payloadJson: agentSuggestionsTable.payloadJson,
        confidenceScore: agentSuggestionsTable.confidenceScore,
        status: agentSuggestionsTable.status,
        reviewedBy: agentSuggestionsTable.reviewedBy,
        reviewedAt: agentSuggestionsTable.reviewedAt,
        notes: agentSuggestionsTable.notes,
        createdAt: agentSuggestionsTable.createdAt,
        updatedAt: agentSuggestionsTable.updatedAt,
        agentName: agentRunsTable.agentName,
        queuePriority: reviewQueueTable.priority,
        queueStatus: reviewQueueTable.queueStatus,
      })
      .from(agentSuggestionsTable)
      .leftJoin(agentRunsTable, eq(agentSuggestionsTable.agentRunId, agentRunsTable.id))
      .leftJoin(reviewQueueTable, eq(reviewQueueTable.suggestionId, agentSuggestionsTable.id))
      .where(where)
      .orderBy(desc(agentSuggestionsTable.createdAt))
      .limit(limit);

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentSuggestionsTable)
      .where(where);

    res.json({ items, total });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const [suggestion] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [agentRun] = suggestion.agentRunId
      ? await db.select().from(agentRunsTable).where(eq(agentRunsTable.id, suggestion.agentRunId)).limit(1)
      : [null];
    const [queueItem] = await db
      .select()
      .from(reviewQueueTable)
      .where(eq(reviewQueueTable.suggestionId, id))
      .limit(1);
    const auditTrail = await db
      .select()
      .from(auditLogTable)
      .where(and(
        eq(auditLogTable.targetId, id),
        sql`${auditLogTable.action} like 'admin_suggestion_%'`,
      ))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(20);

    res.json({
      suggestion,
      agentRun: agentRun ?? null,
      queueItem: queueItem ?? null,
      auditTrail: auditTrail
        .map((log) => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          category: log.category,
          metadata: log.metadata,
          createdAt: log.createdAt,
        })),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/:id] error");
    res.status(500).json({ error: String(err) });
  }
});

async function reviewSuggestion(
  req: Request,
  res: Response,
  status: "approved" | "rejected" | "archived",
  notes?: string,
) {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status: status as any,
        notes: notes ?? null,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    await db
      .update(reviewQueueTable)
      .set({
        queueStatus: status === "archived" ? "done" : "done",
        updatedAt: new Date(),
      })
      .where(eq(reviewQueueTable.suggestionId, id));

    await writeAuditLog(req, {
      action:
        status === "approved"
          ? "admin_suggestion_approved"
          : status === "rejected"
            ? "admin_suggestion_rejected"
            : "admin_suggestion_archived",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: status,
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/review] error");
    res.status(500).json({ error: String(err) });
  }
}

router.post("/suggestions/:id/approve", async (req: Request, res: Response) => {
  await reviewSuggestion(req, res, "approved");
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  await reviewSuggestion(
    req,
    res,
    "rejected",
    typeof req.body?.notes === "string" ? req.body.notes : undefined,
  );
});

router.post("/suggestions/:id/archive", async (req: Request, res: Response) => {
  await reviewSuggestion(
    req,
    res,
    "archived",
    typeof req.body?.notes === "string" ? req.body.notes : "Archiviato",
  );
});

router.post("/suggestions/:id/apply", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const id = Number(req.params.id);
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    if (current.status !== "approved") {
      res.status(400).json({ error: "Solo i suggerimenti approvati possono essere applicati" });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status: "applied",
        notes: notes ?? current.notes,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    await writeAuditLog(req, {
      action: "admin_suggestion_applied",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: "applied",
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
        workflowOnly: true,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/apply] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agent-runs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req));
    res.json(runs);
  } catch (err) {
    rootLogger.error({ err }, "[admin/agent-runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const canonical = await db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(getLimit(req));

    res.json(
      canonical.map((log) => ({
        id: log.id,
        userId: log.actorId == null ? null : String(log.actorId),
        action: log.action,
        targetType: log.category ?? "system",
        targetId: log.targetId,
        metadataJson: (log.metadata as Record<string, unknown> | null) ?? null,
        createdAt: log.createdAt,
      })),
    );
  } catch {
    try {
      const legacy = await db
        .select()
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(getLimit(req));
      res.json(legacy);
    } catch (err) {
      rootLogger.error({ err }, "[admin/logs] error");
      res.status(500).json({ error: String(err) });
    }
  }
});

router.get("/prompts", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const payload = [];
    for (const prompt of DEFAULT_PROMPTS) {
      payload.push(await getPromptPayload(prompt));
    }
    res.json(payload);
  } catch (err) {
    rootLogger.warn({ err }, "[admin/prompts] returning default prompts after read failure");
    res.json(DEFAULT_PROMPTS.map(getDefaultPromptPayload));
  }
});

router.get("/prompts/:key/versions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const versions = await getPromptVersions(registry.id);
    res.json({
      promptKey: registry.key,
      activeVersionId: registry.activeVersionId,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        value: version.value,
        notes: version.notes,
        createdBy: version.createdBy,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        validation: validatePromptValue(
          version.value,
          registry.placeholders,
          registry.requiredPlaceholders,
        ),
      })),
    });
  } catch (err) {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    rootLogger.warn({ err, key: req.params.key }, "[admin/prompts/:key/versions] returning default virtual version after read failure");
    res.json({
      promptKey: prompt.key,
      activeVersionId: null,
      ...persistenceFallback("prompt_versions_persistence_unavailable"),
      versions: [
        {
          id: 0,
          versionNumber: 1,
          status: "active",
          value: prompt.defaultValue,
          notes: "Versione default non persistita",
          createdBy: null,
          publishedAt: null,
          createdAt: null,
          updatedAt: null,
          validation: validatePromptValue(
            prompt.defaultValue,
            prompt.placeholders,
            prompt.requiredPlaceholders ?? [],
          ),
        },
      ],
    });
  }
});

router.post("/prompts/:key/draft", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    const value = typeof req.body?.value === "string" ? req.body.value : "";
    const notes = typeof req.body?.notes === "string" ? req.body.notes : null;
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }

    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    const now = new Date();
    const draft = await db.transaction(async (tx) => {
      const [existingDraft] = await tx
        .select()
        .from(agentPromptVersionsTable)
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "draft"),
        ))
        .orderBy(desc(agentPromptVersionsTable.createdAt))
        .limit(1);

      if (existingDraft) {
        const [updated] = await tx
          .update(agentPromptVersionsTable)
          .set({
            value,
            notes,
            createdBy: req.user?.id ?? null,
            updatedAt: now,
          })
          .where(eq(agentPromptVersionsTable.id, existingDraft.id))
          .returning();
        return updated;
      }

      const [row] = await tx
        .select({
          next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
        })
        .from(agentPromptVersionsTable)
        .where(eq(agentPromptVersionsTable.promptId, registry.id));

      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: Number(row?.next) || 1,
          status: "draft",
          value,
          notes,
          createdBy: req.user?.id ?? null,
          updatedAt: now,
        })
        .returning();
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_draft_saved",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: draft.id,
        versionNumber: draft.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, draft, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/draft] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/publish", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [draft] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(and(
        eq(agentPromptVersionsTable.promptId, registry.id),
        eq(agentPromptVersionsTable.status, "draft"),
      ))
      .orderBy(desc(agentPromptVersionsTable.createdAt))
      .limit(1);
    if (!draft) {
      res.status(400).json({ error: "Nessuna bozza da pubblicare" });
      return;
    }
    const validation = validatePromptValue(
      draft.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Prompt non valido", validation });
      return;
    }

    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "active"),
        ));
      const [published] = await tx
        .update(agentPromptVersionsTable)
        .set({
          status: "active",
          createdBy: req.user?.id ?? draft.createdBy ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(agentPromptVersionsTable.id, draft.id))
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: published.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return published;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_published",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
        validation,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/publish] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/rollback", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    const versionId = Number(req.body?.versionId);
    if (!prompt || !Number.isFinite(versionId)) {
      res.status(400).json({ error: "Rollback non valido" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const [source] = await db
      .select()
      .from(agentPromptVersionsTable)
      .where(and(
        eq(agentPromptVersionsTable.promptId, registry.id),
        eq(agentPromptVersionsTable.id, versionId),
      ))
      .limit(1);
    if (!source) {
      res.status(404).json({ error: "Versione prompt non trovata" });
      return;
    }
    const validation = validatePromptValue(
      source.value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Versione non valida", validation });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "rolled_back", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "active"),
        ));
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(and(
          eq(agentPromptVersionsTable.promptId, registry.id),
          eq(agentPromptVersionsTable.status, "draft"),
        ));
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: source.value,
          notes: `Rollback da v${source.versionNumber}`,
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_rollback",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        sourceVersionId: source.id,
        sourceVersionNumber: source.versionNumber,
        newVersionId: active.id,
        newVersionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/rollback] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/reset", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const validation = validatePromptValue(
      registry.defaultValue,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    if (!validation.ok) {
      res.status(400).json({ error: validation.errors[0] ?? "Default non valido", validation });
      return;
    }

    const nextVersionNumber = await getNextPromptVersionNumber(registry.id);
    const now = new Date();
    const active = await db.transaction(async (tx) => {
      await tx
        .update(agentPromptVersionsTable)
        .set({ status: "archived", updatedAt: now })
        .where(eq(agentPromptVersionsTable.promptId, registry.id));
      const [created] = await tx
        .insert(agentPromptVersionsTable)
        .values({
          promptId: registry.id,
          versionNumber: nextVersionNumber,
          status: "active",
          value: registry.defaultValue,
          notes: "Reset al default",
          createdBy: req.user?.id ?? null,
          publishedAt: now,
          updatedAt: now,
        })
        .returning();
      await tx
        .update(agentPromptsTable)
        .set({ activeVersionId: created.id, updatedAt: now })
        .where(eq(agentPromptsTable.id, registry.id));
      return created;
    });

    await writeAuditLog(req, {
      action: "admin_prompt_reset_default",
      category: "admin_action",
      metadata: {
        promptKey: registry.key,
        promptId: registry.id,
        versionId: active.id,
        versionNumber: active.versionNumber,
      },
    });

    res.json({ ok: true, active, validation });
  } catch (err) {
    rootLogger.error({ err }, "[admin/prompts/:key/reset] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/prompts/:key/preview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    const registry = await ensurePromptRegistry(prompt);
    const value =
      typeof req.body?.value === "string"
        ? req.body.value
        : (await getPromptPayload(prompt)).draftValue;
    const variables = sampleVariables(
      registry.placeholders,
      typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined,
    );
    const validation = validatePromptValue(
      value,
      registry.placeholders,
      registry.requiredPlaceholders,
    );
    res.json({
      ok: true,
      rendered: renderPrompt(value, variables),
      variables,
      validation,
    });
  } catch (err) {
    const prompt = findDefaultPrompt(req.params.key);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    rootLogger.warn({ err, key: req.params.key }, "[admin/prompts/:key/preview] returning default preview after read failure");
    const value = typeof req.body?.value === "string" ? req.body.value : prompt.defaultValue;
    const variables = sampleVariables(
      prompt.placeholders,
      typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined,
    );
    const validation = validatePromptValue(
      value,
      prompt.placeholders,
      prompt.requiredPlaceholders ?? [],
    );
    res.json({
      ok: true,
      ...persistenceFallback("prompt_preview_persistence_unavailable"),
      rendered: renderPrompt(value, variables),
      variables,
      validation,
    });
  }
});

router.get("/ai/model-policy", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    res.json({
      generatedAt: new Date().toISOString(),
      policy: getModelRoutingPolicy(),
      notes: [
        "Con AI_PROVIDER=openrouter la policy usa solo openrouter/free o model ID con suffisso :free.",
        "Gli override env MODEL_* sono accettati solo se gratuiti, salvo ALLOW_PAID_AI_MODELS=true.",
      ],
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/ai/model-policy] policy unavailable");
    res.json({
      generatedAt: new Date().toISOString(),
      policy: null,
      notes: ["Policy modelli temporaneamente non disponibile."],
    });
  }
});

router.get("/quality", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const supervisorStats = await db
      .select({
        domain: supervisorLogs.domain,
        total: sql<number>`count(*)::int`,
        avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
        avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
      })
      .from(supervisorLogs)
      .groupBy(supervisorLogs.domain)
      .orderBy(supervisorLogs.domain);

    const qualityStats = await db
      .select({
        domain: qualityMetrics.domain,
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics)
      .groupBy(qualityMetrics.domain)
      .orderBy(qualityMetrics.domain);

    const totals = await db
      .select({
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics);

    writeAuditLog(req, {
      action: "admin_quality_view",
      category: "admin_action",
      metadata: { domains: supervisorStats.map((s: any) => s.domain) },
    });

    res.json({
      supervisorStats,
      qualityStats,
      totals: totals[0] ?? { total: 0, avgEvalScore: 0, avgSupervisorScore: 0, rewrites: 0, clarifications: 0, uiTools: 0 },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/quality] query failed");
    res.status(500).json({ error: String(err) });
  }
});

// ── Wendy Prometheus metrics as JSON ───────────────────────────────

router.get("/quality/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));

  try {
    const limit = getLimit(req, 50, 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalsRows,
      domainRows,
      trendRows,
      aiTrendRows,
      supervisorRows,
      feedbackRows,
      problemSupervisorRows,
      negativeFeedbackRows,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since)),
      db
        .select({
          domain: qualityMetrics.domain,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(qualityMetrics.domain)
        .orderBy(sql`avg(${qualityMetrics.evalScore}) asc nulls last`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${qualityMetrics.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(sql`date_trunc('day', ${qualityMetrics.createdAt})`)
        .orderBy(sql`date_trunc('day', ${qualityMetrics.createdAt}) asc`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiRequestLogTable.createdAt}), 'YYYY-MM-DD')`,
          avgLatencyMs: sql<number>`avg(${aiRequestLogTable.latencyMs})::float`,
          aiRequests: sql<number>`count(*)::int`,
          aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
          toolCalls: sql<number>`coalesce(sum(${aiRequestLogTable.toolCallsCount}), 0)::int`,
        })
        .from(aiRequestLogTable)
        .where(gte(aiRequestLogTable.createdAt, since))
        .groupBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt}) asc`),
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
          avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          negative: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} < 0)::int`,
          positive: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} > 0)::int`,
        })
        .from(responseFeedbackTable)
        .where(gte(responseFeedbackTable.createdAt, since)),
      db
        .select({
          id: supervisorLogs.id,
          createdAt: supervisorLogs.createdAt,
          sessionId: supervisorLogs.sessionId,
          domain: supervisorLogs.domain,
          intent: supervisorLogs.intent,
          userMessage: supervisorLogs.userMessage,
          draft: supervisorLogs.draft,
          finalText: supervisorLogs.finalText,
          scoreBefore: supervisorLogs.scoreBefore,
          scoreAfter: supervisorLogs.scoreAfter,
          reasons: supervisorLogs.reasons,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since))
        .orderBy(supervisorLogs.scoreBefore, desc(supervisorLogs.createdAt))
        .limit(limit),
      db
        .select({
          id: responseFeedbackTable.id,
          createdAt: responseFeedbackTable.createdAt,
          sessionId: responseFeedbackTable.sessionId,
          messageIndex: responseFeedbackTable.messageIndex,
          rating: responseFeedbackTable.rating,
          comment: responseFeedbackTable.comment,
          title: coachSessionsTable.title,
        })
        .from(responseFeedbackTable)
        .leftJoin(coachSessionsTable, eq(responseFeedbackTable.sessionId, coachSessionsTable.id))
        .where(and(gte(responseFeedbackTable.createdAt, since), sql`${responseFeedbackTable.rating} < 0`))
        .orderBy(desc(responseFeedbackTable.createdAt))
        .limit(Math.min(limit, 25)),
    ]);

    const totals = totalsRows[0] ?? {
      total: 0,
      avgEvalScore: null,
      avgSupervisorScore: null,
      rewrites: 0,
      clarifications: 0,
      uiTools: 0,
      avgResponseTimeMs: null,
    };
    const feedback = feedbackRows[0] ?? { total: 0, negative: 0, positive: 0 };
    const supervisor = supervisorRows[0] ?? { total: 0, avgScoreBefore: null, avgScoreAfter: null };
    const total = Number(totals.total) || 0;
    const rewrites = Number(totals.rewrites) || 0;
    const clarifications = Number(totals.clarifications) || 0;
    const uiTools = Number(totals.uiTools) || 0;
    const negativeFeedback = Number(feedback.negative) || 0;
    const feedbackTotal = Number(feedback.total) || 0;
    const rewriteRate = total > 0 ? rewrites / total : 0;
    const clarificationRate = total > 0 ? clarifications / total : 0;
    const toolUsageRate = total > 0 ? uiTools / total : 0;
    const negativeFeedbackRate = feedbackTotal > 0 ? negativeFeedback / feedbackTotal : 0;
    const avgScore =
      totals.avgEvalScore != null
        ? Number(totals.avgEvalScore)
        : totals.avgSupervisorScore != null
          ? Number(totals.avgSupervisorScore)
          : null;

    const domains = domainRows.map((row) => {
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const score = row.avgEvalScore != null ? Number(row.avgEvalScore) : row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null;
      const rowRewriteRate = rowTotal > 0 ? rowRewrites / rowTotal : 0;
      const rowClarificationRate = rowTotal > 0 ? rowClarifications / rowTotal : 0;
      return {
        domain: row.domain,
        total: rowTotal,
        avgEvalScore: row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore: row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null,
        rewrites: rowRewrites,
        clarifications: rowClarifications,
        uiTools: Number(row.uiTools) || 0,
        rewriteRate: rowRewriteRate,
        clarificationRate: rowClarificationRate,
        toolUsageRate: rowTotal > 0 ? (Number(row.uiTools) || 0) / rowTotal : 0,
        avgResponseTimeMs: row.avgResponseTimeMs != null ? Math.round(Number(row.avgResponseTimeMs)) : null,
        status: qualityStatus(score, rowRewriteRate, rowClarificationRate),
      };
    });

    const aiByDay = new Map(aiTrendRows.map((row) => [row.day, row]));
    const trends = trendRows.map((row) => {
      const ai = aiByDay.get(row.day);
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const rowUiTools = Number(row.uiTools) || 0;
      return {
        day: row.day,
        total: rowTotal,
        avgEvalScore: row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore: row.avgSupervisorScore != null ? Number(row.avgSupervisorScore) : null,
        rewriteRate: rowTotal > 0 ? rowRewrites / rowTotal : 0,
        clarificationRate: rowTotal > 0 ? rowClarifications / rowTotal : 0,
        toolUsageRate: rowTotal > 0 ? rowUiTools / rowTotal : 0,
        avgLatencyMs: ai?.avgLatencyMs != null ? Math.round(Number(ai.avgLatencyMs)) : null,
        aiRequests: ai ? Number(ai.aiRequests) || 0 : 0,
        aiErrors: ai ? Number(ai.aiErrors) || 0 : 0,
        toolCalls: ai ? Number(ai.toolCalls) || 0 : 0,
      };
    });

    const reasonCounts = new Map<string, number>();
    for (const row of problemSupervisorRows) {
      for (const reason of String(row.reasons ?? "")
        .split(/\n|;|,|\|/)
        .map((item) => item.trim())
        .filter(Boolean)) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }
    const rewriteReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason: safeSnippet(reason, 120), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const problemConversations = [
      ...problemSupervisorRows.map((row) => ({
        id: `supervisor-${row.id}`,
        source: "supervisor",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: row.domain,
        intent: row.intent,
        score: row.scoreBefore,
        scoreAfter: row.scoreAfter,
        reason: safeSnippet(row.reasons, 180),
        snippet: safeSnippet(row.userMessage || row.draft || row.finalText, 180),
      })),
      ...negativeFeedbackRows.map((row) => ({
        id: `feedback-${row.id}`,
        source: "feedback",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: "feedback",
        intent: row.title ?? "session_feedback",
        score: null,
        scoreAfter: null,
        reason: safeSnippet(row.comment || "Feedback negativo", 180),
        snippet: `Sessione #${row.sessionId}, messaggio ${row.messageIndex}`,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt as Date).getTime() - new Date(a.createdAt as Date).getTime())
      .slice(0, limit);

    const alerts: Array<{ level: "attention" | "critical"; title: string; message: string; domain: string | null }> = [];
    if (avgScore != null && avgScore < 0.6) {
      alerts.push({ level: "critical", title: "Score qualita critico", message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 60%.`, domain: null });
    } else if (avgScore != null && avgScore < 0.75) {
      alerts.push({ level: "attention", title: "Score qualita in calo", message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 75%.`, domain: null });
    }
    if (rewriteRate > 0.3) {
      alerts.push({ level: "critical", title: "Rewrite rate alto", message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`, domain: null });
    } else if (rewriteRate > 0.15) {
      alerts.push({ level: "attention", title: "Rewrite rate da monitorare", message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`, domain: null });
    }
    if (clarificationRate > 0.2) {
      alerts.push({ level: "attention", title: "Troppe chiarificazioni", message: `${(clarificationRate * 100).toFixed(1)}% dei turni chiede chiarimenti.`, domain: null });
    }
    if (negativeFeedbackRate > 0.25 && negativeFeedback >= 3) {
      alerts.push({ level: "critical", title: "Feedback negativo alto", message: `${negativeFeedback} feedback negativi su ${feedbackTotal}.`, domain: null });
    }
    for (const domain of domains.filter((item) => item.status !== "healthy").slice(0, 5)) {
      alerts.push({
        level: domain.status === "critical" ? "critical" : "attention",
        title: `Dominio ${domain.domain} ${domain.status === "critical" ? "critico" : "debole"}`,
        message: `${domain.total} turni, rewrite ${(domain.rewriteRate * 100).toFixed(1)}%, chiarificazioni ${(domain.clarificationRate * 100).toFixed(1)}%.`,
        domain: domain.domain,
      });
    }

    writeAuditLog(req, {
      action: "admin_quality_overview_view",
      category: "admin_action",
      metadata: { days, total, alerts: alerts.length },
    });

    res.json({
      generatedAt: new Date().toISOString(),
      days,
      summary: {
        total,
        avgEvalScore: totals.avgEvalScore != null ? Number(totals.avgEvalScore) : null,
        avgSupervisorScore: totals.avgSupervisorScore != null ? Number(totals.avgSupervisorScore) : null,
        rewriteRate,
        clarificationRate,
        toolUsageRate,
        rewrites,
        clarifications,
        uiTools,
        avgResponseTimeMs: totals.avgResponseTimeMs != null ? Math.round(Number(totals.avgResponseTimeMs)) : null,
        supervisorRewriteCount: Number(supervisor.total) || 0,
        avgScoreBeforeRewrite: supervisor.avgScoreBefore != null ? Number(supervisor.avgScoreBefore) : null,
        avgScoreAfterRewrite: supervisor.avgScoreAfter != null ? Number(supervisor.avgScoreAfter) : null,
        feedbackTotal,
        negativeFeedback,
        positiveFeedback: Number(feedback.positive) || 0,
        negativeFeedbackRate,
      },
      trends,
      domains,
      problemConversations,
      rewriteReasons,
      alerts,
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/quality/overview] returning empty overview after read failure");
    res.json(emptyQualityOverview(days, "quality_overview_unavailable"));
  }
});

function metricToJson(metricName: string) {
  const m = register.getSingleMetric(metricName);
  if (!m) return null;
  const data = (m as any).get();
  return {
    name: data.name,
    help: data.help,
    type: data.type,
    values: data.values ?? [],
  };
}

router.get("/wendy-metrics", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const requests = metricToJson("wendy_requests_total");
    const latency = metricToJson("wendy_latency_seconds");
    const rewrites = metricToJson("wendy_supervisor_rewrites_total");
    const tokens = metricToJson("wendy_llm_tokens_total");
    const confidence = metricToJson("wendy_router_confidence_histogram");

    // Aggregate volume per domain from requests
    const volumeByDomain: Record<string, number> = {};
    if (requests?.values) {
      for (const v of requests.values) {
        const domain = v.labels?.domain ?? "unknown";
        volumeByDomain[domain] = (volumeByDomain[domain] ?? 0) + (v.value ?? 0);
      }
    }

    // Aggregate rewrite rate
    const totalRequests = Object.values(volumeByDomain).reduce((a, b) => a + b, 0);
    const totalRewrites = rewrites?.values?.reduce((s: number, v: any) => s + (v.value ?? 0), 0) ?? 0;
    const rewriteRate = totalRequests > 0 ? totalRewrites / totalRequests : 0;

    // Aggregate avg latency per phase from latency histogram
    const latencyByPhase: Record<string, { sum: number; count: number }> = {};
    if (latency?.values) {
      for (const v of latency.values) {
        const phase = v.labels?.phase ?? "unknown";
        if (!latencyByPhase[phase]) latencyByPhase[phase] = { sum: 0, count: 0 };
        // prometheus histograms have _sum and _count buckets
        if (v.metricName?.endsWith("_sum")) {
          latencyByPhase[phase].sum += v.value ?? 0;
        } else if (v.metricName?.endsWith("_count")) {
          latencyByPhase[phase].count += v.value ?? 0;
        }
      }
    }

    res.json({
      volumeByDomain,
      totalRequests,
      totalRewrites,
      rewriteRate,
      latencyByPhase,
      confidence,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/wendy-metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

async function ensureCatalogReferences(type: CatalogType, payload: Record<string, any>, entityId?: number | null) {
  const fields: Record<string, string> = {};

  if (type === "professions" && payload.sectorId) {
    const [sector] = await db
      .select({ id: sectorsTable.id })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, Number(payload.sectorId)))
      .limit(1);
    if (!sector) fields.sectorId = "Settore collegato inesistente.";
  }

  if (type === "education_paths" && payload.professionIds?.length) {
    for (const professionId of payload.professionIds as number[]) {
      const [profession] = await db
        .select({ id: professionsTable.id })
        .from(professionsTable)
        .where(eq(professionsTable.id, professionId))
        .limit(1);
      if (!profession) {
        fields.professionIds = `Professione ${professionId} inesistente.`;
        break;
      }
    }
  }

  if (type === "growth_articles" && payload.slug) {
    const conditions = [eq(growthArticlesTable.slug, String(payload.slug))];
    if (entityId) conditions.push(ne(growthArticlesTable.id, entityId));
    const [existing] = await db
      .select({ id: growthArticlesTable.id })
      .from(growthArticlesTable)
      .where(and(...conditions))
      .limit(1);
    if (existing) fields.slug = "Slug gia usato da un altro articolo.";
  }

  return fields;
}

async function getCatalogRows(type: CatalogType, limit: number, query: string, status: string) {
  const search = `%${query}%`;

  if (type === "sectors") {
    const where = [
      status === "archived" ? eq(sectorsTable.isActive, false) : status === "active" ? eq(sectorsTable.isActive, true) : undefined,
      query ? or(ilike(sectorsTable.name, search), ilike(sectorsTable.description, search)) : undefined,
    ].filter(Boolean) as any[];
    return db
      .select()
      .from(sectorsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(sectorsTable.name))
      .limit(limit);
  }

  if (type === "professions") {
    const where = [
      status === "archived" ? eq(professionsTable.isActive, false) : status === "active" ? eq(professionsTable.isActive, true) : undefined,
      query ? or(ilike(professionsTable.title, search), ilike(professionsTable.description, search)) : undefined,
    ].filter(Boolean) as any[];
    return db
      .select()
      .from(professionsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(professionsTable.title))
      .limit(limit);
  }

  if (type === "education_paths") {
    const where = [
      status === "archived" ? eq(educationPathsTable.isActive, false) : status === "active" ? eq(educationPathsTable.isActive, true) : undefined,
      query ? ilike(educationPathsTable.path, search) : undefined,
    ].filter(Boolean) as any[];
    return db
      .select()
      .from(educationPathsTable)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(educationPathsTable.path))
      .limit(limit);
  }

  const where = [
    status !== "all" ? eq(growthArticlesTable.status, status) : undefined,
    query ? or(ilike(growthArticlesTable.title, search), ilike(growthArticlesTable.description, search)) : undefined,
  ].filter(Boolean) as any[];
  return db
    .select()
    .from(growthArticlesTable)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(growthArticlesTable.updatedAt))
    .limit(limit);
}

async function getCatalogEntity(type: CatalogType, id: number) {
  if (type === "sectors") {
    const [row] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, id)).limit(1);
    return row ?? null;
  }
  if (type === "professions") {
    const [row] = await db.select().from(professionsTable).where(eq(professionsTable.id, id)).limit(1);
    return row ?? null;
  }
  if (type === "education_paths") {
    const [row] = await db.select().from(educationPathsTable).where(eq(educationPathsTable.id, id)).limit(1);
    if (!row) return null;
    const links = await db
      .select({ professionId: professionEducationPathsTable.professionId })
      .from(professionEducationPathsTable)
      .where(eq(professionEducationPathsTable.educationPathId, id));
    return { ...row, professionIds: links.map((link) => link.professionId) };
  }
  const [row] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
  return row ?? null;
}

async function findPublishDraft(type: CatalogType, id: number) {
  const [draftById] = await db
    .select()
    .from(adminCatalogDraftsTable)
    .where(and(eq(adminCatalogDraftsTable.catalogType, type), eq(adminCatalogDraftsTable.id, id), eq(adminCatalogDraftsTable.status, "draft")))
    .limit(1);
  if (draftById) return draftById;

  const [draftByEntity] = await db
    .select()
    .from(adminCatalogDraftsTable)
    .where(and(eq(adminCatalogDraftsTable.catalogType, type), eq(adminCatalogDraftsTable.entityId, id), eq(adminCatalogDraftsTable.status, "draft")))
    .orderBy(desc(adminCatalogDraftsTable.updatedAt))
    .limit(1);
  return draftByEntity ?? null;
}

function previewCatalogPayload(type: CatalogType, payload: Record<string, any>) {
  if (type === "sectors") {
    return {
      title: payload.name,
      subtitle: `${payload.trend} · +${payload.growthRate}% crescita`,
      description: payload.description,
      url: payload.id ? `/settore/${payload.id}` : "/settori",
      badges: [payload.automationRisk, ...(payload.riasecTypes ?? [])].filter(Boolean),
    };
  }
  if (type === "professions") {
    return {
      title: payload.title,
      subtitle: payload.sector,
      description: payload.description,
      url: payload.id ? `/ruolo/${payload.id}` : "/ruoli",
      badges: [payload.salaryRange, payload.growthOutlook].filter(Boolean),
    };
  }
  if (type === "education_paths") {
    return {
      title: payload.path,
      subtitle: `${payload.type} · ${payload.duration}`,
      description: `${payload.cost} · ${(payload.careerOutcomes ?? []).slice(0, 2).join(", ")}`,
      url: "/percorso",
      badges: payload.sectorFit ?? [],
    };
  }
  return {
    title: payload.title,
    subtitle: `${payload.category} · ${payload.readTimeMinutes} min`,
    description: payload.description,
    url: payload.slug ? `/crescita/articolo/${payload.slug}` : "/crescita",
    badges: [payload.difficulty, payload.status, ...(payload.tags ?? []).slice(0, 3)].filter(Boolean),
  };
}

async function publishCatalogDraft(type: CatalogType, draft: typeof adminCatalogDraftsTable.$inferSelect) {
  const payload = draft.payload as Record<string, any>;
  const now = new Date();

  if (type === "sectors") {
    const values = { ...payload, updatedAt: now } as typeof sectorsTable.$inferInsert;
    if (draft.entityId) {
      const [row] = await db.update(sectorsTable).set(values).where(eq(sectorsTable.id, draft.entityId)).returning();
      return row;
    }
    const [row] = await db.insert(sectorsTable).values(values).returning();
    return row;
  }

  if (type === "professions") {
    const values = { ...payload, updatedAt: now } as typeof professionsTable.$inferInsert;
    if (draft.entityId) {
      const [row] = await db.update(professionsTable).set(values).where(eq(professionsTable.id, draft.entityId)).returning();
      return row;
    }
    const [row] = await db.insert(professionsTable).values(values).returning();
    return row;
  }

  if (type === "education_paths") {
    const { professionIds, ...pathValues } = payload;
    const values = { ...pathValues, updatedAt: now } as typeof educationPathsTable.$inferInsert;
    const row = draft.entityId
      ? (await db.update(educationPathsTable).set(values).where(eq(educationPathsTable.id, draft.entityId)).returning())[0]
      : (await db.insert(educationPathsTable).values(values).returning())[0];
    if (row) {
      await db
        .delete(professionEducationPathsTable)
        .where(eq(professionEducationPathsTable.educationPathId, row.id));
      if (Array.isArray(professionIds) && professionIds.length > 0) {
        await db.insert(professionEducationPathsTable).values(
          professionIds.map((professionId: number) => ({
            professionId,
            educationPathId: row.id,
          })),
        );
      }
    }
    return row;
  }

  const values = { ...payload, updatedAt: now } as typeof growthArticlesTable.$inferInsert;
  if (draft.entityId) {
    const [row] = await db.update(growthArticlesTable).set(values).where(eq(growthArticlesTable.id, draft.entityId)).returning();
    return row;
  }
  const [row] = await db.insert(growthArticlesTable).values(values).returning();
  return row;
}

router.get("/catalogs/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const [
      sectorsTotal,
      sectorsArchived,
      professionsTotal,
      professionsArchived,
      pathsTotal,
      pathsArchived,
      articlesTotal,
      articlesPublished,
      articlesArchived,
      draftRows,
    ] = await Promise.all([
      db.select({ count: count() }).from(sectorsTable),
      db.select({ count: count() }).from(sectorsTable).where(eq(sectorsTable.isActive, false)),
      db.select({ count: count() }).from(professionsTable),
      db.select({ count: count() }).from(professionsTable).where(eq(professionsTable.isActive, false)),
      db.select({ count: count() }).from(educationPathsTable),
      db.select({ count: count() }).from(educationPathsTable).where(eq(educationPathsTable.isActive, false)),
      db.select({ count: count() }).from(growthArticlesTable),
      db.select({ count: count() }).from(growthArticlesTable).where(eq(growthArticlesTable.status, "published")),
      db.select({ count: count() }).from(growthArticlesTable).where(eq(growthArticlesTable.status, "archived")),
      db
        .select({ catalogType: adminCatalogDraftsTable.catalogType, count: count() })
        .from(adminCatalogDraftsTable)
        .where(eq(adminCatalogDraftsTable.status, "draft"))
        .groupBy(adminCatalogDraftsTable.catalogType),
    ]);

    const draftCounts = Object.fromEntries(draftRows.map((row) => [row.catalogType, Number(row.count)]));
    res.json({
      generatedAt: new Date().toISOString(),
      items: [
        { type: "sectors", label: CATALOG_LABELS.sectors, total: Number(sectorsTotal[0]?.count ?? 0), active: Number(sectorsTotal[0]?.count ?? 0) - Number(sectorsArchived[0]?.count ?? 0), archived: Number(sectorsArchived[0]?.count ?? 0), drafts: draftCounts.sectors ?? 0 },
        { type: "professions", label: CATALOG_LABELS.professions, total: Number(professionsTotal[0]?.count ?? 0), active: Number(professionsTotal[0]?.count ?? 0) - Number(professionsArchived[0]?.count ?? 0), archived: Number(professionsArchived[0]?.count ?? 0), drafts: draftCounts.professions ?? 0 },
        { type: "education_paths", label: CATALOG_LABELS.education_paths, total: Number(pathsTotal[0]?.count ?? 0), active: Number(pathsTotal[0]?.count ?? 0) - Number(pathsArchived[0]?.count ?? 0), archived: Number(pathsArchived[0]?.count ?? 0), drafts: draftCounts.education_paths ?? 0 },
        { type: "growth_articles", label: CATALOG_LABELS.growth_articles, total: Number(articlesTotal[0]?.count ?? 0), active: Number(articlesPublished[0]?.count ?? 0), archived: Number(articlesArchived[0]?.count ?? 0), drafts: draftCounts.growth_articles ?? 0 },
      ],
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/catalogs/overview] returning empty overview after read failure");
    res.json(emptyCatalogOverview("catalogs_overview_unavailable"));
  }
});

router.get("/catalogs/:type", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  if (!CATALOG_TYPES.includes(type)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }

  try {
    const limit = getLimit(req, 100, 500);
    const query = stringValue(req.query.search);
    const status = stringValue(req.query.status, "all");
    const [items, drafts] = await Promise.all([
      getCatalogRows(type, limit, query, status),
      db
        .select()
        .from(adminCatalogDraftsTable)
        .where(and(eq(adminCatalogDraftsTable.catalogType, type), eq(adminCatalogDraftsTable.status, "draft")))
        .orderBy(desc(adminCatalogDraftsTable.updatedAt))
        .limit(100),
    ]);
    res.json({ type, label: CATALOG_LABELS[type], items, drafts });
  } catch (err) {
    rootLogger.warn({ err, type }, "[admin/catalogs] returning empty list after read failure");
    res.json(emptyCatalogList(type, "catalog_list_unavailable"));
  }
});

router.get("/catalogs/:type/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  const id = Number(req.params.id);
  if (!CATALOG_TYPES.includes(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }

  try {
    const [entity, drafts, auditTrail] = await Promise.all([
      getCatalogEntity(type, id),
      db
        .select()
        .from(adminCatalogDraftsTable)
        .where(and(eq(adminCatalogDraftsTable.catalogType, type), eq(adminCatalogDraftsTable.entityId, id)))
        .orderBy(desc(adminCatalogDraftsTable.updatedAt))
        .limit(20),
      db
        .select()
        .from(auditLogTable)
        .where(and(eq(auditLogTable.category, "admin_action"), sql`${auditLogTable.metadata}->>'catalogType' = ${type}`, sql`${auditLogTable.metadata}->>'entityId' = ${String(id)}`))
        .orderBy(desc(auditLogTable.createdAt))
        .limit(20),
    ]);
    if (!entity) {
      res.status(404).json({ error: "Elemento non trovato" });
      return;
    }
    res.json({ type, entity, drafts, auditTrail });
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] detail error");
    res.status(500).json({ error: String(err) });
  }
});

async function saveCatalogDraft(req: Request, res: Response, type: CatalogType, entityId: number | null) {
  const basePayload = req.body?.payload ?? req.body;
  const validation = validateCatalogPayload(type, basePayload);
  const referenceFields = validation.ok
    ? await ensureCatalogReferences(type, validation.payload, entityId)
    : {};
  const fields = { ...validation.fields, ...referenceFields };
  if (Object.keys(fields).length > 0) {
    res.status(400).json({ error: "Payload catalogo non valido", fields });
    return;
  }

  const [draft] = await db
    .insert(adminCatalogDraftsTable)
    .values({
      catalogType: type,
      entityId,
      payload: validation.payload,
      validation: { ok: true, fields: {} },
      notes: stringValue(req.body?.notes) || null,
      createdBy: req.user?.id ?? null,
      updatedAt: new Date(),
    })
    .returning();

  await writeCatalogAudit(req, "catalog_draft_saved", type, {
    draftId: draft.id,
    entityId,
    notes: draft.notes,
  });
  res.status(201).json({ ok: true, draft, preview: previewCatalogPayload(type, validation.payload) });
}

router.post("/catalogs/:type/draft", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  if (!CATALOG_TYPES.includes(type)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }
  try {
    await saveCatalogDraft(req, res, type, null);
  } catch (err) {
    rootLogger.error({ err, type }, "[admin/catalogs] create draft error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/catalogs/:type/:id/draft", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  const id = Number(req.params.id);
  if (!CATALOG_TYPES.includes(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }
  try {
    const entity = await getCatalogEntity(type, id);
    if (!entity) {
      res.status(404).json({ error: "Elemento non trovato" });
      return;
    }
    await saveCatalogDraft(req, res, type, id);
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] update draft error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/catalogs/:type/preview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  if (!CATALOG_TYPES.includes(type)) {
    res.status(404).json({ error: "Catalogo non supportato" });
    return;
  }
  const validation = validateCatalogPayload(type, req.body?.payload ?? req.body);
  if (!validation.ok) {
    res.status(400).json({ error: "Payload catalogo non valido", fields: validation.fields });
    return;
  }
  res.json({ ok: true, payload: validation.payload, preview: previewCatalogPayload(type, validation.payload) });
});

router.post("/catalogs/:type/:id/publish", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  const id = Number(req.params.id);
  if (!CATALOG_TYPES.includes(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }

  try {
    const draft = await findPublishDraft(type, id);
    if (!draft) {
      res.status(404).json({ error: "Bozza pubblicabile non trovata" });
      return;
    }
    const validation = validateCatalogPayload(type, draft.payload);
    const referenceFields = validation.ok
      ? await ensureCatalogReferences(type, validation.payload, draft.entityId)
      : {};
    const fields = { ...validation.fields, ...referenceFields };
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Bozza non valida", fields });
      return;
    }
    const entity = await publishCatalogDraft(type, draft);
    await db
      .update(adminCatalogDraftsTable)
      .set({
        status: "published",
        entityId: entity?.id ?? draft.entityId,
        payload: validation.payload,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminCatalogDraftsTable.id, draft.id));
    await writeCatalogAudit(req, "catalog_published", type, {
      draftId: draft.id,
      entityId: entity?.id ?? draft.entityId,
      notes: stringValue(req.body?.notes) || draft.notes,
    });
    res.json({ ok: true, entity, draftId: draft.id });
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] publish error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/catalogs/:type/:id/archive", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  const id = Number(req.params.id);
  if (!CATALOG_TYPES.includes(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }

  try {
    let entity: unknown = null;
    if (type === "sectors") entity = (await db.update(sectorsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(sectorsTable.id, id)).returning())[0];
    if (type === "professions") entity = (await db.update(professionsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(professionsTable.id, id)).returning())[0];
    if (type === "education_paths") entity = (await db.update(educationPathsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(educationPathsTable.id, id)).returning())[0];
    if (type === "growth_articles") entity = (await db.update(growthArticlesTable).set({ status: "archived", updatedAt: new Date() }).where(eq(growthArticlesTable.id, id)).returning())[0];
    if (!entity) {
      res.status(404).json({ error: "Elemento non trovato" });
      return;
    }
    await writeCatalogAudit(req, "catalog_archived", type, { entityId: id, notes: stringValue(req.body?.notes) || null });
    res.json({ ok: true, entity });
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] archive error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/catalogs/:type/:id/restore", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const type = req.params.type as CatalogType;
  const id = Number(req.params.id);
  if (!CATALOG_TYPES.includes(type) || !Number.isFinite(id)) {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }

  try {
    let entity: unknown = null;
    if (type === "sectors") entity = (await db.update(sectorsTable).set({ isActive: true, updatedAt: new Date() }).where(eq(sectorsTable.id, id)).returning())[0];
    if (type === "professions") entity = (await db.update(professionsTable).set({ isActive: true, updatedAt: new Date() }).where(eq(professionsTable.id, id)).returning())[0];
    if (type === "education_paths") entity = (await db.update(educationPathsTable).set({ isActive: true, updatedAt: new Date() }).where(eq(educationPathsTable.id, id)).returning())[0];
    if (type === "growth_articles") entity = (await db.update(growthArticlesTable).set({ status: "published", updatedAt: new Date() }).where(eq(growthArticlesTable.id, id)).returning())[0];
    if (!entity) {
      res.status(404).json({ error: "Elemento non trovato" });
      return;
    }
    await writeCatalogAudit(req, "catalog_restored", type, { entityId: id, notes: stringValue(req.body?.notes) || null });
    res.json({ ok: true, entity });
  } catch (err) {
    rootLogger.error({ err, type, id }, "[admin/catalogs] restore error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agent-health", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        agentName: agentRunsTable.agentName,
        totalCalls30d: sql<number>`count(*)::int`,
        errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'failed')::int`,
        avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
      })
      .from(agentRunsTable)
      .where(gte(agentRunsTable.startedAt, since))
      .groupBy(agentRunsTable.agentName)
      .orderBy(agentRunsTable.agentName);

    res.json({
      generatedAt: new Date().toISOString(),
      agents: rows.map((row) => {
        const total = Number(row.totalCalls30d) || 0;
        const errors = Number(row.errorCount30d) || 0;
        const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
        return {
          agentName: row.agentName,
          totalCalls30d: total,
          errorCount30d: errors,
          avgDurationMs: row.avgDurationMs ?? null,
          successRate30d: successRate,
          status: successRate >= 95 ? "healthy" : successRate >= 80 ? "degraded" : "critical",
        };
      }),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/agent-health] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agents/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));

  try {
    const limit = getLimit(req, 100, 200);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      agentRows,
      recentRuns,
      recentErrors,
      llmCostRows,
      llmProviderRows,
      aiRequestRows,
    ] = await Promise.all([
      db
        .select({
          agentName: agentRunsTable.agentName,
          totalCalls: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'completed')::int`,
          running: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'running')::int`,
          errorCount: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
          avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
          lastRunAt: sql<Date>`max(${agentRunsTable.startedAt})`,
          lastErrorAt: sql<Date>`max(${agentRunsTable.startedAt}) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))`,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since))
        .groupBy(agentRunsTable.agentName)
        .orderBy(agentRunsTable.agentName),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          userId: agentRunsTable.userId,
          taskType: agentRunsTable.taskType,
          inputSummary: agentRunsTable.inputSummary,
          outputSummary: agentRunsTable.outputSummary,
          status: agentRunsTable.status,
          startedAt: agentRunsTable.startedAt,
          finishedAt: agentRunsTable.finishedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          createdAt: agentRunsTable.createdAt,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since))
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(limit),
      db
        .select({
          id: agentRunsTable.id,
          agentName: agentRunsTable.agentName,
          taskType: agentRunsTable.taskType,
          startedAt: agentRunsTable.startedAt,
          durationMs: agentRunsTable.durationMs,
          errorMessage: agentRunsTable.errorMessage,
          status: agentRunsTable.status,
        })
        .from(agentRunsTable)
        .where(and(gte(agentRunsTable.startedAt, since), sql`${agentRunsTable.status} in ('failed', 'cancelled')`))
        .orderBy(desc(agentRunsTable.startedAt))
        .limit(Math.min(limit, 50)),
      db
        .select({
          estimatedCostUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
          totalTokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
          promptTokens: sql<number>`coalesce(sum(${llmUsageTable.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${llmUsageTable.completionTokens}), 0)::int`,
          requestCount: sql<number>`count(*)::int`,
        })
        .from(llmUsageTable)
        .where(gte(llmUsageTable.createdAt, since)),
      db
        .select({
          provider: llmUsageTable.provider,
          costUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
          tokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(llmUsageTable)
        .where(gte(llmUsageTable.createdAt, since))
        .groupBy(llmUsageTable.provider)
        .orderBy(sql`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0) desc`),
      db
        .select({
          aiRequestCostUsd: sql<number>`coalesce(sum(${aiRequestLogTable.costUsdEst}), 0)`,
          aiRequestTokens: sql<number>`coalesce(sum(${aiRequestLogTable.inputTokens} + ${aiRequestLogTable.outputTokens}), 0)::int`,
          aiRequests: sql<number>`count(*)::int`,
          aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
        })
        .from(aiRequestLogTable)
        .where(gte(aiRequestLogTable.createdAt, since)),
    ]);

    const agents = agentRows.map((row) => {
      const total = Number(row.totalCalls) || 0;
      const errors = Number(row.errorCount) || 0;
      const errorRate = total > 0 ? errors / total : 0;
      const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
      const status = errorRate > 0.2 ? "critical" : errorRate >= 0.05 ? "degraded" : "healthy";
      return {
        agentName: row.agentName,
        totalCalls30d: total,
        completed30d: Number(row.completed) || 0,
        running30d: Number(row.running) || 0,
        errorCount30d: errors,
        errorRate30d: Math.round(errorRate * 100),
        successRate30d: successRate,
        avgDurationMs: row.avgDurationMs ?? null,
        lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
        lastErrorAt: row.lastErrorAt ? row.lastErrorAt.toISOString() : null,
        status,
      };
    });

    const totalRuns = agents.reduce((sum, agent) => sum + agent.totalCalls30d, 0);
    const failedRuns = agents.reduce((sum, agent) => sum + agent.errorCount30d, 0);
    const runningRuns = agents.reduce((sum, agent) => sum + agent.running30d, 0);
    const avgDurationValues = agents
      .map((agent) => agent.avgDurationMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const avgDurationMs =
      avgDurationValues.length > 0
        ? Math.round(avgDurationValues.reduce((sum, value) => sum + value, 0) / avgDurationValues.length)
        : null;
    const llmCosts = llmCostRows[0] ?? {
      estimatedCostUsd: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
    };
    const aiRequests = aiRequestRows[0] ?? {
      aiRequestCostUsd: 0,
      aiRequestTokens: 0,
      aiRequests: 0,
      aiErrors: 0,
    };
    const llmCost = Number(llmCosts.estimatedCostUsd) || 0;
    const aiRequestCost = Number(aiRequests.aiRequestCostUsd) || 0;

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalRuns,
        totalAgents: agents.length,
        successRate30d: totalRuns > 0 ? Math.round(((totalRuns - failedRuns) / totalRuns) * 100) : 100,
        avgDurationMs,
        failedRuns,
        runningRuns,
        degradedAgents: agents.filter((agent) => agent.status === "degraded").length,
        criticalAgents: agents.filter((agent) => agent.status === "critical").length,
        costUsd30d: Math.max(llmCost, aiRequestCost),
        totalTokens30d: Math.max(Number(llmCosts.totalTokens) || 0, Number(aiRequests.aiRequestTokens) || 0),
        aiRequests30d: Math.max(Number(llmCosts.requestCount) || 0, Number(aiRequests.aiRequests) || 0),
        aiErrors30d: Number(aiRequests.aiErrors) || 0,
      },
      agents,
      recentRuns,
      recentErrors,
      costs: {
        days,
        estimatedCostUsd: llmCost,
        totalTokens: Number(llmCosts.totalTokens) || 0,
        promptTokens: Number(llmCosts.promptTokens) || 0,
        completionTokens: Number(llmCosts.completionTokens) || 0,
        requestCount: Number(llmCosts.requestCount) || 0,
        aiRequestCostUsd: aiRequestCost,
        aiRequestTokens: Number(aiRequests.aiRequestTokens) || 0,
        aiRequestCount: Number(aiRequests.aiRequests) || 0,
        aiErrorCount: Number(aiRequests.aiErrors) || 0,
        byProvider: llmProviderRows.map((row) => ({
          provider: row.provider,
          costUsd: Number(row.costUsd) || 0,
          tokens: Number(row.tokens) || 0,
          requests: Number(row.requests) || 0,
        })),
      },
      runnableAgents: RUNNABLE_AGENTS,
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/agents/overview] returning empty overview after read failure");
    res.json(emptyAgentsOverview(days, "agents_overview_unavailable"));
  }
});

router.get("/memory-graph/overview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const userId = typeof req.query.userId === "string" ? Number(req.query.userId) : undefined;
    const health = await getMemoryGraphHealth(Number.isFinite(userId) ? userId : undefined);

    const candidateEdges = await db
      .select({
        id: knowledgeEdgesTable.id,
        userId: knowledgeEdgesTable.userId,
        sourceId: knowledgeEdgesTable.sourceId,
        targetId: knowledgeEdgesTable.targetId,
        label: knowledgeEdgesTable.label,
        relationType: knowledgeEdgesTable.relationType,
        confidence: knowledgeEdgesTable.confidence,
        reason: knowledgeEdgesTable.reason,
        createdAt: knowledgeEdgesTable.createdAt,
      })
      .from(knowledgeEdgesTable)
      .where(eq(knowledgeEdgesTable.status, "candidate"))
      .orderBy(desc(knowledgeEdgesTable.createdAt))
      .limit(50);

    const nodeIds = Array.from(new Set(candidateEdges.flatMap((edge) => [edge.sourceId, edge.targetId])));
    const nodes = nodeIds.length
      ? await db
          .select({
            id: knowledgeNodesTable.id,
            title: knowledgeNodesTable.title,
            type: knowledgeNodesTable.type,
            sourceType: knowledgeNodesTable.sourceType,
            confidence: knowledgeNodesTable.confidence,
            status: knowledgeNodesTable.status,
          })
          .from(knowledgeNodesTable)
          .where(inArray(knowledgeNodesTable.id, nodeIds))
      : [];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    const sourceBreakdown = await db.execute<{ source_type: string; count: string }>(sql`
      SELECT source_type, count(*)::text AS count
      FROM knowledge_nodes
      GROUP BY source_type
      ORDER BY count(*) DESC
      LIMIT 12
    `);

    res.json({
      generatedAt: new Date().toISOString(),
      health,
      sourceBreakdown: sourceBreakdown.rows.map((row) => ({
        sourceType: row.source_type,
        count: Number(row.count),
      })),
      candidateRelations: candidateEdges.map((edge) => ({
        ...edge,
        source: nodesById.get(edge.sourceId) ?? null,
        target: nodesById.get(edge.targetId) ?? null,
      })),
      controls: [
        { key: "backfill_user", label: "Backfill utente", description: "Crea o aggiorna il grafo memoria di un utente." },
        { key: "approve_relation", label: "Approva relazione", description: "Promuove una relazione candidate ad active." },
        { key: "reject_relation", label: "Rifiuta relazione", description: "Marca una relazione candidate come rejected." },
      ],
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/memory-graph/overview] error");
    res.status(500).json({ error: "Memory graph non disponibile" });
  }
});

router.post("/memory-graph/backfill-user", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const userId = Number(req.body?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "userId obbligatorio" });
    return;
  }

  try {
    const result = await ingestUserMemoryGraph(userId);
    await writeAuditLog(req, {
      action: "admin_memory_graph_backfill_user",
      category: "admin_action",
      targetId: userId,
      metadata: result,
    });
    res.json(result);
  } catch (err) {
    rootLogger.error({ err, userId }, "[admin/memory-graph/backfill-user] error");
    res.status(500).json({ error: "Backfill memoria non riuscito" });
  }
});

router.post("/memory-graph/relations/:id/approve", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID relazione non valido" });
    return;
  }

  try {
    const [edge] = await db
      .update(knowledgeEdgesTable)
      .set({ status: "active", updatedAt: new Date(), metadata: sql`metadata || ${JSON.stringify({ approvedBy: req.user?.id, approvedAt: new Date().toISOString() })}::jsonb` as any })
      .where(eq(knowledgeEdgesTable.id, id))
      .returning();
    if (!edge) {
      res.status(404).json({ error: "Relazione non trovata" });
      return;
    }
    await writeAuditLog(req, {
      action: "admin_memory_relation_approved",
      category: "admin_action",
      targetId: edge.userId,
      metadata: { edgeId: edge.id, sourceId: edge.sourceId, targetId: edge.targetId },
    });
    res.json({ ok: true, edge });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/memory-graph/relations/approve] error");
    res.status(500).json({ error: "Approvazione relazione non riuscita" });
  }
});

router.post("/memory-graph/relations/:id/reject", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "ID relazione non valido" });
    return;
  }

  try {
    const [edge] = await db
      .update(knowledgeEdgesTable)
      .set({
        status: "rejected",
        reason: reason || null,
        updatedAt: new Date(),
        metadata: sql`metadata || ${JSON.stringify({ rejectedBy: req.user?.id, rejectedAt: new Date().toISOString(), reason })}::jsonb` as any,
      })
      .where(eq(knowledgeEdgesTable.id, id))
      .returning();
    if (!edge) {
      res.status(404).json({ error: "Relazione non trovata" });
      return;
    }
    await writeAuditLog(req, {
      action: "admin_memory_relation_rejected",
      category: "admin_action",
      targetId: edge.userId,
      metadata: { edgeId: edge.id, sourceId: edge.sourceId, targetId: edge.targetId, reason },
    });
    res.json({ ok: true, edge });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/memory-graph/relations/reject] error");
    res.status(500).json({ error: "Rifiuto relazione non riuscito" });
  }
});

type AdminSubscriptionRow = {
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_at: Date;
  user_stripe_subscription_id: string | null;
  subscription_id: number | null;
  plan: AdminSubscriptionPlan | null;
  valid_until: Date | null;
  cancelled_at: Date | null;
  subscription_created_at: Date | null;
  subscription_updated_at: Date | null;
  stripe_subscription_id: string | null;
  last_subscription_id: number | null;
  last_cancelled_at: Date | null;
  total_count: string | number;
};

function adminSubscriptionItem(row: AdminSubscriptionRow) {
  const current = {
    id: row.subscription_id,
    plan: effectivePlan({
      id: row.subscription_id,
      plan: row.plan,
      validUntil: row.valid_until,
      cancelledAt: row.cancelled_at,
    }),
    rawPlan: row.plan,
    status: subscriptionStatus({
      id: row.subscription_id,
      validUntil: row.valid_until,
      cancelledAt: row.cancelled_at ?? row.last_cancelled_at,
    }),
    source: row.subscription_id
      ? (row.stripe_subscription_id ? "stripe" : "internal")
      : "free",
    validUntil: toIso(row.valid_until),
    cancelledAt: toIso(row.cancelled_at) ?? toIso(row.last_cancelled_at),
    createdAt: toIso(row.subscription_created_at),
    updatedAt: toIso(row.subscription_updated_at),
    hasStripeSubscription: Boolean(row.stripe_subscription_id || row.user_stripe_subscription_id),
    stripeSubscriptionId: maskStripeId(row.stripe_subscription_id ?? row.user_stripe_subscription_id),
  };

  return {
    user: {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: toIso(row.created_at),
    },
    current,
  };
}

async function getAdminSubscriptionDetail(userId: number) {
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      isPremium: usersTable.isPremium,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
    .limit(1);

  if (!user) return null;

  const history = await db
    .select({
      id: subscriptionsTable.id,
      plan: subscriptionsTable.plan,
      validUntil: subscriptionsTable.validUntil,
      cancelledAt: subscriptionsTable.cancelledAt,
      stripeSubscriptionId: subscriptionsTable.stripeSubscriptionId,
      createdAt: subscriptionsTable.createdAt,
      updatedAt: subscriptionsTable.updatedAt,
    })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(20);

  const current = history.find((row) => !row.cancelledAt) ?? null;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: toIso(user.createdAt),
    },
    current: {
      id: current?.id ?? null,
      plan: effectivePlan(current),
      rawPlan: current?.plan ?? null,
      status: current
        ? subscriptionStatus(current)
        : history[0]?.cancelledAt
          ? "cancelled"
          : "free",
      source: current ? (current.stripeSubscriptionId ? "stripe" : "internal") : "free",
      validUntil: toIso(current?.validUntil),
      cancelledAt: toIso(current?.cancelledAt) ?? toIso(history[0]?.cancelledAt),
      createdAt: toIso(current?.createdAt),
      updatedAt: toIso(current?.updatedAt),
      hasStripeSubscription: Boolean(current?.stripeSubscriptionId || user.stripeSubscriptionId),
      stripeSubscriptionId: maskStripeId(current?.stripeSubscriptionId ?? user.stripeSubscriptionId),
    },
    history: history.map((row) => ({
      id: row.id,
      plan: row.plan,
      effectivePlan: effectivePlan(row),
      status: subscriptionStatus(row),
      source: row.stripeSubscriptionId ? "stripe" : "internal",
      validUntil: toIso(row.validUntil),
      cancelledAt: toIso(row.cancelledAt),
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
      updatedAt: toIso(row.updatedAt) ?? toIso(row.createdAt) ?? new Date().toISOString(),
      hasStripeSubscription: Boolean(row.stripeSubscriptionId),
      stripeSubscriptionId: maskStripeId(row.stripeSubscriptionId),
    })),
  };
}

router.get("/subscriptions", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const limit = getLimit(req, 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const query = stringValue(req.query.search);
    const plan = stringValue(req.query.plan, "all");
    const status = stringValue(req.query.status, "all");
    const whereParts = [sql`u.deleted_at IS NULL`];

    if (query) {
      const pattern = `%${query}%`;
      whereParts.push(sql`(u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})`);
    }
    if (isSubscriptionPlan(plan) && plan !== "free") {
      whereParts.push(sql`active_sub.id IS NOT NULL AND active_sub.plan = ${plan} AND (active_sub.valid_until IS NULL OR active_sub.valid_until >= now())`);
    } else if (plan === "free") {
      whereParts.push(sql`(active_sub.id IS NULL OR active_sub.plan = 'free' OR active_sub.valid_until < now())`);
    }
    if (status === "active") {
      whereParts.push(sql`active_sub.id IS NOT NULL AND (active_sub.valid_until IS NULL OR active_sub.valid_until >= now())`);
    } else if (status === "expired") {
      whereParts.push(sql`active_sub.id IS NOT NULL AND active_sub.valid_until < now()`);
    } else if (status === "cancelled") {
      whereParts.push(sql`active_sub.id IS NULL AND latest_sub.cancelled_at IS NOT NULL`);
    } else if (status === "free") {
      whereParts.push(sql`active_sub.id IS NULL`);
    }

    const whereSql = sql.join(whereParts, sql` AND `);
    const rows = await db.execute<AdminSubscriptionRow>(sql`
      WITH active_sub AS (
        SELECT DISTINCT ON (user_id)
          id, user_id, plan, valid_until, cancelled_at, created_at, updated_at, stripe_subscription_id
        FROM subscriptions
        WHERE cancelled_at IS NULL
        ORDER BY user_id, created_at DESC
      ),
      latest_sub AS (
        SELECT DISTINCT ON (user_id)
          id, user_id, cancelled_at
        FROM subscriptions
        ORDER BY user_id, created_at DESC
      ),
      filtered AS (
        SELECT
          u.id AS user_id,
          u.name,
          u.email,
          u.role,
          u.created_at,
          u.stripe_subscription_id AS user_stripe_subscription_id,
          active_sub.id AS subscription_id,
          active_sub.plan,
          active_sub.valid_until,
          active_sub.cancelled_at,
          active_sub.created_at AS subscription_created_at,
          active_sub.updated_at AS subscription_updated_at,
          active_sub.stripe_subscription_id,
          latest_sub.id AS last_subscription_id,
          latest_sub.cancelled_at AS last_cancelled_at
        FROM users u
        LEFT JOIN active_sub ON active_sub.user_id = u.id
        LEFT JOIN latest_sub ON latest_sub.user_id = u.id
        WHERE ${whereSql}
      )
      SELECT *, count(*) OVER() AS total_count
      FROM filtered
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const items = rows.rows.map(adminSubscriptionItem);
    const total = rows.rows.length ? Number(rows.rows[0].total_count) || 0 : 0;
    const statsRows = await db.execute<{ plan: string; count: string }>(sql`
      WITH active_sub AS (
        SELECT DISTINCT ON (user_id) id, user_id, plan, valid_until, cancelled_at, created_at
        FROM subscriptions
        WHERE cancelled_at IS NULL
        ORDER BY user_id, created_at DESC
      )
      SELECT
        CASE
          WHEN active_sub.id IS NULL OR active_sub.valid_until < now() THEN 'free'
          ELSE active_sub.plan
        END AS plan,
        count(*)::text AS count
      FROM users u
      LEFT JOIN active_sub ON active_sub.user_id = u.id
      WHERE u.deleted_at IS NULL
      GROUP BY 1
    `);
    const stats = { total: 0, free: 0, pro: 0, team: 0 };
    for (const row of statsRows.rows) {
      if (row.plan === "free" || row.plan === "pro" || row.plan === "team") {
        stats[row.plan] = Number(row.count) || 0;
      }
    }
    stats.total = stats.free + stats.pro + stats.team;

    res.json({
      generatedAt: new Date().toISOString(),
      items,
      total,
      limit,
      offset,
      stats,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/subscriptions] list error");
    res.status(500).json({ error: "Impossibile caricare gli abbonamenti" });
  }
});

router.get("/subscriptions/:userId", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Utente non valido" });
    return;
  }

  try {
    const detail = await getAdminSubscriptionDetail(userId);
    if (!detail) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }
    res.json(detail);
  } catch (err) {
    rootLogger.error({ err, userId }, "[admin/subscriptions] detail error");
    res.status(500).json({ error: "Impossibile caricare il dettaglio abbonamento" });
  }
});

router.patch("/subscriptions/:userId", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const userId = Number(req.params.userId);
  const plan = req.body?.plan;
  const reason = stringValue(req.body?.reason);
  const validUntil = parseAdminValidUntil(req.body?.validUntil);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Utente non valido" });
    return;
  }
  if (!isSubscriptionPlan(plan)) {
    res.status(400).json({ error: "Piano non valido", fields: { plan: "Scegli Free, Pro o Team." } });
    return;
  }
  if (reason.length < 3) {
    res.status(400).json({ error: "Motivazione obbligatoria", fields: { reason: "Inserisci il motivo della modifica." } });
    return;
  }
  if (validUntil === undefined) {
    res.status(400).json({ error: "Scadenza non valida", fields: { validUntil: "Inserisci una data valida o lascia vuoto." } });
    return;
  }

  try {
    const before = await getAdminSubscriptionDetail(userId);
    if (!before) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    await db.transaction(async (tx) => {
      const activeRows = await tx
        .select({ id: subscriptionsTable.id })
        .from(subscriptionsTable)
        .where(and(eq(subscriptionsTable.userId, userId), isNull(subscriptionsTable.cancelledAt)))
        .orderBy(desc(subscriptionsTable.createdAt));

      if (plan === "free") {
        await tx
          .update(subscriptionsTable)
          .set({ cancelledAt: new Date(), updatedAt: new Date() })
          .where(and(eq(subscriptionsTable.userId, userId), isNull(subscriptionsTable.cancelledAt)));
        await tx
          .update(usersTable)
          .set({ isPremium: false, updatedAt: new Date() })
          .where(eq(usersTable.id, userId));
        return;
      }

      const [latestActive] = activeRows;
      if (latestActive) {
        await tx
          .update(subscriptionsTable)
          .set({ plan, validUntil, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, latestActive.id));

        if (activeRows.length > 1) {
          await tx
            .update(subscriptionsTable)
            .set({ cancelledAt: new Date(), updatedAt: new Date() })
            .where(and(
              eq(subscriptionsTable.userId, userId),
              isNull(subscriptionsTable.cancelledAt),
              ne(subscriptionsTable.id, latestActive.id),
            ));
        }
      } else {
        await tx.insert(subscriptionsTable).values({
          userId,
          plan,
          validUntil,
        });
      }

      await tx
        .update(usersTable)
        .set({ isPremium: true, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
    });

    invalidatePlanCache(userId);
    const after = await getAdminSubscriptionDetail(userId);
    void writeAuditLog(req, {
      action: "admin_subscription_updated",
      category: "admin_action",
      targetId: userId,
      metadata: {
        reason,
        before: before.current,
        after: after?.current ?? null,
        stripeUnchanged: true,
      },
    });

    res.json({ ok: true, detail: after });
  } catch (err) {
    rootLogger.error({ err, userId }, "[admin/subscriptions] update error");
    res.status(500).json({ error: "Modifica abbonamento non riuscita" });
  }
});

router.get("/ops/status", async (_req: Request, res: Response) => {
  try {
    const status = await getAdminOpsStatus();
    res.json(status);
  } catch (err) {
    rootLogger.error({ err }, "[admin/ops/status] error");
    res.status(500).json({ error: "Stato operativo non disponibile" });
  }
});

async function runOpsServiceAction(
  req: Request,
  res: Response,
  service: "northstar-server" | "postgres",
  action: "start" | "stop" | "restart",
) {
  const confirmation = typeof req.body?.confirmation === "string" ? req.body.confirmation : undefined;
  const validation = validateOpsAction({ service, action, confirmation });
  if (!validation.ok) {
    res.status(validation.status).json({
      error: validation.error,
      expectedConfirmation: validation.expectedConfirmation ?? null,
    });
    return;
  }

  const operation = queueDockerOperation({
    service,
    action,
    requestedBy: req.user?.id ?? null,
  });

  void writeAuditLog(req, {
    action: `admin_ops_${service}_${action}`,
    category: "admin_action",
    metadata: { service, action, operationId: operation.id },
  });

  res.status(202).json({ ok: true, operation });
}

router.post("/ops/server/restart", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "restart");
});

router.post("/ops/server/stop", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "stop");
});

router.post("/ops/server/start", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "start");
});

router.post("/ops/database/restart", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "postgres", "restart");
});

router.post("/ops/database/maintenance", async (req: Request, res: Response) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const maintenance = await setMaintenanceMode({
      enabled,
      reason,
      updatedBy: req.user?.id ?? null,
    });

    void writeAuditLog(req, {
      action: enabled ? "admin_ops_database_maintenance_on" : "admin_ops_database_maintenance_off",
      category: "admin_action",
      metadata: { reason: maintenance.reason },
    });

    res.json({ ok: true, maintenance });
  } catch (err) {
    rootLogger.error({ err }, "[admin/ops/database/maintenance] error");
    res.status(500).json({ error: "Impossibile aggiornare la maintenance mode" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const snapshot = await getBusinessStatusSnapshot(30);
    res.json({
      users: snapshot.business.users,
      tests: snapshot.business.tests,
      topSectors: snapshot.business.topSectors,
      funnels: snapshot.funnels,
      generatedAt: snapshot.generatedAt,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/business-status", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const snapshot = await getBusinessStatusSnapshot(req.query.days);
    res.json(snapshot);
  } catch (err) {
    rootLogger.error({ err }, "[admin/business-status] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/growth-queue", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const limit = getLimit(req, 50, 100);
    const status = stringValue(req.query.status, "all");
    const query = stringValue(req.query.search);
    const search = `%${query}%`;
    const where = [
      GROWTH_QUEUE_STATUSES.includes(status as GrowthQueueStatus)
        ? eq(growthArticlesTable.status, status)
        : undefined,
      query
        ? or(
            ilike(growthArticlesTable.title, search),
            ilike(growthArticlesTable.slug, search),
            ilike(growthArticlesTable.category, search),
            ilike(growthArticlesTable.description, search),
          )
        : undefined,
    ].filter(Boolean) as any[];
    const [queue, stats] = await Promise.all([
      db
        .select()
        .from(growthArticlesTable)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(growthArticlesTable.updatedAt))
        .limit(limit),
      db
        .select({
          status: growthArticlesTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(growthArticlesTable)
        .groupBy(growthArticlesTable.status),
    ]);

    const byStatus = Object.fromEntries(stats.map((row) => [row.status, Number(row.count) || 0]));
    res.json({
      generatedAt: new Date().toISOString(),
      queue,
      stats: {
        draft: byStatus.draft ?? 0,
        pending: byStatus.pending ?? 0,
        published: byStatus.published ?? 0,
        rejected: byStatus.rejected ?? 0,
        total: GROWTH_QUEUE_STATUSES.reduce((sum, key) => sum + (byStatus[key] ?? 0), 0),
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/growth-queue] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/growth-queue/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const [article] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
    if (!article) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const auditTrail = await db
      .select()
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.category, "admin_action"),
          sql`${auditLogTable.metadata}->>'workflow' = 'growth_queue'`,
          sql`${auditLogTable.metadata}->>'articleId' = ${String(id)}`,
        ),
      )
      .orderBy(desc(auditLogTable.createdAt))
      .limit(30);
    res.json({ article, preview: previewGrowthArticle(article), auditTrail });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] detail error");
    res.status(500).json({ error: String(err) });
  }
});

router.patch("/growth-queue/:id", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const [current] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const validation = normalizeGrowthArticlePayload(req.body?.payload ?? req.body, current);
    const fields = {
      ...validation.fields,
      ...(validation.ok ? await ensureGrowthArticleSlug(validation.payload.slug, id) : {}),
    };
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Articolo crescita non valido", fields });
      return;
    }
    const [article] = await db
      .update(growthArticlesTable)
      .set({ ...validation.payload, updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    await writeGrowthArticleAudit(req, "growth_article_updated", id, {
      previousStatus: current.status,
      nextStatus: article.status,
      notes: stringValue(req.body?.notes) || null,
    });
    res.json({ ok: true, article, preview: previewGrowthArticle(article) });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] update error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/growth-queue/:id/preview", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const [current] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const validation = normalizeGrowthArticlePayload(req.body?.payload ?? req.body ?? {}, current);
    if (!validation.ok) {
      res.status(400).json({ error: "Articolo crescita non valido", fields: validation.fields });
      return;
    }
    res.json({ ok: true, preview: previewGrowthArticle(validation.payload), payload: validation.payload });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] preview error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/growth-queue/:id/publish", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }

  try {
    const [current] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const validation = normalizeGrowthArticlePayload({ ...current, status: "published" }, current);
    const fields = {
      ...validation.fields,
      ...(validation.ok ? await ensureGrowthArticleSlug(validation.payload.slug, id) : {}),
    };
    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: "Articolo non pubblicabile", fields });
      return;
    }
    const [article] = await db
      .update(growthArticlesTable)
      .set({ ...validation.payload, status: "published", updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    await writeGrowthArticleAudit(req, "growth_article_published", id, {
      previousStatus: current.status,
      nextStatus: article.status,
      notes: stringValue(req.body?.notes) || null,
    });
    res.json({ ok: true, article, preview: previewGrowthArticle(article) });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] publish error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/growth-queue/:id/reject", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const id = Number(req.params.id);
  const reason = stringValue(req.body?.reason);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID articolo non valido" });
    return;
  }
  if (reason.length < 3) {
    res.status(400).json({ error: "Motivo rifiuto obbligatorio", fields: { reason: "Inserisci un motivo di almeno 3 caratteri." } });
    return;
  }

  try {
    const [current] = await db.select().from(growthArticlesTable).where(eq(growthArticlesTable.id, id)).limit(1);
    if (!current) {
      res.status(404).json({ error: "Articolo non trovato" });
      return;
    }
    const [article] = await db
      .update(growthArticlesTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    await writeGrowthArticleAudit(req, "growth_article_rejected", id, {
      previousStatus: current.status,
      nextStatus: article.status,
      reason,
    });
    res.json({ ok: true, article, preview: previewGrowthArticle(article) });
  } catch (err) {
    rootLogger.error({ err, id }, "[admin/growth-queue] reject error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/research/runs", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .where(sql`${agentRunsTable.agentName} in ('news', 'growth', 'news-research', 'growth-research')`)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req, 50, 100));

    res.json(
      runs.map((run) => ({
        id: String(run.id),
        agent: run.agentName.includes("growth") ? "growth" : "news",
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        status: run.status === "cancelled" ? "failed" : run.status,
        input: { summary: run.inputSummary },
        result: run.outputSummary ? { summary: run.outputSummary } : null,
        error: run.errorMessage,
      })),
    );
  } catch (err) {
    rootLogger.error({ err }, "[admin/research/runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/research/news/run", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const startedAt = new Date();
  try {
    const warnings: string[] = [];
    const collector = await runCollector();

    let enricher: Awaited<ReturnType<typeof runEnricher>> | null = null;
    try {
      enricher = await runEnricher(20);
      if (enricher.errors.length) warnings.push(...enricher.errors.slice(0, 5));
    } catch (err) {
      warnings.push(`enricher: ${String(err).slice(0, 200)}`);
    }

    let publisher: Awaited<ReturnType<typeof runNewsPublisher>> | null = null;
    try {
      publisher = await runNewsPublisher();
      if (publisher.missingCoverage.length) {
        warnings.push(`Mancano news reali per ${publisher.missingCoverage.length} settori.`);
      }
    } catch (err) {
      warnings.push(`publisher: ${String(err).slice(0, 200)}`);
    }

    const output = {
      collector,
      enricher,
      publisher,
      warnings,
    };
    const run = await writeAgentRunSnapshot({
      agentName: "news-research",
      taskType: "manual_admin_run",
      startedAt,
      status: warnings.length && !collector.totalInserted && !publisher?.transferred ? "failed" : "completed",
      inputSummary: JSON.stringify(req.body ?? {}),
      outputSummary: JSON.stringify(output).slice(0, 1000),
      errorMessage: warnings.length ? warnings.join(" | ").slice(0, 1000) : undefined,
    });

    res.status(201).json({
      ok: true,
      runId: run.id,
      checked: collector.totalCollected,
      added: publisher?.transferred ?? 0,
      collector,
      enricher,
      publisher,
      warnings,
    });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "news-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/news/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/research/growth/run", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  const startedAt = new Date();
  try {
    const body = (req.body ?? {}) as { topics?: unknown; limit?: unknown };
    const topics = Array.isArray(body.topics) && body.topics.length
      ? body.topics.map((topic) => compactText(topic, 120)).filter(Boolean).slice(0, 5)
      : [
          "crescita personale lavoro focus produttivita abitudini",
          "orientamento professionale competenze futuro del lavoro",
          "benessere mentale burnout lavoro giovani professionisti",
        ];
    const perTopic = Math.max(1, Math.min(Number(body.limit) || 3, 5));

    const webResults = (
      await Promise.all(topics.map(async (topic) => ({
        topic,
        results: await searchWeb(topic, perTopic),
      })))
    ).flatMap(({ topic, results }) =>
      results.map((result) => ({
        topic,
        title: compactText((result.metadata as any)?.title ?? result.source, 180),
        url: result.source,
        source: "Tavily",
        summary: result.content,
      })),
    );

    const discoveryRows = await db
      .select()
      .from(discoveryItemsTable)
      .where(sql`${discoveryItemsTable.type} in ('growth', 'formation')`)
      .orderBy(desc(discoveryItemsTable.createdAt))
      .limit(20);

    const discoveryResults = discoveryRows.map((item) => ({
      topic: item.category || item.type,
      title: item.title,
      url: item.url,
      source: item.source || item.collectorSource || "Discovery Collector",
      summary: item.insightText || item.summary,
    }));

    const candidates = [...webResults, ...discoveryResults]
      .filter((item) => item.title || item.summary)
      .slice(0, 25);

    const created: Array<{ id: number; title: string; slug: string; source: string }> = [];
    const skipped: string[] = [];

    for (const [index, candidate] of candidates.entries()) {
      const payload = buildGrowthResearchArticle({ ...candidate, index });
      const [existing] = await db
        .select({ id: growthArticlesTable.id })
        .from(growthArticlesTable)
        .where(eq(growthArticlesTable.slug, payload.slug))
        .limit(1);
      if (existing) {
        skipped.push(payload.slug);
        continue;
      }
      const [article] = await db.insert(growthArticlesTable).values(payload).returning({
        id: growthArticlesTable.id,
        title: growthArticlesTable.title,
        slug: growthArticlesTable.slug,
      });
      if (article) created.push({ ...article, source: candidate.source });
    }

    const warnings = candidates.length
      ? []
      : ["Nessuna fonte trovata: configura TAVILY_API_KEY o avvia il collector discovery."];
    const output = {
      topics,
      attempted: candidates.length,
      created: created.length,
      skipped: skipped.length,
      webSources: webResults.length,
      discoverySources: discoveryResults.length,
      warnings,
    };
    const run = await writeAgentRunSnapshot({
      agentName: "growth-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ topics, perTopic }),
      outputSummary: JSON.stringify(output).slice(0, 1000),
      errorMessage: warnings.length ? warnings.join(" | ") : undefined,
    });

    res.status(201).json({
      ok: true,
      runId: run.id,
      added: created.length,
      attempted: candidates.length,
      topics,
      created,
      warnings,
    });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "growth-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/growth/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

// ── Agent Triggers ────────────────────────────────────────────────────────────

/** POST /api/admin/agents/collect — avvia il collector di notizie */
router.post("/agents/collect", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const result = await runCollector();
    const run = await writeAgentRunSnapshot({
      agentName: "collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] collector triggered manually");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "collector",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/collect] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** POST /api/admin/agents/enrich — avvia l'enricher LLM */
router.post("/agents/enrich", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const batchSize = Number(req.query.batchSize) || 20;
    const result = await runEnricher(batchSize);
    const run = await writeAgentRunSnapshot({
      agentName: "enricher",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ batchSize }),
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] enricher triggered manually");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "enricher",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/enrich] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** GET /api/admin/agents/status — ultimi run degli agenti */
router.get("/agents/status", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(20);
    res.json({ runs });
  } catch (err) {
    rootLogger.error({ err }, "[admin/agents/status] error");
    res.status(500).json({ error: String(err) });
  }
});

/** POST /api/admin/agents/sector-data — aggiorna dati mercato settori/professioni via LLM */
router.post("/agents/sector-data", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    const maxSectors     = Number(req.query.maxSectors)     || 5;
    const maxProfessions = Number(req.query.maxProfessions) || 10;
    const result = await runSectorDataAgent({ maxSectors, maxProfessions });
    const run = await writeAgentRunSnapshot({
      agentName: "sector-data",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      inputSummary: JSON.stringify({ maxSectors, maxProfessions }),
      outputSummary: JSON.stringify(result).slice(0, 1000),
    });
    rootLogger.info({ result }, "[admin] sector-data agent triggered");
    res.json({ ok: true, runId: run.id, ...result });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "sector-data",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/sector-data] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

/** POST /api/admin/agents/backfill — genera embeddings mancanti per settori e professioni */
router.post("/agents/backfill", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  const startedAt = new Date();
  try {
    // Settori senza embedding
    const sectors = await db
      .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description })
      .from(sectorsTable)
      .where(isNull(sectorsTable.embedding))
      .limit(100);

    let sectorsDone = 0;
    if (sectors.length > 0) {
      const items = sectors.map((s) => ({
        id: s.id,
        text: buildEmbeddingText([
          { label: "Settore", value: s.name },
          { label: "Descrizione", value: s.description },
        ]),
      }));
      const results = await generateEmbeddingsBatch(items);
      for (const r of results) {
        if (r.embedding) {
          await db
            .update(sectorsTable)
            .set({ embedding: r.embedding as any })
            .where(eq(sectorsTable.id, Number(r.id)));
          sectorsDone++;
        }
      }
    }

    // Professioni senza embedding
    const professions = await db
      .select({ id: professionsTable.id, title: professionsTable.title, description: professionsTable.description })
      .from(professionsTable)
      .where(isNull(professionsTable.embedding))
      .limit(100);

    let professionsDone = 0;
    if (professions.length > 0) {
      const items = professions.map((p) => ({
        id: p.id,
        text: buildEmbeddingText([
          { label: "Ruolo", value: p.title },
          { label: "Descrizione", value: p.description },
        ]),
      }));
      const results = await generateEmbeddingsBatch(items);
      for (const r of results) {
        if (r.embedding) {
          await db
            .update(professionsTable)
            .set({ embedding: r.embedding as any })
            .where(eq(professionsTable.id, Number(r.id)));
          professionsDone++;
        }
      }
    }

    rootLogger.info({ sectorsDone, professionsDone }, "[admin] backfill embeddings completed");
    const run = await writeAgentRunSnapshot({
      agentName: "backfill-embeddings",
      taskType: "manual_admin_run",
      startedAt,
      status: "completed",
      outputSummary: JSON.stringify({ sectorsDone, professionsDone }),
    });
    res.json({ ok: true, runId: run.id, sectorsDone, professionsDone });
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "backfill-embeddings",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/agents/backfill] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

// ── GET /api/admin/error-report (Step Foundation refactor) ──
// Restituisce snapshot strutturato degli errori catturati da ExecutionMonitor
router.get("/error-report", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  try {
    const report = executionMonitor.getReport();
    res.json(report);
  } catch (err) {
    rootLogger.error({ err }, "[admin/error-report] error");
    res.status(500).json({ error: String(err) });
  }
});

// ── DELETE /api/admin/error-report — pulisce il buffer ──
router.delete("/error-report", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;
  executionMonitor.clear();
  res.json({ ok: true });
});

export default router;
