@echo off
echo Starting Lighthouse...
cd /d %~dp0
start node server.js
timeout /t 2 /nobreak > nul
start chrome http://localhost:3000/job-tracker
