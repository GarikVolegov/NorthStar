import type { GlobalSearchEntityType } from "./global-search";

export type DiscoveryItemType = GlobalSearchEntityType;
export type DiscoverySource = "index" | "live" | "library" | "fallback" | "wendy";
export type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";

export interface DiscoveryMetadataInput {
  type: DiscoveryItemType;
  source: DiscoverySource;
  visibility?: "public" | "private";
  scoreLexical: number;
  scoreSemantic: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface DiscoveryMetadata {
  source: DiscoverySource;
  sourceLabel: string;
  personalization: DiscoveryPersonalization;
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

export function buildDiscoveryMetadata(input: DiscoveryMetadataInput): DiscoveryMetadata {
  const metadata = input.metadata ?? {};
  const tags = stringArray(metadata.tags);
  const personalityMatches = stringArray(metadata.personalityMatches);
  const sectorLinks = stringArray(metadata.sectorLinks);
  const category = firstString(metadata.category);
  const isPrivate = input.visibility === "private";
  const sourceLabel = isPrivate
    ? "Contenuti personali"
    : input.source === "live"
      ? TYPE_SOURCE_LABELS[input.type] ?? PUBLIC_SOURCE_LABELS.live
      : PUBLIC_SOURCE_LABELS[input.source];

  const reasonLabels: string[] = [];
  const matchSignals: string[] = [];

  if (input.scoreLexical > 0) {
    reasonLabels.push("Match nel titolo o contenuto");
    matchSignals.push("lexical");
  }
  if (input.scoreSemantic != null && input.scoreSemantic > 0) {
    reasonLabels.push("Match semantico");
    matchSignals.push("semantic");
  }
  if (isPrivate) {
    reasonLabels.push("Dati del tuo profilo");
    matchSignals.push("private");
  }
  if (category) {
    reasonLabels.push(`Categoria: ${category}`);
    matchSignals.push(`category:${category}`);
  }
  for (const match of personalityMatches.slice(0, 2)) {
    reasonLabels.push(`Profilo: ${match}`);
    matchSignals.push(`personality:${match}`);
  }
  for (const tag of tags.slice(0, 2)) {
    reasonLabels.push(`Tema: ${tag}`);
    matchSignals.push(`tag:${tag}`);
  }
  for (const sector of sectorLinks.slice(0, 2)) {
    reasonLabels.push(`Settore: ${sector}`);
    matchSignals.push(`sector:${sector}`);
  }
  if (input.source === "fallback") {
    reasonLabels.push("Contenuto generale");
    matchSignals.push("fallback");
  }
  if (reasonLabels.length === 0) {
    reasonLabels.push(TYPE_SOURCE_LABELS[input.type] ?? "Contenuto NorthStar");
  }

  return {
    source: input.source,
    sourceLabel,
    personalization: isPrivate ? "private" : personalityMatches.length > 0 ? "profile" : "generic",
    reasonLabels: Array.from(new Set(reasonLabels)).slice(0, 4),
    matchSignals: Array.from(new Set(matchSignals)),
    actionLabel: ACTION_LABELS[input.type],
  };
}
