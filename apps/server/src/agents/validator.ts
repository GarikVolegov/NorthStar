import type { Agent, AgentInput, AgentOutput } from "./types";
import { ValidatorInputSchema, ValidationResultSchema } from "./types";

interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

const REQUIRED_AGENTS_BY_TASK: Record<string, { agent: string; field: string; dataKey: string; severity: "error" | "warning" }[]> = {
  full_profile: [
    { agent: "PersonalityAgent", field: "PersonalityAgent.primaryTypes", dataKey: "primaryTypes", severity: "error" },
    { agent: "SectorAgent", field: "SectorAgent.sectors", dataKey: "sectors", severity: "warning" },
    { agent: "ProfessionAgent", field: "ProfessionAgent.professions", dataKey: "professions", severity: "warning" },
  ],
  personality_analysis: [
    { agent: "PersonalityAgent", field: "PersonalityAgent.primaryTypes", dataKey: "primaryTypes", severity: "error" },
  ],
  sector_match: [
    { agent: "SectorAgent", field: "SectorAgent.sectors", dataKey: "sectors", severity: "error" },
  ],
  profession_match: [
    { agent: "ProfessionAgent", field: "ProfessionAgent.professions", dataKey: "professions", severity: "error" },
  ],
  education_path: [
    { agent: "EducationAgent", field: "EducationAgent.educationPaths", dataKey: "educationPaths", severity: "error" },
  ],
  news_filter: [
    { agent: "NewsAgent", field: "NewsAgent.news", dataKey: "news", severity: "warning" },
  ],
  growth_suggestions: [
    { agent: "GrowthAgent", field: "GrowthAgent.articles", dataKey: "articles", severity: "warning" },
  ],
  calendar_events: [
    { agent: "CalendarAgent", field: "CalendarAgent.suggestedEvents", dataKey: "suggestedEvents", severity: "error" },
  ],
  affiliation_materials: [
    { agent: "AffiliationAgent", field: "AffiliationAgent.materials", dataKey: "materials", severity: "error" },
  ],
  work_mode_analysis: [
    { agent: "WorkModeAgent", field: "WorkModeAgent.recommended", dataKey: "recommended", severity: "error" },
  ],
};

export const validatorAgent: Agent = {
  name: "ValidatorAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = ValidatorInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: true,
          data: {
            valid: false,
            errors: [{ field: "payload", message: "Invalid validator input", severity: "error" }],
            warnings: [],
            issueCount: 1,
          },
        };
      }

      const { aggregatedResults, taskType } = parsed.data;
      const agentResults = aggregatedResults as Record<string, AgentOutput>;
      const issues: ValidationIssue[] = [];

      // Check all agents: failures are errors; partial failures (fallbacks) are warnings
      for (const [agentName, result] of Object.entries(agentResults)) {
        if (!result.success && !result.partial) {
          issues.push({
            field: agentName,
            message: `Agent ${agentName} failed: ${result.error ?? "unknown error"}`,
            severity: "error",
          });
        } else if (!result.success && result.partial) {
          issues.push({
            field: agentName,
            message: `Agent ${agentName} returned a partial fallback: ${result.error ?? "degraded result"}`,
            severity: "warning",
          });
        }
      }

      // Check required output fields per task — regardless of agent success status
      // A failed/partial agent that doesn't produce the required field is a validation failure
      const requiredChecks = REQUIRED_AGENTS_BY_TASK[taskType] ?? [];
      for (const check of requiredChecks) {
        const agentResult = agentResults[check.agent];
        const value = agentResult?.data?.[check.dataKey];
        const isEmpty = Array.isArray(value)
          ? value.length === 0
          : value == null || value === "";

        if (isEmpty) {
          issues.push({
            field: check.field,
            message: `Required output '${check.dataKey}' is missing or empty in ${check.agent}`,
            severity: check.severity,
          });
        }
      }

      const errors = issues.filter((i) => i.severity === "error");
      const warnings = issues.filter((i) => i.severity === "warning");

      // Deduplicate by field (required check may duplicate agent-level error)
      const deduped = (arr: ValidationIssue[]) =>
        arr.filter((item, idx, self) => self.findIndex((i) => i.field === item.field) === idx);

      const deduplicatedErrors = deduped(errors);
      const deduplicatedWarnings = deduped(warnings.filter((w) => !deduplicatedErrors.some((e) => e.field === w.field)));
      const valid = deduplicatedErrors.length === 0;

      const fallbacks: Record<string, unknown> = {};
      for (const issue of [...deduplicatedErrors, ...deduplicatedWarnings]) {
        const agentName = issue.field.split(".")[0]!;
        if (agentName && !agentResults[agentName]?.success) {
          fallbacks[agentName] = {
            status: "fallback",
            message: "Contenuto statico disponibile su richiesta",
          };
        }
      }

      const output = {
        valid,
        errors: deduplicatedErrors,
        warnings: deduplicatedWarnings,
        issueCount: deduplicatedErrors.length + deduplicatedWarnings.length,
        fallbacks: Object.keys(fallbacks).length > 0 ? fallbacks : undefined,
      };

      const outputValidation = ValidationResultSchema.safeParse(output);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: true,
          data: output,
          partial: true,
        };
      }

      return {
        agentName: this.name,
        success: true,
        data: outputValidation.data,
      };
    } catch (err) {
      return {
        agentName: this.name,
        success: false,
        data: { valid: false, errors: [], warnings: [] },
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
