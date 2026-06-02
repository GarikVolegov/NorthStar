import type { GlobalSearchEntityType } from "./global-search";

export type DiscoveryItemType = GlobalSearchEntityType;
export type DiscoverySource = "index" | "live" | "library" | "fallback" | "wendy";
type UnknownDiscoverySource = string & {};
type UnknownDiscoveryItemType = string & {};
export type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";
export type DiscoveryReasonSource = "profile" | "content" | "fallback";

export interface DiscoveryReason {
  code: string;
  label: string;
  source?: DiscoveryReasonSource;
}

export interface DiscoverableContent<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  title: string;
  summary?: string | null;
  description?: string | null;
  url?: string | null;
  path?: string | null;
  href?: string | null;
  link?: string | null;
  source?: DiscoverySource | UnknownDiscoverySource | null;
  type?: DiscoveryItemType | UnknownDiscoveryItemType | null;
  category?: string | null;
  metadata?: TMetadata | null;
  tags?: string[] | null;
  keywords?: string[] | null;
  createdAt?: string | Date | null;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  score?: number | null;
  matchScore?: number | null;
  scoreTotal?: number | null;
  score_total?: number | null;
  scoreLexical?: number | null;
  score_lexical?: number | null;
  lexicalScore?: number | null;
  scoreSemantic?: number | null;
  score_semantic?: number | null;
  semanticScore?: number | null;
  readingTime?: number | string | null;
  visibility?: "public" | "private" | null;
}

export interface DiscoveryMetadataOptions {
  isPrivateProfileData?: boolean;
  maxReasons?: number;
  source?: DiscoverySource;
  visibility?: "public" | "private";
}

export interface DiscoveryMetadata {
  matchScore: number;
  reasons: DiscoveryReason[];
  personalization: DiscoveryPersonalization;
  freshnessLabel?: string;
  readingTime?: number | string;
  matchedKeywords?: string[];
  source: DiscoverySource;
  sourceLabel: string;
  reasonLabels: string[];
  matchSignals: string[];
  actionLabel: string;
}

const PUBLIC_SOURCE_LABELS: Record<DiscoverySource, string> = {
  index: "Indice NorthStar",
  live: "Catalogo NorthStar",
  library: "Biblioteca crescita",
  fallback: "Percorso generale NorthStar",
  wendy: "Wendy",
};

const TYPE_SOURCE_LABELS: Partial<Record<DiscoveryItemType, string>> = {
  sector: "Catalogo settori",
  role: "Catalogo ruoli",
  article: "Biblioteca crescita",
  news: "Notizie NorthStar",
};

const ACTION_LABELS: Record<DiscoveryItemType, string> = {
  sector: "Esplora",
  role: "Apri ruolo",
  article: "Leggi",
  news: "Leggi",
  idea: "Apri",
  objective: "Apri",
  calendar: "Apri",
  certification: "Apri",
  memory: "Apri",
  workspace: "Apri",
  profile: "Apri",
};

const SUPPORTED_SOURCES = new Set<DiscoverySource>([
  "index",
  "live",
  "library",
  "fallback",
  "wendy",
]);

const SUPPORTED_TYPES = new Set<DiscoveryItemType>([
  "sector",
  "role",
  "article",
  "news",
  "idea",
  "objective",
  "calendar",
  "certification",
  "memory",
  "workspace",
  "profile",
]);

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  });
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeSource(value: unknown, fallback: DiscoverySource = "live"): DiscoverySource {
  return typeof value === "string" && SUPPORTED_SOURCES.has(value as DiscoverySource)
    ? (value as DiscoverySource)
    : fallback;
}

function normalizeType(value: unknown): DiscoveryItemType | null {
  return typeof value === "string" && SUPPORTED_TYPES.has(value as DiscoveryItemType)
    ? (value as DiscoveryItemType)
    : null;
}

function addReason(reasons: DiscoveryReason[], reason: DiscoveryReason): void {
  if (!reasons.some((existing) => existing.code === reason.code)) {
    reasons.push(reason);
  }
}

function freshnessLabel(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Aggiornato oggi";
  if (days === 1) return "Aggiornato ieri";
  if (days < 30) return `Aggiornato ${days} giorni fa`;
  return undefined;
}

