@echo off
REM ═══════════════════════════════════════════════════════════════════
REM migrate-structure.bat — Ristruttura il monorepo per VSCode
REM Layout target:
REM   apps/server/       ← artifacts/api-server (server completo)
REM   apps/web/          ← artifacts/orientamento (frontend completo)
REM   packages/*         ← lib/* rinominati
REM   .replit*           ← rimossi
REM ═══════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion
set ROOT=C:\Users\osman\Documents\GitHub\NorthStar
cd /d %ROOT%

echo ============================================================
echo STEP 1: Backup delle directory critiche
echo ============================================================
if not exist "%ROOT%\.migration-backup" mkdir "%ROOT%\.migration-backup"
xcopy /E /I /H /Y "%ROOT%\lib" "%ROOT%\.migration-backup\lib\" >nul 2>&1
xcopy /E /I /H /Y "%ROOT%\artifacts" "%ROOT%\.migration-backup\artifacts\" >nul 2>&1
xcopy /E /I /H /Y "%ROOT%\apps" "%ROOT%\.migration-backup\apps\" >nul 2>&1
echo Backup completato in .migration-backup

echo ============================================================
echo STEP 2: Rimozione directory Replit-specifiche
echo ============================================================
if exist "%ROOT%\.replit" del /Q "%ROOT%\.replit" && echo Rimosso .replit
if exist "%ROOT%\.replitignore" del /Q "%ROOT%\.replitignore" && echo Rimosso .replitignore
if exist "%ROOT%\replit.md" del /Q "%ROOT%\replit.md" && echo Rimosso replit.md
if exist "%ROOT%\.replit_integration_files" rmdir /S /Q "%ROOT%\.replit_integration_files" && echo Rimossa .replit_integration_files

echo ============================================================
echo STEP 3: Rinomina lib/* → packages/*
echo ============================================================

:: Mappa rinomine
call :RENAME_DIR "%ROOT%\lib\api-client-react"   "%ROOT%\packages\api-client-react"
call :RENAME_DIR "%ROOT%\lib\api-zod"            "%ROOT%\packages\api-zod"
call :RENAME_DIR "%ROOT%\lib\design-tokens"      "%ROOT%\packages\design-tokens"
call :RENAME_DIR "%ROOT%\lib\api-spec"           "%ROOT%\packages\api-spec"
call :RENAME_DIR "%ROOT%\lib\ws-server"          "%ROOT%\packages\ws-server"
call :RENAME_DIR "%ROOT%\lib\db"                 "%ROOT%\packages\db"

goto :END

:RENAME_DIR
if exist %1 (
    ren %1 placeholder_temp_renamed_2026
    if exist %2 (
        echo   RENAME SKIP (dest esiste già): %~1 → %~2
    ) else (
        ren placeholder_temp_renamed_2026 "%~nx2"
        echo   RENAMED: %~1 → %~2
    )
) else (
    echo   SKIP (non trovato): %~1
)
goto :eof

:END
echo ============================================================
echo Migrazione base completata.
echo Procedere con la copia degli artifacts e fix degli import.
echo ============================================================