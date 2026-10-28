@echo off
rem Ice Tank Sumo: builds the game and starts the multiplayer server.
rem Double-click this file. Keep the window open while you play; close it to stop.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed yet. Install the LTS version from https://nodejs.org
  echo and then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo Installing or updating what the game needs (first time can take a minute)...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo Installing failed. Check your internet connection and try again.
  pause
  exit /b 1
)
call npm start
pause
