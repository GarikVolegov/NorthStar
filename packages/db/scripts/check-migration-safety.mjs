#!/usr/bin/env node
import { Pool } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const drizzleDir = path.join(packageRoot, "drizzle");
const journalPath = path.join(drizzleDir, "meta", "_journal.json");

const dangerousPatterns = [
  { name: "DROP COLUMN", pattern: /\bdrop\s+column\b/i },
  { name: "DROP TABLE", pattern: /\bdrop\s+table\b/i },
  { name: "ALTER TYPE", pattern: /\balter\s+type\b/i },
  { name: "DROP TYPE", pattern: /\bdrop\s+type\b/i },
  {
    name: "ALTER TABLE ... DROP",
    pattern: /\balter\s+table\b[\s\S]*?\bdrop\b/i,
  },
  { name: "TRUNCATE", pattern: /\btruncate\b/i },
];

function loadJournal() {
  if (!existsSync(journalPath)) {
    throw new Error(`Drizzle journal not found: ${journalPath}`);
  }

  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  if (!Array.isArray(journal.entries)) {
    throw new Error(`Invalid Drizzle journal: ${journalPath}`);
  }

  return journal.entries
    .filter((entry) => typeof entry.tag === "string")
    .map((entry) => ({
      tag: entry.tag,
      when: Number(entry.when ?? 0),
      file: path.join(drizzleDir, `${entry.tag}.sql`),
    }));
}

async function getAppliedMigrations() {
  const databaseUrl =
    process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log(
      "[migrate:dry-run] DATABASE_URL_MIGRATOR/DATABASE_URL not set; treating all migrations as pending.",
    );
    console.log(
      "[migrate:dry-run] Local fixture mode: useful for safety tests, but historical destructive migrations may fail the check.",
    );
    return { hashes: new Set(), maxCreatedAt: 0 };
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query(`
      select hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at asc
    `);

    const hashes = new Set();
    let maxCreatedAt = 0;
    for (const row of result.rows) {
      if (row.hash) hashes.add(String(row.hash));
      const createdAt = Number(row.created_at ?? 0);
      if (Number.isFinite(createdAt) && createdAt > maxCreatedAt) {
        maxCreatedAt = createdAt;
      }
    }

    return { hashes, maxCreatedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/does not exist|undefined_table/i.test(message)) {
      console.log(
        "[migrate:dry-run] Drizzle migrations table not found; treating all migrations as pending.",
      );
      return { hashes: new Set(), maxCreatedAt: 0 };
    }

    throw error;
  } finally {
    await pool.end();
  }
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function listSqlFiles() {
  const files = await readdir(drizzleDir);
  return new Set(files.filter((file) => file.endsWith(".sql")));
}

function findDangerousStatements(sql) {
  return dangerousPatterns
    .filter(({ pattern }) => pattern.test(sql))
    .map(({ name }) => name);
}

const journal = loadJournal();
const sqlFiles = await listSqlFiles();
const applied = await getAppliedMigrations();

const pending = [];
for (const entry of journal) {
  const fileName = `${entry.tag}.sql`;
  if (!sqlFiles.has(fileName)) {
    throw new Error(`Migration listed in journal is missing: ${fileName}`);
  }

  const sql = readFileSync(entry.file, "utf8");
  const hash = sha256(sql);
  if (applied.hashes.has(hash) || entry.when <= applied.maxCreatedAt) {
    continue;
  }

  pending.push({
    ...entry,
    sql,
    dangerous: findDangerousStatements(sql),
  });
}

console.log(
  `[migrate:dry-run] Applied migration timestamp: ${applied.maxCreatedAt || "(none)"}`,
);
console.log(`[migrate:dry-run] Pending migrations: ${pending.length}`);

for (const migration of pending) {
  const flags =
    migration.dangerous.length > 0
      ? ` DANGEROUS: ${migration.dangerous.join(", ")}`
      : "";
  console.log(` - ${migration.tag}${flags}`);
}

const unsafe = pending.filter((migration) => migration.dangerous.length > 0);
if (unsafe.length > 0) {
  console.error(
    "[migrate:dry-run] Unsafe DDL detected. Production migration is blocked.",
  );
  for (const migration of unsafe) {
    console.error(` - ${migration.tag}: ${migration.dangerous.join(", ")}`);
  }
  process.exit(1);
}

console.log("[migrate:dry-run] Migration plan passed safety checks.");
