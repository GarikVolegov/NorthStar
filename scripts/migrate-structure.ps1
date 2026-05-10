#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════
# migrate-vscode.ps1 — Ristruttura il monorepo da layout Replit
# a struttura lineare adatta a VSCode
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ROOT = "C:\Users\osman\Documents\GitHub\NorthStar"
cd $ROOT

function Log($msg) { Write-Host "  >> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Ok($msg) { Write-Host "  ✅ $msg" -ForegroundColor Green }

# ═══════════════════════════════════════════════════════════════════
# STEP 0: Backup completo
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 0: BACKUP" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

$backupDir = "$ROOT\.migration-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

foreach ($dir in @("lib", "artifacts", "apps", "scripts")) {
    $src = Join-Path $ROOT $dir
    $dst = Join-Path $backupDir $dir
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
        Log "Backup: $dir → .migration-backup\$dir"
    }
}
# Backup root config files
foreach ($f in @("package.json", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json", ".gitignore")) {
    Copy-Item -Path (Join-Path $ROOT $f) -Destination $backupDir -Force
}
Ok "Backup completato in $backupDir"

# ═══════════════════════════════════════════════════════════════════
# STEP 1: Rimuovere file/directory Replit-specific
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 1: PULIZIA REPLIT" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

$replitTargets = @(
    "$ROOT\.replit",
    "$ROOT\.replitignore",
    "$ROOT\replit.md",
    "$ROOT\.replit_integration_files"
)

foreach ($t in $replitTargets) {
    if (Test-Path $t) {
        Remove-Item -Path $t -Recurse -Force
        Log "Rimosso: $(Split-Path $t -Leaf)"
    }
}

# Rimuovi riferimenti Replit dai package.json
Get-ChildItem -Path $ROOT -Recurse -Filter "package.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    # Rimuovi plugin Replit dal campo "dependencies" e "devDependencies"
    $content = $content -replace ',\s*"@replit/[^"]+":\s*"[^"]*"' , ''
    $content = $content -replace '"@replit/[^"]+":\s*"[^"]*",?\s*', ''
    # Rimuovi riferimenti replit in scripts
    $content = $content -replace '"(dev|build|start)":\s*"[^"]*replit[^"]*"', '"$1": ""'
    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content
        Log "Pulito: $($_.FullName)"
    }
}

# Rimuovi riferimenti Replit da vite.config.ts
Get-ChildItem -Path $ROOT -Recurse -Filter "vite.config.ts" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    $content = $content -replace 'import\s+.*@replit/[^;]+;\s*\n?' , ''
    $content = $content -replace 'import\s*\{[^}]*\}\s*from\s*["'"']@replit/[^"'"']*["'"'];\s*\n?' , ''
    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content
        Log "Pulito Replit import: $($_.FullName)"
    }
}

Ok "Pulizia Replit completata"

