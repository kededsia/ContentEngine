@echo off
setlocal
echo ==========================================
echo      KONSEP DESKTOP AUTOMATION START
echo ==========================================

echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo Frontend dependencies missing. Installing...
    call npm install
)
if not exist "backend\node_modules" (
    echo Backend dependencies missing. Installing...
    cd backend
    call npm install
    cd ..
)

echo [2/4] Cleaning up existing processes (Port 3000, 5173)...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq Konsep*" >nul 2>&1
echo       Cleanup done.

echo [3/4] Starting Backend Server...
start "Konsep Backend" /min cmd /K "cd /d %~dp0backend && node server.js"

echo [4/4] Starting Frontend Server...
start "Konsep Frontend" /min cmd /K "cd /d %~dp0 && npm run dev"

echo Waiting for services to initialize...
timeout /t 5 >nul

echo Opening Application...
start http://localhost:8080

echo ==========================================
echo      SYSTEM IS RUNNING
echo ==========================================
echo Backend running on Port 3000
echo Frontend running on Port 8080/5173
echo.
pause
