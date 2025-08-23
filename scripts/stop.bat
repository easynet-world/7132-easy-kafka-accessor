@echo off
REM Kafka Data Accessor - Stop Script (Windows)
REM Simple script to stop the Kafka Data Accessor application

echo 🛑 Stopping Kafka Data Accessor...

REM Stop all Node.js processes
echo 🔄 Stopping Node.js processes...
taskkill /im node.exe /f >nul 2>&1

echo ✅ Application stopped
pause
