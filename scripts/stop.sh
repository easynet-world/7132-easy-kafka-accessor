#!/bin/bash

# Kafka Data Accessor - Stop Script
# Simple script to stop the Kafka Data Accessor application

echo "🛑 Stopping Kafka Data Accessor..."

# Find and stop Node.js processes running app.js
pids=$(pgrep -f "node.*app.js" 2>/dev/null || true)

if [ -n "$pids" ]; then
    echo "🔄 Found processes: $pids"
    echo "🔄 Stopping processes..."
    
    for pid in $pids; do
        kill -TERM "$pid" 2>/dev/null || true
    done
    
    # Wait a bit then force kill if still running
    sleep 2
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "⚠️  Force killing PID $pid..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done
    
    echo "✅ Application stopped"
else
    echo "ℹ️  No running processes found"
fi
