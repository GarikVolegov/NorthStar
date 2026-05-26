import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export type WikiLLMAuthorityLevel = "core" | "support" | "peripheral";

export interface WikiLLMAuthorityEntry {
  id: string;
  match: string | string[];
  profiles?: string[];
  domains?: string[];
  authority: WikiLLMAuthorityLevel;
  weight?: number;
  reason: string;
  tags?: string[];
}

export interface WikiLLMAuthorityManifest {
  version: number;
  entries: WikiLLMAuthorityEntry[];
}

export interface WikiLLMAuthorityMatch {
  entryId: string;
  authority: WikiLLMAuthorityLevel;
  weight: number;
  reason: string;
  domains: string[];
  tags: string[];
}

const DEFAULT_MANIFEST = "config/wikillm/authority-manifest.json";
const DEFAULT_WEIGHTS: Record<WikiLLMAuthorityLevel, number> = {
  core: 1,
  support: 0.65,
  peripheral: 0.35,
};

let cached: { path: string; mtimeMs: number; manifest: WikiLLMAuthorityManifest | null } | null = null;

function workspaceRoot(): string {
  let cursor = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(cursor, "pnpm-workspace.yaml"))) return cursor;
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

function manifestPath(): string {
  const configured = process.env.WIKILLM_AUTHORITY_MANIFEST?.trim() || DEFAULT_MANIFEST;
  return isAbsolute(configured) ? configured : resolve(workspaceRoot(), configured);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function patternMatches(pattern: string, sourceFile: string): boolean {
  const normalizedPattern = normalizePath(pattern);
  const normalizedSource = normalizePath(sourceFile);
  if (normalizedPattern.includes("*")) {
    const expression = `^${normalizedPattern.split("*").map(escapeRegex).join(".*")}$`;
    return new RegExp(expression).test(normalizedSource);
  }
  if (normalizedPattern.endsWith("/")) return normalizedSource.startsWith(normalizedPattern);
  return normalizedSource === normalizedPattern || normalizedSource.startsWith(`${normalizedPattern}/`);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isAuthorityLevel(value: unknown): value is WikiLLMAuthorityLevel {
  return value === "core" || value === "support" || value === "peripheral";
}

function parseManifest(payload: unknown): WikiLLMAuthorityManifest | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.entries)) return null;
  const entries: WikiLLMAuthorityEntry[] = [];
  for (const rawEntry of record.entries) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.id !== "string" || !entry.id.trim()) continue;
    if (!(typeof entry.match === "string" || Array.isArray(entry.match))) continue;
    if (!isAuthorityLevel(entry.authority)) continue;
    if (typeof entry.reason !== "string" || !entry.reason.trim()) continue;
    const normalized: WikiLLMAuthorityEntry = {
      id: entry.id,
      match: entry.match as string | string[],
      profiles: asStringArray(entry.profiles),
      domains: asStringArray(entry.domains),
      authority: entry.authority,
      reason: entry.reason,
      tags: asStringArray(entry.tags),
    };
    if (typeof entry.weight === "number" && Number.isFinite(entry.weight)) {
      normalized.weight = Math.max(0, Math.min(1, entry.weight));
    }
    entries.push(normalized);
  }
  return { version: Number(record.version) || 1, entries };
}

export function loadWikiLLMAuthorityManifest(): WikiLLMAuthorityManifest | null {
  const path = manifestPath();
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  if (cached && cached.path === path && cached.mtimeMs === stat.mtimeMs) return cached.manifest;
  const manifest = parseManifest(JSON.parse(readFileSync(path, "utf8")));
  cached = { path, mtimeMs: stat.mtimeMs, manifest };
  return manifest;
}

export function matchWikiLLMAuthority(
  sourceFile: string | null,
  profile: string,
): WikiLLMAuthorityMatch | null {
  if (!sourceFile) return null;
  const manifest = loadWikiLLMAuthorityManifest();
  if (!manifest) return null;
  const matches = manifest.entries
    .filter((entry) => {
      if (entry.profiles?.length && !entry.profiles.includes(profile) && !entry.profiles.includes("all")) {
        return false;
      }
      const patterns = Array.isArray(entry.match) ? entry.match : [entry.match];
      return patterns.some((pattern) => patternMatches(pattern, sourceFile));
    })
    .map((entry) => ({
      entryId: entry.id,
      authority: entry.authority,
      weight: entry.weight ?? DEFAULT_WEIGHTS[entry.authority],
      reason: entry.reason,
      domains: entry.domains ?? [],
      tags: entry.tags ?? [],
    }))
    .sort((a, b) => b.weight - a.weight);
  return matches[0] ?? null;
}