# ═══════════════════════════════════════════════════════════════════
# STEP 2: Aggiorna lib/* → packages/* nei riferimenti esistenti
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 2: AGGIORNA RIFERIMENTI lib/* → packages/*" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

# Prima rinomina le directory
$renameMap = @{
    "$ROOT\lib\api-client-react"     = "$ROOT\packages\api-client-react"
    "$ROOT\lib\api-zod"              = "$ROOT\packages\api-zod"
    "$ROOT\lib\design-tokens"        = "$ROOT\packages\design-tokens"
    "$ROOT\lib\api-spec"             = "$ROOT\packages\api-spec"
    "$ROOT\lib\ws-server"            = "$ROOT\packages\ws-server"
    "$ROOT\lib\db"                   = "$ROOT\packages\db"
}

foreach ($entry in $renameMap.GetEnumerator()) {
    if (Test-Path $entry.Key) {
        $parent = Split-Path $entry.Value -Parent
        if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Move-Item -Path $entry.Key -Destination $entry.Value -Force
        Log "Rinominata: $(Split-Path $entry.Key -Leaf) → $(Split-Path $entry.Value -Leaf)"
    } else {
        Warn "Non trovata: $($entry.Key)"
    }
}

# Ora aggiorna tutti i riferimenti relativi nei file .ts/.tsx/.json
Get-ChildItem -Path $ROOT -Recurse -Include "*.ts", "*.tsx", "*.json", "*.yaml", "*.yml" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content

    # Sostituisci import relativi che puntano a lib/*
    $content = $content -replace '["'"'"']\.\.\/(.*?)lib\/(api-client-react|api-zod|design-tokens|api-spec|ws-server|db)["'"'"']' , '"packages/$2"'
    $content = $content -replace '["'"'"']\.\.\/(.*?)lib\/(api-client-react|api-zod|design-tokens|api-spec|ws-server|db)/(["'"'"'])' , '"packages/$2/$3'

    # Sostituisci workspace imports per vecchi nomi @workspace/integrations-*
    $content = $content -replace '@workspace/integrations-openai-ai-server' , '@workspace/ai-server'
    $content = $content -replace '@workspace/integrations-openai-ai-react' , '@workspace/ai-client-react'

    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content
        Log "Aggiornati import in: $($_.FullName)"
    }
}

Ok "Riferimenti aggiornati"

# ═══════════════════════════════════════════════════════════════════
# STEP 3: Copiare artifacts/* → apps/
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 3: COPIA ARTIFACTS → APPS" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

# 3a: artifacts/api-server → apps/server
# Prima salva il client.ts che avevamo creato
$oldServerClient = "$ROOT\apps\server\src\client.ts"
$tempClient = "$ROOT\apps\server\src\client.ts.bak"
if (Test-Path $oldServerClient) { Move-Item $oldServerClient $tempClient -Force }

# Rimuovi vecchio apps/server (era minimale)
if (Test-Path "$ROOT\apps\server") {
    Remove-Item "$ROOT\apps\server" -Recurse -Force
    Log "Rimosso vecchio apps/server"
}

# Copia artifacts/api-server → apps/server
if (Test-Path "$ROOT\artifacts\api-server") {
    Copy-Item "$ROOT\artifacts\api-server" "$ROOT\apps\server" -Recurse -Force
    Log "Copiato artifacts/api-server → apps/server"
}

# Ripristina client.ts per cv-extractor
if (Test-Path $tempClient) {
    Move-Item $tempClient "$ROOT\apps\server\src\client.ts" -Force
    Log "Ripristinato client.ts per cv-extractor"
} else {
    # Crea il client.ts se manca
    $clientContent = @'
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
    Set-Content -Path "$ROOT\apps\server\src\client.ts" -Value $clientContent
    Log "Creato nuovo client.ts per cv-extractor"
}

# 3b: artifacts/orientamento → apps/web
if (Test-Path "$ROOT\artifacts\orientamento") {
    Remove-Item "$ROOT\apps\web" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item "$ROOT\artifacts\orientamento" "$ROOT\apps\web" -Recurse -Force
    Log "Copiato artifacts/orientamento → apps/web"
}

Ok "Artifacts copiati in apps/"

# ═══════════════════════════════════════════════════════════════════
# STEP 4: Rinominare package names
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 4: AGGIORNA NOMI PACKAGE" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

# Map of old → new package names
$packageRenameMap = @{
    "@workspace/api-server"          = "@workspace/ai-server"
    "@workspace/integrations-openai-ai-server"  = "@workspace/ai-server"
    "@workspace/integrations-openai-ai-react"   = "@workspace/ai-client-react"
}

Get-ChildItem -Path $ROOT -Recurse -Filter "package.json" -File -ErrorAction SilentlyContinue | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content

    foreach ($entry in $packageRenameMap.GetEnumerator()) {
        if ($content -match [regex]::Escape($entry.Key)) {
            $content = $content -replace [regex]::Escape($entry.Key), $entry.Value
        }
    }

    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content
        Log "Aggiornato nome package in: $($_.FullName)"
    }
}

Ok "Nomi package aggiornati"

# ═══════════════════════════════════════════════════════════════════
# STEP 5: Aggiorna pnpm-workspace.yaml
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 5: AGGIORNA pnpm-workspace.yaml" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

$workspaceYaml = @"
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
"
Set-Content -Path "$ROOT\pnpm-workspace.yaml" -Value $workspaceYaml
Log "Aggiornato pnpm-workspace.yaml"

Ok "pnpm-workspace.yaml aggiornato"

# ═══════════════════════════════════════════════════════════════════
# STEP 6: Rimuovere directory artifacts vuote/superflue
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 6: PULIZIA ARTIFACTS" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

# Rimuovi artifacts/ tranne eventuali rimasti utili
$artifactsDir = "$ROOT\artifacts"
if (Test-Path $artifactsDir) {
    $remaining = Get-ChildItem $artifactsDir -Directory
    if ($remaining.Count -eq 0) {
        Remove-Item $artifactsDir -Recurse -Force
        Log "Rimossa artifacts/ (vuota)"
    } else {
        foreach ($item in $remaining) {
            Warn "Artifacts rimasto: $($item.Name)"
        }
    }
}

Ok "Pulizia artifacts completata"

# ═══════════════════════════════════════════════════════════════════
# STEP 7: Verifica struttura finale
# ═══════════════════════════════════════════════════════════════════
Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "STEP 7: VERIFICA STRUTTURA" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════"

Write-Host "`n--- apps/ ---"
Get-ChildItem "$ROOT\apps" -Directory | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`n--- packages/ ---"
Get-ChildItem "$ROOT\packages" -Directory | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`n--- scripts/ ---"
Get-ChildItem "$ROOT\scripts" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`n--- Root files ---"
Get-ChildItem $ROOT -File -Include "*.yaml", "*.json", "*.md", "*.gitignore" | ForEach-Object { Write-Host "  $($_.Name)" }

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "MIGRAZIONE COMPLETATA! Verifica manuale consigliata:" -ForegroundColor Green
Write-Host "  1. Controlla gli import nei file .ts/.tsx" -ForegroundColor Green
Write-Host "  2. Verifica che i package.json siano corretti" -ForegroundColor Green
Write-Host "  3. Rimuovi node_modules e rilancia pnpm install" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green