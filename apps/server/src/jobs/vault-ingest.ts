/**
 * vault-ingest — job che indicizza il vault .brain/ in pgvector.
 *
 * Legge i file Markdown del vault con frontmatter `runtime: true`,
 * fa upsert in ragSourcesTable (sourceType='brain', identificato da
 * obsidian_path), poi chunka e genera embedding in ragChunksTable.
 *
 * Idempotente: stesso file → stesso source.id, chunk vengono ri-generati
 * solo se il contenuto è cambiato dall'ultimo ingest.
 *
 * Esclusioni:
 *  - directory `90_Code/` (junction verso graphify-out, contenuto auto)
 *  - file senza frontmatter o con `runtime: false`
 *
 * PRIVACY: il vault .brain/ è no-PII per principio (vedi Values-Principles).
 */
import { db, ragSourcesTable, ragChunksTable } from "@workspace/db";
import { generateEmbedding } from "@workspace/ai-server";
import { and, eq } from "drizzle-orm";
import { readFile, readdir, lstat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { rootLogger } from "../middleware/logger";

const log = rootLogger.child({ module: "job:vault-ingest" });

const VAULT_ROOT             = process.env.BRAIN_VAULT_ROOT ?? ".brain";
const MAX_FILES_PER_RUN      = Number(process.env.VAULT_INGEST_MAX_FILES) || 200;
const RUN_TIMEOUT_MS         = Number(process.env.VAULT_INGEST_TIMEOUT_MS) || 5 * 60_000;
const CHUNK_MAX_CHARS        = 1500; // ~375 token con text-embedding-3-small
const EXCLUDED_DIR_NAMES     = new Set(["90_Code", "node_modules", ".obsidian", ".git"]);

export type VaultIngestResult = {
  scanned: number;
  ingested: number;
  skippedNoFrontmatter: number;
  skippedRuntimeFalse: number;
  skippedUnchanged: number;
  errors: number;
  durationMs: number;
};

/**
 * Entry point del job. Schedulato in cron.ts.
 */
export async function runVaultIngest(): Promise<VaultIngestResult> {
  const startedAt = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RUN_TIMEOUT_MS);

  const result: VaultIngestResult = {
    scanned: 0, ingested: 0, skippedNoFrontmatter: 0,
    skippedRuntimeFalse: 0, skippedUnchanged: 0, errors: 0, durationMs: 0,
  };

  try {
    const files = await walkMarkdown(VAULT_ROOT, { maxFiles: MAX_FILES_PER_RUN });
    result.scanned = files.length;
    log.info({ scanned: files.length }, "[vault-ingest] discovered files");

    for (const filePath of files) {
      if (ctrl.signal.aborted) {
        log.warn({ remaining: files.length - result.ingested }, "[vault-ingest] aborted by timeout");
        break;
      }
      try {
        const outcome = await ingestFile(filePath);
        switch (outcome.kind) {
          case "ingested":      result.ingested++; break;
          case "no-frontmatter":result.skippedNoFrontmatter++; break;
          case "runtime-false": result.skippedRuntimeFalse++; break;
          case "unchanged":     result.skippedUnchanged++; break;
        }
      } catch (err) {
        result.errors++;
        log.error({ filePath, err }, "[vault-ingest] file ingest failed");
      }
    }
  } finally {
    clearTimeout(timer);
    result.durationMs = Date.now() - startedAt;
    log.info(result, "[vault-ingest] done");
  }

  return result;
}

export type IngestOutcome =
  | { kind: "ingested";       sourceId: number; chunks: number }
  | { kind: "no-frontmatter" }
  | { kind: "runtime-false" }
  | { kind: "unchanged";      sourceId: number };

export interface ExistingBrainSource {
  id: number;
  currentHash: string;
}

export interface VaultIngestSourceInput {
  name: string;
  obsidianPath: string;
}

export interface VaultIngestChunkInput {
  sourceId: number;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding: number[];
  sectors: string[];
  roles: string[];
  trustScore: number;
}

export interface VaultIngestDeps {
  cwd: string;
  virtualRoot?: string;
  findExistingSource: (obsidianPath: string) => Promise<ExistingBrainSource | null>;
  insertSource: (input: VaultIngestSourceInput) => Promise<{ id: number }>;
  updateSource: (sourceId: number) => Promise<void>;
  deleteChunks: (sourceId: number) => Promise<void>;
  insertChunk: (input: VaultIngestChunkInput) => Promise<void>;
  generateEmbedding: (text: string) => Promise<number[] | null>;
}

export function createVaultIngestDeps(): VaultIngestDeps {
  return {
    cwd: process.cwd(),
    async findExistingSource(obsidianPath) {
      const [existing] = await db
        .select({ id: ragSourcesTable.id, currentHash: ragSourcesTable.name })
        .from(ragSourcesTable)
        .where(and(
          eq(ragSourcesTable.obsidianPath, obsidianPath),
          eq(ragSourcesTable.sourceType, "brain"),
        ))
        .limit(1);
      return existing ?? null;
    },
    async insertSource(input) {
      const [source] = await db
        .insert(ragSourcesTable)
        .values({
          name:           input.name,
          sourceType:     "brain",
          format:         "markdown",
          obsidianPath:   input.obsidianPath,
          trustScore:     0.95,
          lastIngestedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: ragSourcesTable.obsidianPath,
          set:    { name: input.name, lastIngestedAt: new Date(), updatedAt: new Date() },
        })
        .returning({ id: ragSourcesTable.id });

      if (!source) throw new Error(`upsert ragSource returned no row for ${input.obsidianPath}`);
      return source;
    },
    async updateSource(sourceId) {
      await db
        .update(ragSourcesTable)
        .set({ lastIngestedAt: new Date(), updatedAt: new Date() })
        .where(eq(ragSourcesTable.id, sourceId));
    },
    async deleteChunks(sourceId) {
      await db.delete(ragChunksTable).where(eq(ragChunksTable.sourceId, sourceId));
    },
    async insertChunk(input) {
      await db.insert(ragChunksTable).values(input);
    },
    generateEmbedding,
  };
}

