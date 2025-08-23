@echo off
REM Kafka Data Accessor - Start Script (Windows)
REM Simple script to start the Kafka Data Accessor application

echo 🚀 Starting Kafka Data Accessor...

REM Check if .env exists, create from example if not
if not exist ".env" (
    echo ⚠️  .env file not found, creating from env.example...
    if exist "env.example" (
        copy env.example .env >nul
        echo ✅ Created .env from env.example
        echo ⚠️  Please edit .env with your Kafka configuration
    )
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Start the application
echo 🎯 Starting application...
node app.js

pause
