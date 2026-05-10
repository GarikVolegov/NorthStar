#!/usr/bin/env pwsh
# ══════════════════════════════════════════════════════════════
# migrate-v2.ps1 — Ristruttura il monorepo per VSCode
# ══════════════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"
$ROOT = "C:\Users\osman\Documents\GitHub\NorthStar"
cd $ROOT

function Log($msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }

# ══════════════════════════════════════════════════════════════
# STEP 0 — Backup
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 0: BACKUP ═══" -ForegroundColor Magenta
$bk = "$ROOT\.migration-backup"
if (!(Test-Path $bk)) { New-Item -ItemType Directory -Path $bk -Force | Out-Null }
Copy-Item "$ROOT\lib"   "$bk\lib"   -Recurse -Force; Log "Backup lib/"
Copy-Item "$ROOT\artifacts" "$bk\artifacts" -Recurse -Force; Log "Backup artifacts/"
Copy-Item "$ROOT\apps"  "$bk\apps"  -Recurse -Force; Log "Backup apps/"
foreach ($f in @("package.json","pnpm-workspace.yaml","tsconfig.json","tsconfig.base.json",".gitignore")) {
    Copy-Item "$ROOT\$f" "$bk\" -Force; Log "Backup $f"
}
Ok "Backup in $bk"

# ══════════════════════════════════════════════════════════════
# STEP 1 — Rimuovi Replit-specific
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 1: PULIZIA REPLIT ═══" -ForegroundColor Magenta
@(".replit",".replitignore","replit.md") | ForEach-Object {
    $p = "$ROOT\$_"
    if (Test-Path $p) { rm $p -Force; Log "Rimosso $_" }
}
if (Test-Path "$ROOT\.replit_integration_files") { rm "$ROOT\.replit_integration_files" -Recurse -Force; Log "Rimosso .replit_integration_files" }

# Rimuovi import replit dai vite.config.ts
Get-ChildItem -Recurse -Filter "vite.config.ts" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    $o = $c
    $c = $c -replace 'import\s*["'"'"'][^"'"'"']*@replit[^"'"'"']*["'"'"'];\s*\n?' , ''
    $c = $c -replace 'await\s+import\s*\(\)?\s*=>\s*import\s*\(\s*["'"'"'][^"'"'"']*@replit[^"'"'"']*["'"'"']\s*\)' , ''
    if ($c -ne $o) { Set-Content $_.FullName $c; Log "Pulito Replit import: $($_.Name)" }
}
Ok "Pulizia Replit OK"

