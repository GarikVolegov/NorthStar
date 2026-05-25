import type { CatalogType } from "./catalogs";
import {
  arrayValue,
  booleanValue,
  CATALOG_ENUMS,
  enumValue,
  hasInvalidEnumValues,
  integerValue,
  normalizeSteps,
  numberArrayValue,
  numberValue,
  slugify,
  stringValue,
  type CatalogPayload,
} from "./catalog-utils";

export type CatalogValidation = {
  ok: boolean;
  fields: Record<string, string>;
  payload: CatalogPayload;
};

export function validateCatalogPayload(
  type: CatalogType,
  input: unknown,
): CatalogValidation {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? { ...(input as Record<string, unknown>) }
      : {};
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
      automationRisk: enumValue(
        raw.automationRisk,
        CATALOG_ENUMS.automationRisk,
        "medium",
      ),
      scalability: enumValue(
        raw.scalability,
        CATALOG_ENUMS.scalability,
        "medium",
      ),
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
      clientAcquisitionRequired: booleanValue(
        raw.clientAcquisitionRequired,
        false,
      ),
      freelanceSteps: normalizeSteps(raw.freelanceSteps),
      dipendentiSteps: normalizeSteps(raw.dipendentiSteps),
      remoteFriendly: booleanValue(raw.remoteFriendly, true),
    };
    if (!payload.name) fields.name = "Nome obbligatorio.";
    if (!payload.description) fields.description = "Descrizione obbligatoria.";
    if (payload.avgSalaryMin < 0)
      fields.avgSalaryMin = "Il salario minimo deve essere positivo.";
    if (payload.avgSalaryMax < payload.avgSalaryMin)
      fields.avgSalaryMax =
        "Il salario massimo deve essere maggiore o uguale al minimo.";
    if (hasInvalidEnumValues(payload.riasecTypes, CATALOG_ENUMS.riasec))
      fields.riasecTypes = "RIASEC non valido.";
    if (hasInvalidEnumValues(payload.workMode, CATALOG_ENUMS.workMode))
      fields.workMode = "Modalita lavoro non valida.";
    return { ok: Object.keys(fields).length === 0, fields, payload };
  }

  if (type === "professions") {
    const riasecFit = arrayValue(raw.riasecFit);
    const workModes = arrayValue(raw.workModes);
    const payload = {
      title: stringValue(raw.title),
      sector: stringValue(raw.sector),
      sectorId:
        raw.sectorId == null || raw.sectorId === ""
          ? null
          : integerValue(raw.sectorId),
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
    if (!payload.sector && !payload.sectorId)
      fields.sector = "Settore o sectorId obbligatorio.";
    if (!payload.salaryRange)
      fields.salaryRange = "Fascia salario obbligatoria.";
    if (!payload.growthOutlook)
      fields.growthOutlook = "Prospettiva crescita obbligatoria.";
    if (hasInvalidEnumValues(riasecFit, CATALOG_ENUMS.riasec))
      fields.riasecFit = "RIASEC non valido.";
    if (hasInvalidEnumValues(workModes, CATALOG_ENUMS.workMode))
      fields.workModes = "Modalita lavoro non valida.";
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
      professionIds: numberArrayValue(raw.professionIds),
      isActive: booleanValue(raw.isActive, true),
    };
    if (!payload.path) fields.path = "Nome percorso obbligatorio.";
    if (!payload.duration) fields.duration = "Durata obbligatoria.";
    if (!payload.cost) fields.cost = "Costo obbligatorio.";
    if (payload.steps.length === 0)
      fields.steps = "Almeno uno step obbligatorio.";
    if (payload.careerOutcomes.length === 0)
      fields.careerOutcomes = "Almeno un outcome obbligatorio.";
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
  if (!payload.content || payload.content.length < 40)
    fields.content = "Contenuto obbligatorio, almeno 40 caratteri.";
  return { ok: Object.keys(fields).length === 0, fields, payload };
}
