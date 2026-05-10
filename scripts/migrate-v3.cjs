const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\osman\\Documents\\GitHub\\NorthStar';

function log(msg) { console.log(`  >> ${msg}`); }
function ok(msg) { console.log(`  ✅ ${msg}`); }
function header(msg) { console.log(`\n═══ ${msg} ═══`); }

// ═══════════════════════════════════════════════════════════════
// STEP 0 — Backup (skip node_modules, .git)
// ═══════════════════════════════════════════════════════════════
header('STEP 0: BACKUP');

const bk = path.join(ROOT, '.migration-backup');
if (!fs.existsSync(bk)) fs.mkdirSync(bk, { recursive: true });

function cpRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) cpRecursive(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

['lib', 'artifacts', 'apps'].forEach(name => {
  const src = path.join(ROOT, name);
  if (fs.existsSync(src)) {
    cpRecursive(src, path.join(bk, name));
    log(`Backup ${name}/`);
  }
});
['package.json','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json','.gitignore']
  .forEach(f => {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(bk, f));
  });
ok('Backup completato');

// ═══════════════════════════════════════════════════════════════
// STEP 1 — Rimuovi file Replit-specific
// ═══════════════════════════════════════════════════════════════
header('STEP 1: PULIZIA REPLIT');

['.replit','.replitignore','replit.md'].forEach(f => {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) { fs.rmSync(p, {force:true}); log(`Rimosso ${f}`); }
});
const ri = path.join(ROOT, '.replit_integration_files');
if (fs.existsSync(ri)) { fs.rmSync(ri, {recursive:true,force:true}); log('Rimosso .replit_integration_files'); }

walkFiles(ROOT, /vite\.config\.ts$/, (fp) => {
  let c = fs.readFileSync(fp, 'utf8');
  const o = c;
  c = c.replace(/import\s+["'][^"']*@replit[^"']*["'];?\s*\n?/g, '');
  if (c !== o) { fs.writeFileSync(fp, c); log(`Pulito Replit import: ${path.basename(fp)}`); }
});
ok('Pulizia Replit OK');

// ═══════════════════════════════════════════════════════════════
// STEP 2 — Rinomina lib/* → packages/*
// ═══════════════════════════════════════════════════════════════
header('STEP 2: RINOMINA lib/* → packages/*');

const rmap = {
  'api-client-react': 'api-client-react',
  'api-zod': 'api-zod',
  'design-tokens': 'design-tokens',
  'api-spec': 'api-spec',
  'ws-server': 'ws-server',
  'db': 'db',
};
for (const [old, nw] of Object.entries(rmap)) {
  const src = path.join(ROOT, 'lib', old);
  const dst = path.join(ROOT, 'packages', nw);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), {recursive:true});
    fs.renameSync(src, dst);
    log(`lib/${old} → packages/${nw}`);
  }
}
ok('Rinomina completata');

// ═══════════════════════════════════════════════════════════════
// STEP 3 — Rimuovi lib/* residui
// ═══════════════════════════════════════════════════════════════
header('STEP 3: RIMUOVI lib/* residui');

['api-server','integrations-openai-ai-server','integrations-openai-ai-react','integrations'].forEach(d => {
  const p = path.join(ROOT, 'lib', d);
  if (fs.existsSync(p)) { fs.rmSync(p, {recursive:true,force:true}); log(`Rimosso lib/${d}`); }
});
ok('Pulizia lib/ completata');

// ═══════════════════════════════════════════════════════════════
// STEP 4 — Copia artifacts → apps e crea packages/ai-server
// ═══════════════════════════════════════════════════════════════
header('STEP 4: COPIA ARTIFACTS → APPS');

// Rimuovi vecchi apps
['server','web'].forEach(d => {
  const p = path.join(ROOT, 'apps', d);
  if (fs.existsSync(p)) { fs.rmSync(p, {recursive:true,force:true}); log(`Rimosso apps/${d}`); }
});

// Copia artifacts/api-server → apps/server
const asSrc = path.join(ROOT, 'artifacts', 'api-server');
if (fs.existsSync(asSrc)) {
  cpRecursive(asSrc, path.join(ROOT, 'apps', 'server'));
  log('artifacts/api-server → apps/server');
}

