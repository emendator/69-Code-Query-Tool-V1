@echo off
chcp 65001 >nul
title 69码查询器
setlocal enabledelayedexpansion

set "PS_CMD=powershell"
where %PS_CMD% >nul 2>nul
if errorlevel 1 (
    echo [ERROR] PowerShell not found!
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "PS1_FILE=%SCRIPT_DIR%start.ps1"
if not exist "%PS1_FILE%" (
    echo [ERROR] start.ps1 not found
    pause
    exit /b 1
)

%PS_CMD% -NoProfile -ExecutionPolicy Bypass -File "%PS1_FILE%"

if errorlevel 1 (
    echo.
    echo [ERROR] Startup script failed.
    pause
    exit /b 1
)

pause
