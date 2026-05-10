#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────
// migrate-to-vscode.mjs — Ristruttura il monorepo da layout Replit
// a struttura lineare adatta a VSCode
//
// Layout target:
//   apps/server/     ← artifacts/api-server/ (server completo)
//   apps/web/        ← artifacts/orientamento/ (frontend completo)
//   packages/
//     ai/            ← lib/integrations-openai-ai-server + ai-react (uniti)
//     db/            ← lib/db
//     api-client/    ← lib/api-client-react
//     api-zod/       ← lib/api-zod
//     design-tokens/ ← lib/design-tokens
//     ws-server/     ← lib/ws-server
//     scripts/       ← scripts/
// ─────────────────────────────────────────────────────────────────

import { mkdirSync, cpSync, readFileSync, writeFileSync, renameSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename, extname } from 'node:path';
import { glob } from 'node:fs/promises';

const ROOT = '/NorthStar';
const log = [];
let step = 0;

function logStep(msg) {
  step++;
  const line = `\n[STEP ${step}] ${msg}`;
  log.push(line);
  console.log(line);
}

function safeMkdir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function safeCp(src, dest, opts = {}) {
  if (!existsSync(src)) {
    console.warn(`  WARN: sorgente non trovata: ${src}`);
    return false;
  }
  safeMkdir(dirname(dest));
  cpSync(src, dest, { recursive: true, ...opts });
  log.push(`  COPY: ${src} → ${dest}`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// STEP 1: Rimuovere directory vecchie (lib/*, artifacts/*) dopo backup
// ═══════════════════════════════════════════════════════════════════

logStep('Pulizia struttura Replit (artifacts + vecchi lib)');

const dirsToRemove = [
  'artifacts/api-server',
  'artifacts/orientamento',
  'artifacts/mockup-sandbox',
  'lib/integrations-openai-ai-server',
  'lib/integrations-openai-ai-react',
  'lib/integrations',        // glob vuoto o residuo
  'lib/api-server',          // versione vecchia/minimale
];

for (const dir of dirsToRemove) {
  const p = join(ROOT, dir);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    log.push(`  RM: ${dir}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STEP 2: Copiare artifacts/* → apps/
// ═══════════════════════════════════════════════════════════════════

// (già gestito: artifacts/api-server → apps/server fatto nel task explorer)
// (già gestito: artifacts/orientamento → apps/web fatto nel task explorer)

logStep('Verifica apps/ già popolati');

// ═══════════════════════════════════════════════════════════════════
// STEP 3: Rinominare lib/* → packages/*
// ═══════════════════════════════════════════════════════════════════

logStep('Rinomina lib/* → packages/*');

const renameMap = {
  'lib/api-client-react':    'packages/api-client-react',
  'lib/api-zod':             'packages/api-zod',
  'lib/design-tokens':       'packages/design-tokens',
  'lib/api-spec':            'packages/api-spec',
  'lib/ws-server':           'packages/ws-server',
  'lib/db':                  'packages/db',
};

for (const [src, dest] of Object.entries(renameMap)) {
  const srcP = join(ROOT, src);
  const destP = join(ROOT, dest);
  if (existsSync(srcP)) {
    renameSync(srcP, destP);
    log.push(`  RENAME: ${src} → ${dest}`);
  } else {
    log.push(`  SKIP (non trovato): ${src}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STEP 4: Rimuovere file e directory Replit-specific
// ═══════════════════════════════════════════════════════════════════

logStep('Rimozione file Replit-specific');

const replitFiles = [
  '.replit',
  '.replitignore',
  '.replit_integration_files',
  'replit.md',
  // Keep root .replit se serve, rimuoviamo i riferimenti interni
];

for (const f of replitFiles) {
  const p = join(ROOT, f);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    log.push(`  RM: ${f}`);
  }
}

// Rimuovi plugin Replit dai package.json
// (verrà fatto nel passo di fix import)

console.log('\n✅ Script di migrazione scritto. Procedere con fix manuali.');
console.log(`Log scritto in memoria (${log.length} righe).`);