// Crea client.ts per cv-extractor
const cp = path.join(ROOT, 'apps', 'server', 'src', 'client.ts');
if (!fs.existsSync(cp)) {
  fs.writeFileSync(cp, `import { OpenAI } from "openai";\n\nlet _openai: OpenAI | null = null;\n\nfunction getOpenAI(): OpenAI {\n  if (_openai) return _openai;\n  const apiKey = process.env.OPENAI_API_KEY;\n  if (!apiKey) throw new Error("OPENAI_API_KEY must be set for cv-extractor.");\n  _openai = new OpenAI({ apiKey });\n  return _openai;\n}\n\nexport const openai = new Proxy({} as OpenAI, {\n  get(_t, prop) { return (getOpenAI() as any)[prop]; },\n});\n`);
  log('Creato apps/server/src/client.ts');
}

// Copia artifacts/orientamento → apps/web
const owSrc = path.join(ROOT, 'artifacts', 'orientamento');
if (fs.existsSync(owSrc)) {
  cpRecursive(owSrc, path.join(ROOT, 'apps', 'web'));
  log('artifacts/orientamento → apps/web');
}

// Crea packages/ai-server da integrations-openai-ai-server
const oldInteg = path.join(ROOT, '.migration-backup', 'lib', 'integrations-openai-ai-server', 'src');
const aiPkg = path.join(ROOT, 'packages', 'ai-server');
const aiSrc = path.join(aiPkg, 'src');

if (fs.existsSync(oldInteg)) {
  fs.mkdirSync(aiSrc, {recursive:true});
  ['db','image','audio','growth-agent','discovery-agent','batch'].forEach(d => {
    fs.mkdirSync(path.join(aiSrc, d), {recursive:true});
  });

  // Copia client principale
  const oldClient = path.join(oldInteg, 'client.ts');
  if (fs.existsSync(oldClient)) {
    fs.copyFileSync(oldClient, path.join(aiSrc, 'client.ts'));
    log('Copiato client.ts');
  }

  // Sotto-client
  for (const sub of ['db','image','audio']) {
    const f = path.join(oldInteg, sub, 'client.ts');
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(aiSrc, sub, 'client.ts')); log(`Copiato ${sub}/client.ts`); }
  }
  // index.ts sottodir
  for (const sub of ['db','image','audio','batch']) {
    const f = path.join(oldInteg, sub, 'index.ts');
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(aiSrc, sub, 'index.ts')); log(`Copiato ${sub}/index.ts`); }
  }

  // growth-agent & discovery-agent
  for (const sub of ['growth-agent','discovery-agent']) {
    const sdir = path.join(oldInteg, sub);
    if (fs.existsSync(sdir)) {
      for (const f of fs.readdirSync(sdir).filter(f => f.endsWith('.ts'))) {
        fs.copyFileSync(path.join(sdir, f), path.join(aiSrc, sub, f));
      }
      log(`Copiati ${sub}/`);
    }
  }

  // index.ts principale
  const oldIdx = path.join(oldInteg, 'index.ts');
  if (fs.existsSync(oldIdx)) { fs.copyFileSync(oldIdx, path.join(aiSrc, 'index.ts')); log('Copiato index.ts'); }

  // package.json
  fs.writeFileSync(path.join(aiPkg, 'package.json'), JSON.stringify({
    name: '@workspace/ai-server',
    version: '0.0.0',
    private: true,
    type: 'module',
    exports: {
      '.': './src/index.ts',
      './batch': './src/batch/index.ts',
      './image': './src/image/index.ts',
      './audio': './src/audio/index.ts',
      './db': './src/db/client.ts'
    },
    dependencies: { 'openai': '^6.27.0', 'drizzle-orm': '^0.45.2', 'p-limit': '^7.3.0', 'p-retry': '^7.1.1' },
    devDependencies: { '@types/node': 'catalog:' }
  }, null, 2) + '\n');
  log('Creato packages/ai-server/package.json');
}

