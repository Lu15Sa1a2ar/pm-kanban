@echo off
cd /d "%~dp0\.."
docker compose up --build -d
if %errorlevel% neq 0 exit /b %errorlevel%
echo Project Management MVP is running at http://localhost:8000
