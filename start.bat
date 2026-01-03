@echo off
echo ==========================================
echo   BUZZ! Quiz Game - Starting Servers
echo ==========================================
echo.

echo Starting Backend server (port 3005)...
start "Buzz Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

timeout /t 2 /nobreak > nul

echo Starting Frontend server (port 3006)...
start "Buzz Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================
echo   Servers starting in separate windows!
echo ==========================================
echo.
echo   Backend:  http://localhost:3005
echo   Frontend: http://localhost:3006
echo.
echo   Press any key to close this window...
pause > nul
