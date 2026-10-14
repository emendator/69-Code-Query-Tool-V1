<#
.SYNOPSIS
    69CodeQuery - Portable Launcher
.DESCRIPTION
    Detects environment, installs dependencies, starts backend & frontend.
    Works on any Windows 10/11 with Python 3.9+ and Node.js 18+.
#>

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Write-Step($msg) { Write-Host "`n$msg" -ForegroundColor Yellow }
function Write-OK($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "  ... $msg" -ForegroundColor Cyan }
function Write-Err($msg) { Write-Host "  [ERROR] $msg" -ForegroundColor Red }

function Test-VenvPython($exePath) {
    if (-not (Test-Path $exePath)) { return $false }
    try { $ver = & $exePath --version 2>&1; return ($LASTEXITCODE -eq 0 -and $ver -match "Python") }
    catch { return $false }
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$VenvDir = Join-Path $ScriptDir ".venv"
$LogDir = Join-Path $ScriptDir "logs"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   69CodeQuery - Portable Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project: $ScriptDir`n"

# ============================================================
#  Step 1: Check Python
# ============================================================
Write-Step "[1/5] Checking Python..."

$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try { $ver = & $cmd --version 2>&1; if ($LASTEXITCODE -eq 0 -and $ver -match "Python") { $pythonCmd = $cmd; break } }
    catch {}
}
if (-not $pythonCmd) {
    Write-Err "Python 3 not found! Please install Python 3.9+ from https://www.python.org/downloads/"
    Read-Host "Press Enter to exit"; exit 1
}
Write-OK "$(& $pythonCmd --version 2>&1)"

# ============================================================
#  Step 2: Check Node.js
# ============================================================
Write-Step "[2/5] Checking Node.js..."
try { $nodeVer = node --version 2>&1; if ($LASTEXITCODE -ne 0) { throw } }
catch {
    Write-Err "Node.js not found! Please install Node.js 18+ from https://nodejs.org/"
    Read-Host "Press Enter to exit"; exit 1
}
Write-OK "Node.js $nodeVer"

# ============================================================
#  Step 3: Setup Python virtual environment
# ============================================================
Write-Step "[3/5] Setting up Python environment..."

$pythonExe = Join-Path (Join-Path $VenvDir "Scripts") "python.exe"

if (Test-VenvPython $pythonExe) {
    Write-OK "Virtual environment is usable"
}
else {
    if (Test-Path $VenvDir) {
        Write-Info "Virtual environment is broken. Recreating..."
        Remove-Item -Path $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Info "Creating virtual environment..."
    try { & $pythonCmd -m venv "$VenvDir"; if ($LASTEXITCODE -ne 0) { throw "venv creation failed" } }
    catch { Write-Err "venv creation failed: $_"; exit 1 }
    Write-OK "Virtual environment created"
}

if (-not (Test-VenvPython $pythonExe)) {
    Write-Err "Failed to create usable virtual environment!"
    Read-Host "Press Enter to exit"; exit 1
}

Write-Info "Installing Python dependencies..."
Push-Location $BackendDir
try {
    & $pythonExe -m pip install --upgrade pip -q 2>$null
    & $pythonExe -m pip install -r requirements.txt 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ... Retrying with verbose output..."
        & $pythonExe -m pip install -r requirements.txt 2>&1
        if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    }
}
catch {
    Write-Err "Python dependency installation failed!"
    Read-Host "Press Enter to exit"; exit 1
}
finally { Pop-Location }
Write-OK "Python dependencies installed"

Write-Info "Verifying backend dependencies..."
& $pythonExe -c "import uvicorn, fastapi, sqlalchemy, pandas, openpyxl, passlib, jose, email_validator" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Err "Backend dependencies are incomplete. Try deleting the .venv folder and running 启动.bat again."
    Read-Host "Press Enter to exit"; exit 1
}
Write-OK "Backend dependencies verified"

# ============================================================
#  Step 4: Install frontend dependencies
# ============================================================
Write-Step "[4/5] Installing frontend dependencies..."

if (Test-Path (Join-Path $FrontendDir "node_modules")) {
    Write-OK "node_modules exists"
}
else {
    Write-Info "Running npm install..."
    Push-Location $FrontendDir
    try {
        npm install 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }
    catch {
        Write-Err "npm install failed!"
        Read-Host "Press Enter to exit"; exit 1
    }
    finally { Pop-Location }
    Write-OK "npm install complete"
}
Write-OK "Frontend ready"

if (-not (Test-Path (Join-Path $FrontendDir "node_modules\.bin\vite.cmd"))) {
    Write-Err "Vite is missing from node_modules. Try deleting frontend/node_modules and running 启动.bat again."
    Read-Host "Press Enter to exit"; exit 1
}
Write-OK "Frontend dependencies verified"

# ============================================================
#  Step 5: Start services
# ============================================================
Write-Step "[5/5] Starting services..."

function Cleanup {
    Write-Info "Cleaning up old processes (this project only)..."
    $dir = [regex]::Escape($ScriptDir)
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.Name -match "python|node" -and $_.CommandLine -and
        ($_.CommandLine -match $dir -or $_.CommandLine -match "main:app") -and
        ($_.CommandLine -match "uvicorn" -or $_.CommandLine -match "vite")
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Cleanup

# 准备日志目录
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$backendLog = Join-Path $LogDir "backend.log"
$frontendLog = Join-Path $LogDir "frontend.log"
Remove-Item $backendLog, $frontendLog -Force -ErrorAction SilentlyContinue

# ============================================================
#  凭据初始化：首次运行生成随机密钥写入项目根 .env（已被 .gitignore 忽略）
#  后端从 .env 读取 JWT_SECRET_KEY / SUPER_ADMIN_PASSWORD / DEFAULT_COMPANY_DB_PASSWORD
# ============================================================
function New-RandomSecret([int]$Length) {
    $chars = (48..57) + (65..90) + (97..122)
    -join (1..$Length | ForEach-Object { [char]($chars | Get-Random) })
}

$EnvFile = Join-Path $ScriptDir ".env"
$RequiredKeys = @("JWT_SECRET_KEY", "SUPER_ADMIN_PASSWORD", "DEFAULT_COMPANY_DB_PASSWORD")

$EnvValues = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $EnvValues[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$MissingKeys = @($RequiredKeys | Where-Object { -not $EnvValues[$_] })
if ($MissingKeys.Count -gt 0) {
    Write-Step "[0/5] Generating local credentials (.env)..."
    if (-not (Test-Path $EnvFile)) {
        Set-Content -Path $EnvFile -Encoding utf8 -Value @(
            "# 本地配置：由 启动.bat / start.ps1 自动生成，已被 .gitignore 忽略，请勿提交",
            ""
        )
    }
    foreach ($key in $MissingKeys) {
        $value = New-RandomSecret 40
        $EnvValues[$key] = $value
        Add-Content -Path $EnvFile -Encoding utf8 -Value "$key=$value"
        Write-OK "$key generated"
    }
}

$AdminUser = if ($EnvValues["SUPER_ADMIN_USERNAME"]) { $EnvValues["SUPER_ADMIN_USERNAME"] } else { "admin" }

# 生成服务启动脚本（用 %~dp0 相对路径避免中文路径编码问题；末尾 pause 保证窗口不会一闪而过）
$backendScript = Join-Path $LogDir "start-backend.cmd"
$frontendScript = Join-Path $LogDir "start-frontend.cmd"

@"
@echo off
chcp 65001>nul
title 69CodeQuery-Backend-8005
cd /d "%~dp0..\backend"
echo Starting backend on http://localhost:8005 ... (log: %~dp0backend.log)
"%~dp0..\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8005 --log-level info > "%~dp0backend.log" 2>&1
echo.
echo [backend exited - see %~dp0backend.log]
echo [window kept open - close it when done]
pause >nul
"@ | Set-Content -Path $backendScript -Encoding ASCII

@"
@echo off
chcp 65001>nul
title 69CodeQuery-Frontend-5178
cd /d "%~dp0..\frontend"
echo Starting frontend on http://localhost:5178 ... (log: %~dp0frontend.log)
npx vite --host --port 5178 > "%~dp0frontend.log" 2>&1
echo.
echo [frontend exited - see %~dp0frontend.log]
echo [window kept open - close it when done]
pause >nul
"@ | Set-Content -Path $frontendScript -Encoding ASCII

function Wait-ForUrl($Name, $Url, $TimeoutSec) {
    for ($i = 0; $i -lt $TimeoutSec; $i++) {
        Start-Sleep 1
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-OK "$Name is running ($Url)"
                return $true
            }
        }
        catch { }
    }
    return $false
}

function Show-LogTail($LogFile) {
    if (-not (Test-Path $LogFile)) { Write-Host "    (no log file yet)" -ForegroundColor Gray; return }
    Get-Content $LogFile -Tail 25 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
}

Write-Info "Starting backend (port 8005)..."
Start-Process -FilePath $backendScript -WorkingDirectory $BackendDir -WindowStyle Normal

Write-Info "Starting frontend (port 5178)..."
Start-Process -FilePath $frontendScript -WorkingDirectory $FrontendDir -WindowStyle Normal

Write-Info "Waiting for backend to start..."
if (-not (Wait-ForUrl "Backend" "http://127.0.0.1:8005/docs" 40)) {
    Write-Err "Backend failed to start. Error log (logs\backend.log):"
    Show-LogTail $backendLog
    Read-Host "Press Enter to exit"; exit 1
}

Write-Info "Waiting for frontend to start..."
if (-not (Wait-ForUrl "Frontend" "http://127.0.0.1:5178/" 40)) {
    Write-Err "Frontend failed to start. Error log (logs\frontend.log):"
    Show-LogTail $frontendLog
    Read-Host "Press Enter to exit"; exit 1
}

Write-OK "Services started!"
Write-Host ""
Write-Host "  Frontend : http://localhost:5178" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:8005" -ForegroundColor Cyan
Write-Host "  API Docs : http://localhost:8005/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  超级管理员账号 : $AdminUser / $($EnvValues['SUPER_ADMIN_PASSWORD'])" -ForegroundColor Yellow
Write-Host "  凭据文件       : $EnvFile" -ForegroundColor DarkGray
Write-Host "  (该文件已被 .gitignore 忽略；如需更换口令，删除账号后修改 .env 中的 SUPER_ADMIN_PASSWORD 再重启)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Tip: service windows are kept open (close them to stop). Logs: logs\backend.log, logs\frontend.log" -ForegroundColor DarkGray

Start-Process "http://localhost:5178/"