ok('Artifacts → Apps e ai-server creato');

// ═══════════════════════════════════════════════════════════════
// STEP 5 — Fix import paths in .ts/.tsx/.json files
// ═══════════════════════════════════════════════════════════════
header('STEP 5: FIX IMPORT PATHS');

function walkFiles(dir, extRe, cb) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const fp = path.join(dir, entry.name);
    if (fp.includes('node_modules') || fp.includes('.migration-backup') || fp.includes('.git')) continue;
    if (entry.isDirectory()) walkFiles(fp, extRe, cb);
    else if (entry.isFile() && extRe.test(fp)) cb(fp);
  }
}

let fixedCount = 0;
walkFiles(ROOT, /\.(ts|tsx|json)$/, (fp) => {
  const content = fs.readFileSync(fp, 'utf8');
  let c = content;

  // 1) from "../lib/api-client-react" → "../../packages/api-client-react" (adjust depth)
  // General: from "<n>/lib/<pkg>" → "../../packages/<pkg>"
  c = c.replace(/from\s+"(\.\.\/)+(lib\/)(api-client-react|api-zod|design-tokens|api-spec|ws-server|db)"/g,
    (m, ups, lib, pkg) => {
      // For lib/* at ../../ we use: ../../packages/pkg
      return `from "../../packages/${pkg}"`;
    });

  // 2) from "../lib/integrations-openai-ai-server" → "../../packages/ai-server"
  // from "../integrations-openai-ai-server/..." → "../../packages/ai-server/..."
  c = c.replace(/from\s+"(\.\.\/)+(lib\/)?integrations-openai-ai-server(\/[^"']*)?"/g, (m) => {
    const subpath = m.includes('/growth-agent') || m.includes('/discovery-agent') || m.includes('/db') || m.includes('/client')
      ? m.replace(/(\.\.\/)+(lib\/)?integrations-openai-ai-server/, '../../packages/ai-server/src')
      : m.replace(/(\.\.\/)+(lib\/)?integrations-openai-ai-server/, '../../packages/ai-server');
    return subpath;
  });

  // 3) from "../integrations-openai-ai-react" → "../../packages/api-client-react"
  c = c.replace(/from\s+"(\.\.\/)+(lib\/)?integrations-openai-ai-react(\/[^"']*)?"/g,
    (m) => m.replace(/(\.\.\/)+(lib\/)?integrations-openai-ai-react/, '../../packages/api-client-react'));

  // 4) Workspace names
  c = c.replace(/@workspace\/integrations-openai-ai-server/g, '@workspace/ai-server');
  c = c.replace(/@workspace\/integrations-openai-ai-react/g, '@workspace/ai-client-react');

  if (c !== content) {
    fs.writeFileSync(fp, c);
    fixedCount++;
    log(`Fixed: ${path.relative(ROOT, fp)}`);
  }
});
log(`Fixati ${fixedCount} file`);
ok('Fix import completata');

// ═══════════════════════════════════════════════════════════════
// STEP 6 — pnpm-workspace.yaml
// ═══════════════════════════════════════════════════════════════
header('STEP 6: pnpm-workspace.yaml');

fs.writeFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), `packages:
  - apps/*
  - packages/*
  - scripts
catalog:
  '@replit/vite-plugin-cartographer': ^0.5.1
  '@replit/vite-plugin-dev-banner': ^0.1.1
  '@replit/vite-plugin-runtime-error-modal': ^0.0.6
  '@tailwindcss/vite': ^4.1.14
  '@tanstack/react-query': ^5.90.21
  '@types/node': ^25.3.3
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@vitejs/plugin-react': ^5.0.4
  class-variance-authority: ^0.7.1
  clsx: ^2.1.1
  drizzle-orm: ^0.45.2
  framer-motion: ^12.23.24
  lucide-react: ^0.545.0
  react: 19.1.0
  react-dom: 19.1.0
  tailwind-merge: ^3.3.1
  tailwindcss: ^4.1.14
  tsx: ^4.21.0
  vite: ^7.3.2
  wouter: ^3.3.5
  zod: ^3.25.76
minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - '@replit/*'
  - stripe-replit-sync
overrides:
  'openai>zod': '>=3.0.0 <4'
  '@esbuild-kit/esm-loader': npm:tsx@^4.21.0
  '@expo/ngrok-bin>@expo/ngrok-bin-darwin-arm64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-darwin-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-freebsd-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-arm': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-arm64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-linux-x64': '-'
  '@expo/ngrok-bin>@expo/ngrok-bin-windows-x64': '-'
  lodash@<=4.17.23: '>=4.18.0 <5'
  path-to-regexp@>=8.0.0 <8.4.0: '>=8.4.0 <9'
  picomatch@<2.3.2: '>=2.3.2 <3'
  postcss@<8.5.10: '>=8.5.10 <9'
  yaml@>=2.0.0 <2.8.3: '>=2.8.3 <3'
`);
ok('pnpm-workspace.yaml aggiornato');

