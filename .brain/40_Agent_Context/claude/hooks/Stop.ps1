$ErrorActionPreference = "SilentlyContinue"

$null = [Console]::In.ReadToEnd()

$changed = git status --short 2>$null
if (-not $changed) {
  exit 0
}

$patterns = @(
  "\.brain/",
  "packages/ai-server/src/wendy-router/",
  "apps/server/src/jobs/",
  "apps/server/src/services/wendy/",
  "packages/db/",
  "\.brain/40_Agent_Context/claude/skills/",
  "\.brain/40_Agent_Context/claude/agents/"
)

$shouldSuggest = $false
foreach ($line in $changed) {
  $normalized = $line.Replace("\", "/")
  foreach ($pattern in $patterns) {
    if ($normalized -match $pattern) {
      $shouldSuggest = $true
      break
    }
  }
  if ($shouldSuggest) { break }
}

if ($shouldSuggest) {
  Write-Output "NorthStar ADK: changed brain/planning/Wendy/RAG/DB/agent files detected."
  Write-Output "Suggested review-first follow-up: /cartographer phase-sync HEAD~1..HEAD"
}

exit 0
