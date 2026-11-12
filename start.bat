@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org then run this file again. & pause & exit /b 1)
if not exist node_modules call npm install || (pause & exit /b 1)
if not exist dist call npm run build || (pause & exit /b 1)
start "" cmd /c "timeout /t 4 >nul & start http://localhost:8080/play"
call npm start
pause
