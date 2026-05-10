import { z } from "zod";

export type UserPlan = "free" | "premium";

export const PersonalityOutputSchema = z.object({
  primaryTypes: z.array(z.string()),
  predispositions: z.array(z.object({
    type: z.string(),
    label: z.string(),
    description: z.string(),
  })),
  strengths: z.array(z.string()),
  attentionAreas: z.array(z.string()),
  spiritProfile: z.object({
    dominant: z.string(),
    secondary: z.string(),
    insight: z.string(),
    dominantMeta: z.object({ name: z.string(), emoji: z.string(), description: z.string() }).optional(),
    secondaryMeta: z.object({ name: z.string(), emoji: z.string(), description: z.string() }).optional(),
  }).optional(),
  summary: z.string(),
});
export type PersonalityOutput = z.infer<typeof PersonalityOutputSchema>;

export const SectorItemSchema = z.object({
  sectorId: z.number(),
  sectorName: z.string(),
  icon: z.string(),
  color: z.string(),
  matchScore: z.number(),
  motivation: z.string(),
  trend: z.string(),
  growthRate: z.number(),
  automationRisk: z.string(),
  avgSalaryMin: z.number(),
  avgSalaryMax: z.number(),
});
export const SectorOutputSchema = z.object({
  sectors: z.array(SectorItemSchema),
  total: z.number(),
});
export type SectorOutput = z.infer<typeof SectorOutputSchema>;

export const ProfessionItemSchema = z.object({
  title: z.string(),
  sector: z.string(),
  skills: z.array(z.string()),
  workModes: z.array(z.string()),
  salaryRange: z.string(),
  growthOutlook: z.string(),
  riasecAlignment: z.string(),
  advantages: z.array(z.string()),
  disadvantages: z.array(z.string()),
});
export const ProfessionOutputSchema = z.object({
  professions: z.array(ProfessionItemSchema),
});
export type ProfessionOutput = z.infer<typeof ProfessionOutputSchema>;

export const EducationPathItemSchema = z.object({
  path: z.string(),
  type: z.string(),
  duration: z.string(),
  cost: z.string(),
  steps: z.array(z.string()),
  careerOutcomes: z.array(z.string()),
});
export const EducationOutputSchema = z.object({
  educationPaths: z.array(EducationPathItemSchema),
});
export type EducationOutput = z.infer<typeof EducationOutputSchema>;

export const NewsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional(),
  publishedAt: z.string().optional(),
  category: z.string().optional(),
});
export const NewsOutputSchema = z.object({
  news: z.array(NewsItemSchema.passthrough()),
  personalized: z.boolean(),
  source: z.string(),
});
export type NewsOutput = z.infer<typeof NewsOutputSchema>;

export const GrowthOutputSchema = z.object({
  articles: z.array(z.record(z.unknown())),
  personalized: z.boolean(),
  matchedTypes: z.array(z.string()).optional(),
});
export type GrowthOutput = z.infer<typeof GrowthOutputSchema>;

export const CalendarEventItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  linkedGoal: z.string().optional(),
  persisted: z.boolean(),
});
export const CalendarOutputSchema = z.object({
  suggestedEvents: z.array(CalendarEventItemSchema),
  count: z.number(),
  persisted: z.boolean(),
});
export type CalendarOutput = z.infer<typeof CalendarOutputSchema>;

export const WorkModeOutputSchema = z.object({
  recommended: z.string(),
  recommendedLabel: z.string(),
  riasecFit: z.string(),
  comparison: z.record(z.unknown()),
  contextualAdvice: z.string().optional(),
});
export type WorkModeOutput = z.infer<typeof WorkModeOutputSchema>;

