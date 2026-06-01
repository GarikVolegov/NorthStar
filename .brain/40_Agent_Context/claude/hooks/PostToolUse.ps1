$ErrorActionPreference = "Stop"

$raw = [Console]::In.ReadToEnd()
$payload = $null
try {
  if (-not [string]::IsNullOrWhiteSpace($raw)) {
    $payload = $raw | ConvertFrom-Json
  }
} catch {
  $payload = $null
}

$toolName = if ($payload -and $payload.tool_name) { [string]$payload.tool_name } else { "unknown" }
$command = if ($payload -and $payload.tool_input -and $payload.tool_input.command) { [string]$payload.tool_input.command } else { "" }

$logPath = Join-Path $env:TEMP "northstar-claude-hooks.jsonl"
$entry = [pscustomobject]@{
  timestamp = (Get-Date).ToString("o")
  repo = (Resolve-Path ".").Path
  tool = $toolName
  command = $command
}

($entry | ConvertTo-Json -Compress) | Add-Content -Path $logPath -Encoding UTF8

exit 0
