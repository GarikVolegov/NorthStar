import { eq } from "drizzle-orm";
import { searchWeb } from "@workspace/ai-server";
import {
  db,
  professionsTable,
  sectorsTable,
  userProfileSettingsTable,
} from "@workspace/db";

export type CompanyProspectConfidence = "high" | "medium" | "low";

export interface CompanyProspect {
  name: string;
  location: string;
  reason: string;
  evidence: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: CompanyProspectConfidence;
  suggestedSearchUrl: string;
}

export interface CompanyProspectResponse {
  companies: CompanyProspect[];
  basedOnProfession: string | null;
  basedOnSector: string | null;
  basedOnCity: string | null;
  status: "ok" | "empty" | "city_required" | "not_configured";
  coverageNote: string;
}

export interface CompanyProspectSearchInput {
  userId: number;
  professionId: number;
  sectorId?: number | undefined;
  city?: string | undefined;
}

export interface CompanyProspectProviderInput {
  roleTitle: string;
  sectorName: string | null;
  city: string;
}

export interface CompanyProspectProvider {
  configured: boolean;
  search(input: CompanyProspectProviderInput): Promise<CompanyProspect[]>;
}

export interface CompanyProspectRepository {
  getProfession(id: number): Promise<{
    id: number;
    title: string;
    sectorId: number | null;
    sectorName: string | null;
  } | null>;
  getUserCity(userId: number): Promise<string | null>;
}

const COVERAGE_NOTE =
  "Mostro aziende scoperte dalle fonti configurate e disponibili: non e' un registro esaustivo di tutte le aziende della zona.";

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(srl|spa|s\.r\.l\.|s\.p\.a\.)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte web";
  }
}

function suggestedSearchUrl(name: string, roleTitle: string, city: string): string {
  const query = `${name} ${roleTitle} ${city} lavora con noi`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function inferName(title: string): string {
  return title
    .replace(/\s*[-|].*$/, "")
    .replace(/\b(lavora con noi|careers|jobs|assume|assunzioni)\b/gi, "")
    .trim();
}

function truncateEvidence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function uniqueProspects(prospects: CompanyProspect[]): CompanyProspect[] {
  const seen = new Set<string>();
  const result: CompanyProspect[] = [];
  for (const prospect of prospects) {
    const key = normalizeCompanyName(prospect.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(prospect);
  }
  return result.slice(0, 12);
}

export function createWebCompanyProspectProvider(): CompanyProspectProvider {
  return {
    configured: Boolean(process.env.TAVILY_API_KEY),
    async search({ roleTitle, sectorName, city }) {
      const queries = [
        `aziende ${city} assumono ${roleTitle}`,
        `${roleTitle} ${city} lavora con noi`,
        sectorName ? `${sectorName} aziende ${city} ${roleTitle}` : `${roleTitle} aziende ${city}`,
        `site:linkedin.com/company ${city} ${roleTitle}`,
      ];

      const chunks = (await Promise.all(queries.map((query) => searchWeb(query, 5)))).flat();
      const prospects = chunks.flatMap((chunk) => {
        const metadata = chunk.metadata as { title?: unknown; url?: unknown } | undefined;
        const title = typeof metadata?.title === "string" ? metadata.title : "";
        const url = typeof metadata?.url === "string"
          ? metadata.url
          : typeof chunk.source === "string"
            ? chunk.source
            : "";
        const name = inferName(title) || sourceLabel(url);
        if (!name || !url) return [];

        return [{
          name,
          location: city,
          reason: `Fonte pubblica collegata a ${roleTitle}${sectorName ? ` nel settore ${sectorName}` : ""}.`,
          evidence: truncateEvidence(chunk.content),
          sourceUrl: url,
          sourceLabel: sourceLabel(url),
          confidence: chunk.content.toLowerCase().includes(roleTitle.toLowerCase()) ? "medium" : "low",
          suggestedSearchUrl: suggestedSearchUrl(name, roleTitle, city),
        } satisfies CompanyProspect];
      });

      return uniqueProspects(prospects);
    },
  };
}

export function createDbCompanyProspectRepository(): CompanyProspectRepository {
  return {
    async getProfession(id) {
      const [row] = await db
        .select({
          id: professionsTable.id,
          title: professionsTable.title,
          sectorId: professionsTable.sectorId,
          sectorName: sectorsTable.name,
        })
        .from(professionsTable)
        .leftJoin(sectorsTable, eq(professionsTable.sectorId, sectorsTable.id))
        .where(eq(professionsTable.id, id))
        .limit(1);
      return row ?? null;
    },
    async getUserCity(userId) {
      const [row] = await db
        .select({ city: userProfileSettingsTable.city })
        .from(userProfileSettingsTable)
        .where(eq(userProfileSettingsTable.userId, userId))
        .limit(1);
      return row?.city?.trim() || null;
    },
  };
}

export function createCompanyProspectService({
  repository = createDbCompanyProspectRepository(),
  provider = createWebCompanyProspectProvider(),
}: {
  repository?: CompanyProspectRepository;
  provider?: CompanyProspectProvider;
} = {}) {
  return {
    async search(input: CompanyProspectSearchInput): Promise<CompanyProspectResponse> {
      const profession = await repository.getProfession(input.professionId);
      if (!profession) {
        return {
          companies: [],
          basedOnProfession: null,
          basedOnSector: null,
          basedOnCity: null,
          status: "empty",
          coverageNote: COVERAGE_NOTE,
        };
      }

      const city = input.city?.trim() || await repository.getUserCity(input.userId);
      if (!city) {
        return {
          companies: [],
          basedOnProfession: profession.title,
          basedOnSector: profession.sectorName,
          basedOnCity: null,
          status: "city_required",
          coverageNote: COVERAGE_NOTE,
        };
      }

      if (!provider.configured) {
        return {
          companies: [],
          basedOnProfession: profession.title,
          basedOnSector: profession.sectorName,
          basedOnCity: city,
          status: "not_configured",
          coverageNote: COVERAGE_NOTE,
        };
      }

      const companies = uniqueProspects(await provider.search({
        roleTitle: profession.title,
        sectorName: profession.sectorName,
        city,
      }));

      return {
        companies,
        basedOnProfession: profession.title,
        basedOnSector: profession.sectorName,
        basedOnCity: city,
        status: companies.length > 0 ? "ok" : "empty",
        coverageNote: COVERAGE_NOTE,
      };
    },
  };
}

export type CompanyProspectService = ReturnType<typeof createCompanyProspectService>;