export function buildDiscoveryMetadata(
  content: DiscoverableContent,
  options: DiscoveryMetadataOptions = {},
): DiscoveryMetadata {
  const metadata = content.metadata ?? {};
  const type = normalizeType(content.type);
  const source = normalizeSource(options.source ?? content.source, "live");
  const isPrivate =
    options.isPrivateProfileData === true ||
    options.visibility === "private" ||
    content.visibility === "private";
  const maxReasons = Math.max(1, options.maxReasons ?? 3);

  const lexicalScore = clampScore(
    firstNumber(content.scoreLexical, content.score_lexical, content.lexicalScore) ?? 0,
  );
  const semanticScore = clampScore(
    firstNumber(content.scoreSemantic, content.score_semantic, content.semanticScore) ?? 0,
  );
  const explicitMatchScore = firstNumber(
    content.matchScore,
    content.score,
    content.scoreTotal,
    content.score_total,
  );
  const matchScore =
    explicitMatchScore != null
      ? clampScore(explicitMatchScore)
      : Math.max(lexicalScore, semanticScore, 0);

  const category = firstString(content.category) ?? firstString(metadata.category);
  const tags = [...stringArray(content.tags), ...stringArray(metadata.tags)];
  const keywords = [...stringArray(content.keywords), ...stringArray(metadata.keywords)];
  const personalityMatches = [
    ...stringArray(metadata.personalityMatches),
    ...stringArray(metadata.personalityMatchesProfile),
    ...stringArray(metadata.profilePersonalityMatches),
  ];
  const sectorMatches = [
    ...stringArray(metadata.sectorLinks),
    ...stringArray(metadata.sectorMatches),
    ...stringArray(metadata.profileSectorMatches),
  ];
  const roleMatches = [
    ...stringArray(metadata.roleLinks),
    ...stringArray(metadata.roleMatches),
    ...stringArray(metadata.profileRoleMatches),
  ];
  const genericProfileMatches = [
    ...stringArray(metadata.profileMatches),
    ...stringArray(metadata.profileMatchLabels),
  ];
  const hasProfileMatches =
    personalityMatches.length > 0 ||
    sectorMatches.length > 0 ||
    roleMatches.length > 0 ||
    genericProfileMatches.length > 0;

  const reasons: DiscoveryReason[] = [];
  const matchedKeywords: string[] = [];

  if (lexicalScore > 0) {
    addReason(reasons, {
      code: "lexical",
      label: "Match nel titolo o contenuto",
      source: "content",
    });
  }
  if (semanticScore > 0) {
    addReason(reasons, {
      code: "semantic",
      label: "Match semantico",
      source: "content",
    });
  }

  if (isPrivate) {
    addReason(reasons, {
      code: "private-profile",
      label: "Dati del tuo profilo",
      source: "profile",
    });
  } else {
    if (category) {
      addReason(reasons, {
        code: `category:${category}`,
        label: `Categoria: ${category}`,
        source: "content",
      });
      matchedKeywords.push(category);
    }
    for (const tag of tags) {
      addReason(reasons, {
        code: `tag:${tag}`,
        label: `Tema: ${tag}`,
        source: "content",
      });
      matchedKeywords.push(tag);
    }
    for (const keyword of keywords) {
      addReason(reasons, {
        code: `keyword:${keyword}`,
        label: `Keyword: ${keyword}`,
        source: "content",
      });
      matchedKeywords.push(keyword);
    }
    for (const match of personalityMatches) {
      addReason(reasons, {
        code: `personality:${match}`,
        label: `Profilo: ${match}`,
        source: "profile",
      });
      matchedKeywords.push(match);
    }
    for (const sector of sectorMatches) {
      addReason(reasons, {
        code: `sector:${sector}`,
        label: `Settore: ${sector}`,
        source: "profile",
      });
      matchedKeywords.push(sector);
    }
    for (const role of roleMatches) {
      addReason(reasons, {
        code: `role:${role}`,
        label: `Ruolo: ${role}`,
        source: "profile",
      });
      matchedKeywords.push(role);
    }
    for (const profileMatch of genericProfileMatches) {
      addReason(reasons, {
        code: `profile:${profileMatch}`,
        label: `Profilo: ${profileMatch}`,
        source: "profile",
      });
      matchedKeywords.push(profileMatch);
    }
    addReason(reasons, {
      code: `source:${source}`,
      label: `Fonte: ${PUBLIC_SOURCE_LABELS[source]}`,
      source: "content",
    });
    if (type) {
      addReason(reasons, {
        code: `type:${type}`,
        label: `Tipo: ${TYPE_SOURCE_LABELS[type] ?? "Contenuto NorthStar"}`,
        source: "content",
      });
    }
  }

  if (source === "fallback") {
    addReason(reasons, {
      code: "fallback",
      label: "Contenuto generale",
      source: "fallback",
    });
  }

  if (reasons.length === 0) {
    addReason(reasons, {
      code: type ? `type:${type}` : "northstar-content",
      label: type ? TYPE_SOURCE_LABELS[type] ?? "Contenuto NorthStar" : "Contenuto NorthStar",
      source: "fallback",
    });
  }

  const cappedReasons = reasons.slice(0, maxReasons);
  const sourceLabel = isPrivate
    ? "Contenuti personali"
    : source === "live" && type
      ? TYPE_SOURCE_LABELS[type] ?? PUBLIC_SOURCE_LABELS.live
      : PUBLIC_SOURCE_LABELS[source];
  const readingTime =
    content.readingTime ?? (metadata.readingTime as number | string | null | undefined) ?? undefined;
  const freshLabel = freshnessLabel(content.publishedAt ?? content.updatedAt ?? content.createdAt);
  const uniqueKeywords = Array.from(new Set(matchedKeywords));

  return {
    matchScore,
    reasons: cappedReasons,
    personalization: isPrivate ? "private" : hasProfileMatches ? "profile" : "generic",
    ...(freshLabel ? { freshnessLabel: freshLabel } : {}),
    ...(readingTime != null ? { readingTime } : {}),
    ...(uniqueKeywords.length > 0 ? { matchedKeywords: uniqueKeywords } : {}),
    source,
    sourceLabel,
    reasonLabels: cappedReasons.map((reason) => reason.label),
    matchSignals: cappedReasons.map((reason) => reason.code),
    actionLabel: type ? ACTION_LABELS[type] : "Apri",
  };
}
