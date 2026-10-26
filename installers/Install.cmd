@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.16 or newer from https://nodejs.org then run this installer again.
  pause
  exit /b 1
)
node "%~dp0setup.mjs" "%~dp0bundle"
if errorlevel 1 (
  echo Installation failed. Read the message above.
  pause
  exit /b 1
)
echo Black Dolphin Forge is installed. Use the Desktop shortcut.
pause
