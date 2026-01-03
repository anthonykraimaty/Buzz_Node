@echo off
echo ==========================================
echo   BUZZ! Quiz Game - Installing Dependencies
echo ==========================================
echo.

echo Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Backend installation failed!
    pause
    exit /b 1
)
echo Backend dependencies installed successfully!
echo.

echo Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Frontend installation failed!
    pause
    exit /b 1
)
echo Frontend dependencies installed successfully!
echo.

echo ==========================================
echo   All dependencies installed successfully!
echo ==========================================
echo.
pause
