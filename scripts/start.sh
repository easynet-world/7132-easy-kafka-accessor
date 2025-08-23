#!/bin/bash

# Kafka Data Accessor - Start Script
# Simple script to start the Kafka Data Accessor application

echo "🚀 Starting Kafka Data Accessor..."

# Check if .env exists, create from example if not
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, creating from env.example..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "✅ Created .env from env.example"
        echo "⚠️  Please edit .env with your Kafka configuration"
    fi
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the application
echo "🎯 Starting application..."
node app.js
