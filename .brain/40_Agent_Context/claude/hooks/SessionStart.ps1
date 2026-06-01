$ErrorActionPreference = "Stop"

$null = [Console]::In.ReadToEnd()
$root = (Resolve-Path ".").Path

Write-Output "NorthStar context loaded from $root"
Write-Output "- Read AGENTS.md, then .brain/40_Agent_Context/AGENT_CONTEXT.md for repo operating rules."
Write-Output "- Brain root: .brain/_ROOT_MOC.md"
Write-Output "- Current phase: .brain/30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md"
Write-Output "- Exclude generated/scratch paths: .brain/90_Code, node_modules, local tool scratch dirs"

exit 0
