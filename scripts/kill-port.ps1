# Kill process on port 5173
$port = 5173
$processOnPort = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($processOnPort) {
    $processId = $processOnPort.OwningProcess
    Write-Host "Killing process $processId on port $port..."
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

Write-Host "Starting dev server..."
pnpm run dev:web