# ══════════════════════════════════════════════════════════════
# STEP 2 — Rinomina lib/* → packages/*
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 2: RINOMINA lib/* → packages/* ═══" -ForegroundColor Magenta
$rmap = @{
    "api-client-react" = "api-client-react"
    "api-zod"          = "api-zod"
    "design-tokens"    = "design-tokens"
    "api-spec"         = "api-spec"
    "ws-server"        = "ws-server"
    "db"               = "db"
}
foreach ($e in $rmap.GetEnumerator()) {
    $src = "$ROOT\lib\$($e.Key)"
    $dst = "$ROOT\packages\$($e.Value)"
    if (Test-Path $src) {
        $parent = Split-Path $dst -Parent
        if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Move-Item $src $dst -Force
        Log "Rinominata: lib/$($e.Key) → packages/$($e.Value)"
    } else {
        Log "SKIP (non trovata): lib/$($e.Key)"
    }
}
Ok "Rinomina lib/* → packages/* completata"

# ══════════════════════════════════════════════════════════════
# STEP 3 — Rimuovi lib/* rimanenti (api-server vuoto, integrations)
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 3: RIMUOVI lib/* residui ═══" -ForegroundColor Magenta
$dirsToRemove = @("api-server","integrations-openai-ai-server","integrations-openai-ai-react","integrations")
foreach ($d in $dirsToRemove) {
    $p = "$ROOT\lib\$d"
    if (Test-Path $p) { rm $p -Recurse -Force; Log "Rimosso lib/$d" }
}
Ok "Pulizia lib/ completata"

# ══════════════════════════════════════════════════════════════
# STEP 4 — Copia artifacts → apps
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 4: COPIA ARTIFACTS → APPS ═══" -ForegroundColor Magenta

# 4a: Rimuovi vecchio apps/server (era minimale, sostituito da artifacts/api-server)
if (Test-Path "$ROOT\apps\server") {
    rm "$ROOT\apps\server" -Recurse -Force
    Log "Rimosso vecchio apps/server"
}
# Ricrea apps/server da artifacts/api-server
if (Test-Path "$ROOT\artifacts\api-server") {
    Copy-Item "$ROOT\artifacts\api-server" "$ROOT\apps\server" -Recurse -Force
    Log "Copiato artifacts/api-server → apps/server"
}

# 4b: apps/web da artifacts/orientamento
if (Test-Path "$ROOT\apps\web") { rm "$ROOT\apps\web" -Recurse -Force; Log "Rimosso vecchio apps/web" }
if (Test-Path "$ROOT\artifacts\orientamento") {
    Copy-Item "$ROOT\artifacts\orientamento" "$ROOT\apps/web" -Recurse -Force
    Log "Copiato artifacts/orientamento → apps/web"
}

# 4c: Crea apps/server/src/client.ts se manca (per cv-extractor)
$clientPath = "$ROOT\apps\server\src\client.ts"
if (!(Test-Path $clientPath)) {
    $clientCode = @'
import { OpenAI } from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set for cv-extractor.");
  }
  _openai = new OpenAI({ apiKey });
  return _openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_t, prop) {
    return (getOpenAI() as any)[prop];
  },
});
'@
    Set-Content $clientPath $clientCode
    Log "Creato apps/server/src/client.ts"
}
Ok "Artifacts → Apps completata"

# ══════════════════════════════════════════════════════════════
# STEP 4b — Crea packages/ai-server da integrations-openai-ai-server
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 4b: Crea packages/ai-server ═══" -ForegroundColor Magenta

# Salva i client/* del vecchio integrations-openai-ai-server
$oldIntegPath = "$ROOT\.migration-backup\lib\integrations-openai-ai-server\src"
if (Test-Path $oldIntegPath) {
    $aiServerDst = "$ROOT\packages\ai-server\src"
    if (!(Test-Path $aiServerDst)) { New-Item -ItemType Directory -Path $aiServerDst -Force | Out-Null }
    New-Item -ItemType Directory -Path "$aiServerDst\db" -Force | Out-Null
    New-Item -ItemType Directory -Path "$aiServerDst\image" -Force | Out-Null
    New-Item -ItemType Directory -Path "$aiServerDst\audio" -Force | Out-Null
    New-Item -ItemType Directory -Path "$aiServerDst\growth-agent" -Force | Out-Null
    New-Item -ItemType Directory -Path "$aiServerDst\discovery-agent" -Force | Out-Null
    New-Item -ItemType Directory -Path "$aiServerDst\batch" -Force | Out-Null

    # Copia file fondamentali
    Copy-Item "$oldIntegPath\client.ts" "$aiServerDst\client.ts" -Force
    Log "Copiato client.ts"

    foreach ($subdir in @("db","image","audio","batch")) {
        $src = "$oldIntegPath\$subdir"
        if (Test-Path $src) {
            Copy-Item "$src\client.ts" "$aiServerDst\$subdir\client.ts" -Force -ErrorAction SilentlyContinue
            Log "Copiato $subdir/client.ts"
            Copy-Item "$src\index.ts" "$aiServerDst\$subdir\index.ts" -Force -ErrorAction SilentlyContinue
        }
    }

    foreach ($subdir in @("growth-agent","discovery-agent")) {
        $src = "$oldIntegPath\$subdir"
        if (Test-Path $src) {
            Copy-Item "$src\*.ts" "$aiServerDst\$subdir\" -Force -ErrorAction SilentlyContinue
            Log "Copiati file $subdir/"
        }
    }

    # Copia index.ts
    Copy-Item "$oldIntegPath\index.ts" "$aiServerDst\index.ts" -Force -ErrorAction SilentlyContinue
    Log "Copiato index.ts"

    # Crea package.json per ai-server
    $pkgJson = @"
{
  "name": "@workspace/ai-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./batch": "./src/batch/index.ts",
    "./image": "./src/image/index.ts",
    "./audio": "./src/audio/index.ts",
    "./db": "./src/db/client.ts"
  },
  "dependencies": {
    "openai": "^6.27.0",
    "drizzle-orm": "^0.45.2",
    "p-limit": "^7.3.0",
    "p-retry": "^7.1.1"
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}
"@
    Set-Content "$ROOT\packages\ai-server\package.json" $pkgJson
    Log "Creato packages/ai-server/package.json"

    # Crea index.ts che re-esports tutto
    $mainIndex = @"
// Re-exports centralizzati — @workspace/ai-server
export { openai } from './client.js';
export { db } from './db/client.js';
export type { DB } from './db/client.js';
export * from './growth-agent/index.js';
export * from './discovery-agent/enricher-agent.js';
"@
    # Usa src/index.ts se esiste (ha già i re-export)
    if (!(Test-Path "$aiServerDst\index.ts") -or ((Get-Content "$aiServerDst\index.ts" -Raw).Length -lt 10)) {
        Set-Content "$aiServerDst\index.ts" $mainIndex
        Log "Creato src/index.ts"
    }
}
Ok "packages/ai-server creato"

# ══════════════════════════════════════════════════════════════
# STEP 5 — Aggiorna tutti gli import nei file .ts/.tsx/.json
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 5: FIX IMPORT PATH ═══" -ForegroundColor Magenta

# Build regex una volta sola
$patterns = @(
    # Relativi verso lib/* diventano packages/*
    @{ Pattern = '["'']\.\.\/(.*?)lib\/(api-client-react|api-zod|design-tokens|api-spec|ws-server|db)(["''])'; Replacement = '"packages/$2$3' },
    @{ Pattern = '["'']\.\.\/(.*?)lib\/(integrations-openai-ai-server)(["''])'; Replacement = '"packages/ai-server$3' },
    @{ Pattern = '["'']\.\.\/(.*?)lib\/(integrations-openai-ai-react)(["'"])'; Replacement = '"packages/ai-client-react$3' },
    # Workspace name cleanup
    @{ Pattern = '@workspace/integrations-openai-ai-server'; Replacement = '@workspace/ai-server' },
    @{ Pattern = '@workspace/integrations-openai-ai-react'; Replacement = '@workspace/ai-client-react' },
    # ../client relativi all'interno di packages/ai-server — verifica che puntino a src/client
    @{ Pattern = '["'']\.\.\/(?:src\/)?client(["''])'; Replacement = '"../client$1' },
    # Se in src/ qualcosa va verso ../client, mantienilo (è corretto dentro ai-server)
)

$fixedCount = 0
Get-ChildItem -Path $ROOT -Recurse -Include "*.ts", "*.tsx", "*.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($content)) { return }
    $original = $content

    # Non toccare node_modules
    if ($_.FullName -match 'node_modules') { return }

    foreach ($rule in $patterns) {
        try {
            $content = $content -replace $rule.Pattern, $rule.Replacement
        } catch {
            Write-Warning "Errore regex su $($_.FullName): $_"
        }
    }

    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content -ErrorAction SilentlyContinue
        $fixedCount++
        Log "Fixed: $(Split-Path $_.FullName -Leaf) ($(Split-Path $_.FullName -Parent | Split-Path -Leaf))"
    }
}
Log "Fixati $fixedCount file"
Ok "Fix import completata"

# ══════════════════════════════════════════════════════════════
# STEP 6 — Aggiorna pnpm-workspace.yaml
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 6: pnpm-workspace.yaml ═══" -ForegroundColor Magenta

$wsYaml = @"
packages:
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
  '@esbuild/win32-x64': npm:@esbuild/win32-x64
  lodash@<=4.17.23: '>=4.18.0 <5'
  path-to-regexp@>=8.0.0 <8.4.0: '>=8.4.0 <9'
  picomatch@<2.3.2: '>=2.3.2 <3'
  postcss@<8.5.10: '>=8.5.10 <9'
  yaml@>=2.0.0 <2.8.3: '>=2.8.3 <3'
"@
Set-Content "$ROOT\pnpm-workspace.yaml" $wsYaml
Log "Aggiornato pnpm-workspace.yaml"
Ok "Workspace YAML aggiornato"

# ══════════════════════════════════════════════════════════════
# STEP 7 — Rimuovi artifacts/ se vuoto
# ══════════════════════════════════════════════════════════════
Write-Host "`n═══ STEP 7: PULIZIA FINALE ═══" -ForegroundColor Magenta
$artifacts = "$ROOT\artifacts"
if (Test-Path $artifacts) {
    $remaining = Get-ChildItem $artifacts -Directory -ErrorAction SilentlyContinue
    if ($remaining.Count -eq 0) {
        rm $artifacts -Recurse -Force
        Log "Rimossa artifacts/ (vuota)"
    } else {
        $remaining | ForEach-Object { Log "ARTIFACTS RIMASTO: $($_.Name)" }
    }
}

# Rimuovi .migration-backup messaggio
Write-Host "`n"
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "MIGRAZIONE COMPLETATA!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Prossimi passi:" -ForegroundColor Yellow
Write-Host "  1. Verifica manualmente gli import nei file critici" -ForegroundColor Yellow
Write-Host "  2. Rimuovi node_modules e rilancia: pnpm install" -ForegroundColor Yellow
Write-Host "  3. Procedi con: pnpm run dev:all" -ForegroundColor Yellow
Write-Host ""
Write-Host "Backup salvato in: $bk" -ForegroundColor Gray