export const AffiliationOutputSchema = z.object({
  institution: z.string(),
  materials: z.object({
    headline: z.string(),
    subheadline: z.string(),
    body: z.string(),
    callToAction: z.string(),
    benefits: z.array(z.string()),
  }),
  profileSummary: z.object({
    primaryTypes: z.array(z.string()).optional(),
    primaryLabels: z.array(z.string()),
    topSectors: z.array(z.string()),
  }),
  detailedReport: z.object({
    riasecProfile: z.array(z.string()),
    sectorCompatibility: z.array(z.string()),
    recommendedActions: z.array(z.string()),
  }).optional(),
});
export type AffiliationOutput = z.infer<typeof AffiliationOutputSchema>;

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({ field: z.string(), message: z.string(), severity: z.literal("error") })),
  warnings: z.array(z.object({ field: z.string(), message: z.string(), severity: z.literal("warning") })),
  issueCount: z.number(),
  fallbacks: z.record(z.unknown()).optional(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const SharedStateSchema = z.object({
  profile: z.object({
    riasecScores: z.record(z.number()).optional(),
    primaryTypes: z.array(z.string()).optional(),
    profileSummary: z.string().optional(),
    spiritScores: z.record(z.number()).optional(),
    dominantSpirit: z.string().optional(),
  }).optional(),
  personality: PersonalityOutputSchema.optional(),
  sectors: z.array(SectorItemSchema).optional(),
  jobs: z.array(ProfessionItemSchema).optional(),
  education: z.array(EducationPathItemSchema).optional(),
  news: z.array(z.record(z.unknown())).optional(),
  growth: z.array(z.record(z.unknown())).optional(),
  calendar: z.array(CalendarEventItemSchema).optional(),
  affiliation: z.record(z.unknown()).optional(),
  work_mode: z.object({ recommended: z.string(), comparison: z.record(z.unknown()) }).optional(),
});
export type SharedStateNamespaces = z.infer<typeof SharedStateSchema>;

export const AgentContextSchema = z.object({
  userId: z.number().optional(),
  plan: z.enum(["free", "premium"]).default("free"),
  sharedState: SharedStateSchema.default({}),
});
export type AgentContext = z.infer<typeof AgentContextSchema>;

export interface AgentInput {
  taskType: string;
  payload: Record<string, unknown>;
  context: AgentContext;
}

export interface AgentOutput {
  agentName: string;
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
  partial?: boolean;
}

export interface Agent {
  name: string;
  run(input: AgentInput): Promise<AgentOutput>;
}

export const TaskTypeSchema = z.enum([
  "personality_analysis",
  "sector_match",
  "profession_match",
  "education_path",
  "news_filter",
  "growth_suggestions",
  "calendar_events",
  "affiliation_materials",
  "work_mode_analysis",
  "full_profile",
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const PREMIUM_TASK_TYPES = new Set<TaskType>([
  "education_path",
  "work_mode_analysis",
  "calendar_events",
  "affiliation_materials",
]);

export const AgentRequestSchema = z.object({
  taskType: TaskTypeSchema,
  context: AgentContextSchema.optional(),
  payload: z.record(z.unknown()).default({}),
});
export type AgentRequest = z.infer<typeof AgentRequestSchema>;

export const PersonalityInputSchema = z.object({
  riasecScores: z.record(z.number()),
  spiritScores: z.record(z.number()).optional(),
  primaryTypes: z.array(z.string()).optional(),
});
export type PersonalityInput = z.infer<typeof PersonalityInputSchema>;

export const SectorInputSchema = z.object({
  riasecScores: z.record(z.number()),
  primaryTypes: z.array(z.string()),
  spiritScores: z.record(z.number()).optional(),
  preferences: z.object({
    avoidHigh: z.boolean().optional(),
    preferGrowth: z.boolean().optional(),
  }).optional(),
});
export type SectorInput = z.infer<typeof SectorInputSchema>;

export const ProfessionInputSchema = z.object({
  primaryTypes: z.array(z.string()),
  topSectors: z.array(z.object({ sectorName: z.string() })).optional(),
  workModePreference: z.string().optional(),
});
export type ProfessionInput = z.infer<typeof ProfessionInputSchema>;

export const EducationInputSchema = z.object({
  topSectors: z.array(z.object({ sectorName: z.string() })).optional(),
  professions: z.array(z.object({ title: z.string(), sector: z.string() })).optional(),
});
export type EducationInput = z.infer<typeof EducationInputSchema>;

export const NewsInputSchema = z.object({
  topSectors: z.array(z.object({ sectorName: z.string() })).optional(),
  categories: z.array(z.string()).optional(),
});
export type NewsInput = z.infer<typeof NewsInputSchema>;

export const GrowthInputSchema = z.object({
  primaryTypes: z.array(z.string()).optional(),
  objectives: z.array(z.string()).optional(),
});
export type GrowthInput = z.infer<typeof GrowthInputSchema>;

export const CalendarInputSchema = z.object({
  primaryTypes: z.array(z.string()).optional(),
  educationPaths: z.array(z.object({ path: z.string() })).optional(),
  professions: z.array(z.object({ title: z.string() })).optional(),
});
export type CalendarInput = z.infer<typeof CalendarInputSchema>;

export const AffiliationInputSchema = z.object({
  primaryTypes: z.array(z.string()).optional(),
  topSectors: z.array(z.object({ sectorName: z.string() })).optional(),
  institutionType: z.enum(["scuola", "università", "agenzia", "azienda"]).optional(),
});
export type AffiliationInput = z.infer<typeof AffiliationInputSchema>;

export const WorkModeInputSchema = z.object({
  primaryTypes: z.array(z.string()).optional(),
  preference: z.string().optional(),
  topSectors: z.array(z.object({ sectorName: z.string() })).optional(),
});
export type WorkModeInput = z.infer<typeof WorkModeInputSchema>;

export const ValidatorInputSchema = z.object({
  aggregatedResults: z.record(z.unknown()),
  taskType: z.string(),
});
export type ValidatorInput = z.infer<typeof ValidatorInputSchema>;