async function ingestFile(absolutePath: string): Promise<IngestOutcome> {
  return ingestVaultFile(absolutePath, createVaultIngestDeps());
}

export async function ingestVaultFile(
  absolutePath: string,
  deps: VaultIngestDeps,
): Promise<IngestOutcome> {
  const raw = await readFile(absolutePath, "utf-8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) return { kind: "no-frontmatter" };

  const { frontmatter: fm, body } = parsed;
  if (fm.runtime !== true) return { kind: "runtime-false" };

  const relativePath = relative(deps.cwd, absolutePath).replaceAll("\\", "/");
  const obsidianPath = deps.virtualRoot
    ? `${deps.virtualRoot.replace(/\/$/, "")}/${relativePath}`
    : relativePath;
  const layer        = typeof fm.layer === "string" ? fm.layer : "unknown";
  const tags         = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  const contentHash  = createHash("sha256").update(body).digest("hex");

  const existing = await deps.findExistingSource(obsidianPath);

  // Source name include il content hash così possiamo skippare re-embed se invariato.
  const sourceName = `${obsidianPath}#${contentHash.slice(0, 12)}`;

  if (existing && existing.currentHash === sourceName) {
    // Stesso hash → niente da fare, aggiorna solo lastIngestedAt
    await deps.updateSource(existing.id);
    return { kind: "unchanged", sourceId: existing.id };
  }

  // Upsert source
  const source = await deps.insertSource({ name: sourceName, obsidianPath });

  // Pulisci chunk vecchi e rigenera
  await deps.deleteChunks(source.id);

  const pieces = splitMarkdown(body, CHUNK_MAX_CHARS);
  let inserted = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece     = pieces[i]!;
    const embedding = await deps.generateEmbedding(piece);
    if (!embedding) continue; // generateEmbedding logga gia il warn
    await deps.insertChunk({
      sourceId:   source.id,
      content:    piece,
      chunkIndex: i,
      tokenCount: Math.ceil(piece.length / 4), // stima grezza
      embedding,
      sectors:    [layer],
      roles:      tags,
      trustScore: 0.95,
    });
    inserted++;
  }

  return { kind: "ingested", sourceId: source.id, chunks: inserted };
}

/**
 * Walk ricorsivo dei file `.md` sotto root. Salta junction/symlink e
 * directory in `EXCLUDED_DIR_NAMES`. Si ferma a `maxFiles`.
 */
export async function walkMarkdown(
  root: string,
  opts: { maxFiles: number },
): Promise<string[]> {
  const out: string[] = [];

  async function visit(dir: string): Promise<void> {
    if (out.length >= opts.maxFiles) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      log.warn({ dir, err }, "[vault-ingest] readdir failed");
      return;
    }

    for (const entry of entries) {
      if (out.length >= opts.maxFiles) return;
      const full = join(dir, entry.name);

      // Salta esplicitamente nomi noti (90_Code è una junction)
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;

      // Salta symlink/junction tramite lstat
      const stats = await lstat(full).catch(() => null);
      if (!stats) continue;
      if (stats.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }

  await visit(root);
  return out;
}

/**
 * Splitter di un markdown in chunk di max `maxChars` caratteri,
 * rispettando i confini di paragrafo (doppio newline).
 */
export function splitMarkdown(content: string, maxChars: number): string[] {
  const paragraphs = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (p.length >= maxChars) {
      if (buf) { chunks.push(buf); buf = ""; }
      // paragrafo gigante → fallback split su frasi
      for (let i = 0; i < p.length; i += maxChars) chunks.push(p.slice(i, i + maxChars));
      continue;
    }
    if (buf.length + p.length + 2 > maxChars) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

/**
 * Parser minimo di frontmatter YAML. Supporta scalari (string/number/bool),
 * array inline `[a, b, c]`, e identifica i delimitatori `---`.
 * Tutto quello che ci serve per il vault.
 */
export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} | null {
  if (!raw.startsWith("---")) return null;
  const endIdx = raw.indexOf("\n---", 3);
  if (endIdx === -1) return null;

  const yamlBlock = raw.slice(3, endIdx).trim();
  const body      = raw.slice(endIdx + 4).replace(/^\s*\n/, "");
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key   = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    frontmatter[key] = parseScalar(value);
  }

  return { frontmatter, body };
}

function parseScalar(value: string): unknown {
  if (!value) return "";
  if (value === "true")  return true;
  if (value === "false") return false;
  if (value === "null")  return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  // array inline: [a, b, c] oppure [#L1, #identity]
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  // stringa quotata
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
