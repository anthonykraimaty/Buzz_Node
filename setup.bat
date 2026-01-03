@echo off
echo ========================================
echo   Buzz Quiz Game - First Time Setup
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

:: Install root dependencies
echo [STEP 1/3] Installing dependencies...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo.

:: Install workspace dependencies
echo [STEP 2/3] Installing workspace dependencies...
echo.
call npm install --workspaces
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install workspace dependencies.
    pause
    exit /b 1
)
echo.

:: Run database seed
echo [STEP 3/3] Seeding database with sample data...
echo.
echo [NOTE] Make sure MongoDB is running before continuing.
echo.
pause

call npm run seed --workspace=backend
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to seed database.
    echo Make sure MongoDB is running and accessible.
    pause
    exit /b 1
)
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo You can now run the application with:
echo   npm run dev
echo.
pause
