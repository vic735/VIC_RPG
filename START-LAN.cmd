@echo off
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node server.cjs
) else if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.cjs
) else (
  echo Node.js is not available. Open PLAY.html directly for desktop play.
)
pause
