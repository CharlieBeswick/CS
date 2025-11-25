@echo off
REM Crypto Tickets - Backend Startup Script
REM This script will KILL any existing server and start a fresh one

SETLOCAL

REM Move to the directory that contains this script (project root)
cd /d "%~dp0"
if errorlevel 1 (
    echo ERROR: Failed to change to script directory.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  Crypto Tickets - Backend Startup
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH.
    pause
    exit /b 1
)

REM KILL any existing Node.js processes that might be using port 3000
echo Checking for existing server processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing process %%a on port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

REM Also kill any node.exe processes (more aggressive cleanup)
echo Cleaning up any Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo Done. Starting fresh server...
echo.

REM Ensure dependencies exist
IF NOT EXIST "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

REM Check if package.json exists
IF NOT EXIST "package.json" (
    echo ERROR: package.json not found.
    pause
    exit /b 1
)

REM Generate Prisma Client
echo Generating Prisma client...
call npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo WARNING: Prisma client generation had issues, but continuing...
    echo.
)

REM Check if server.js exists
IF NOT EXIST "server.js" (
    echo ERROR: server.js not found.
    pause
    exit /b 1
)

REM Start the server
echo ==========================================
echo Starting server on http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo Keep this window open!
echo ==========================================
echo.

REM Start the server - this will block and keep window open
node server.js

REM If we get here, server stopped
echo.
echo Server stopped.
pause

ENDLOCAL
