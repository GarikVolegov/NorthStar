$ErrorActionPreference = "Stop"

function Read-HookPayload {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [pscustomobject]@{}
  }

  try {
    return $raw | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{ raw = $raw }
  }
}

function Get-CommandText($payload) {
  if ($payload.tool_input -and $payload.tool_input.command) {
    return [string]$payload.tool_input.command
  }
  if ($payload.command) {
    return [string]$payload.command
  }
  if ($payload.raw) {
    return [string]$payload.raw
  }
  return ""
}

$payload = Read-HookPayload
$command = Get-CommandText $payload
$normalized = $command.ToLowerInvariant()

$blockedPatterns = @(
  "git\s+reset\s+--hard",
  "git\s+checkout\s+--\s+",
  "rm\s+-rf\s+",
  "remove-item.*-recurse",
  "rd\s+/s",
  "del\s+/s",
  "format\s+[a-z]:",
  "drizzle-kit\s+push\b.*prod",
  "db:push\b.*prod"
)

foreach ($pattern in $blockedPatterns) {
  if ($normalized -match $pattern) {
    [Console]::Error.WriteLine("NorthStar guardrail blocked a destructive command: $command")
    exit 2
  }
}

$touchesEnv = $normalized -match "(^|[\\/\s`"'])\.env($|[\\/\s`"'])"
$isExampleEnv = $normalized -match "\.env\.example|\.env\.staging\.example"
if ($touchesEnv -and -not $isExampleEnv) {
  [Console]::Error.WriteLine("NorthStar guardrail blocked direct access to .env. Use documented placeholders or ask for explicit approval.")
  exit 2
}

$excludedPaths = @(
  ".brain/90_code",
  ".brain\90_code",
  ".claude/worktrees",
  ".claude\worktrees",
  ".opencode/node_modules",
  ".opencode\node_modules"
)

foreach ($path in $excludedPaths) {
  if ($normalized.Contains($path)) {
    Write-Output "NorthStar guardrail notice: avoid generated/scratch path '$path' unless this is a read-only inspection."
  }
}

exit 0