// ═══════════════════════════════════════════════════════════════
// STEP 7 — Fix tsconfig names
// ═══════════════════════════════════════════════════════════════
header('STEP 7: FIX TSCONFIG REFERENCES');

walkFiles(ROOT, /tsconfig.*\.json$/, (fp) => {
  const content = fs.readFileSync(fp, 'utf8');
  let c = content;
  const o = c;
  c = c.replace(/@workspace\/integrations-openai-ai-server/g, '@workspace/ai-server');
  c = c.replace(/@workspace\/integrations-openai-ai-react/g, '@workspace/ai-client-react');
  if (c !== o) {
    fs.writeFileSync(fp, c);
    log(`Fixed: ${path.relative(ROOT, fp)}`);
  }
});
ok('tsconfig fixati');

// ═══════════════════════════════════════════════════════════════
// STEP 8 — Rimuovi artifacts se vuoto
// ═══════════════════════════════════════════════════════════════
header('STEP 8: PULIZIA FINALE');

const artDir = path.join(ROOT, 'artifacts');
if (fs.existsSync(artDir)) {
  const remaining = fs.readdirSync(artDir, {withFileTypes:true}).filter(e => e.isDirectory());
  if (remaining.length === 0) {
    fs.rmSync(artDir, {recursive:true,force:true});
    log('Rimossa artifacts/ (vuota)');
  } else {
    remaining.forEach(e => log(`ARTIFACTS RIMASTO: ${e.name}`));
  }
}

// Rimuovi .env non-example
['apps/server/.env','apps/web/.env'].forEach(f => {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) { fs.rmSync(p); log(`Rimosso ${f}`); }
});

ok('Pulizia finale OK');

// ═══════════════════════════════════════════════════════════════
// STEP 9 — Verifica struttura
// ═══════════════════════════════════════════════════════════════
header('STEP 9: STRUTTURA FINALE');

console.log('\n  apps/');
if (fs.existsSync(path.join(ROOT,'apps'))) {
  fs.readdirSync(path.join(ROOT,'apps'),{withFileTypes:true}).filter(e=>e.isDirectory()).forEach(e => console.log(`    ${e.name}/`));
}
console.log('  packages/');
if (fs.existsSync(path.join(ROOT,'packages'))) {
  fs.readdirSync(path.join(ROOT,'packages'),{withFileTypes:true}).filter(e=>e.isDirectory()).forEach(e => console.log(`    ${e.name}/`));
}
console.log('  scripts/');
if (fs.existsSync(path.join(ROOT,'scripts'))) {
  fs.readdirSync(path.join(ROOT,'scripts'),{withFileTypes:true}).filter(e=>e.isDirectory()).forEach(e => console.log(`    ${e.name}/`));
}

console.log('\n════════════════════════════════════════════════════════');
console.log('MIGRAZIONE COMPLETATA!');
console.log('════════════════════════════════════════════════════════');
console.log('Prossimi passi:');
console.log('  1. Verifica manuale import nei file critici');
console.log('  2. Rimuovi node_modules: rm -rf apps/*/node_modules packages/*/node_modules');
console.log('  3. pnpm install');
console.log('  4. pnpm run dev:all');
console.log(`\nBackup in: ${bk}`);