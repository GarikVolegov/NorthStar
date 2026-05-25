# DB Backup Script for NorthStar
# Usage: .\scripts\db-backup.ps1 [output-dir]
# Requires: pg_dump in PATH, DATABASE_URL environment variable

param(
    [string]$OutputDir = "./backups"
)

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dbUrl = $env:DATABASE_URL

if (-not $dbUrl) {
    Write-Error "DATABASE_URL environment variable not set"
    exit 1
}

# Ensure output directory exists
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$outputFile = Join-Path -Path $OutputDir -ChildPath "northstar_$timestamp.sql"
$logFile = Join-Path -Path $OutputDir -ChildPath "northstar_$timestamp.log"

Write-Host "Starting backup of NorthStar database..."
Write-Host "Output: $outputFile"

# Run pg_dump
pg_dump --dbname="$dbUrl" --format=custom --file="$outputFile" --verbose 2>&1 | Tee-Object -FilePath $logFile

if ($LASTEXITCODE -eq 0) {
    # Compress
    $compressedFile = "$outputFile.gz"
    if (Get-Command gzip -ErrorAction SilentlyContinue) {
        gzip -f "$outputFile"
        Write-Host "Backup compressed: $compressedFile"
    } else {
        Write-Host "Backup completed: $outputFile"
    }

    # Keep only last 7 backups
    $maxBackups = 7
    $backups = Get-ChildItem -Path $OutputDir -Filter "northstar_*.sql*" | Sort-Object Name -Descending
    if ($backups.Count -gt $maxBackups) {
        $backups[$maxBackups..($backups.Count - 1)] | ForEach-Object {
            Remove-Item -Path $_.FullName -Force
            Write-Host "Removed old backup: $($_.Name)"
        }
    }

    Write-Host "Backup completed successfully"
    exit 0
} else {
    Write-Error "Backup failed (exit code: $LASTEXITCODE)"
    exit 1
}
