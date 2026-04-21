#!/bin/bash

# Setup trap to kill children on exit
PIDS=()
cleanup() {
    echo "Stopping all processes..."
    for PID in "${PIDS[@]}"; do
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" || true
        fi
    done
}
trap cleanup SIGINT SIGTERM EXIT

echo "========================================="
echo " Starting AI Crypto Trading Simulator    "
echo "========================================="

echo "Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
    echo "Redis is not running. Attempting to start Redis..."
    sudo service redis-server start || redis-server --daemonize yes || echo "Failed to start Redis"
fi

echo "Setting environment variables..."
# Set the environment variable for the local model endpoint
export OLLAMA_BASE_URL="http://localhost:11434"

echo "Starting Backend API..."
uvicorn app.main:app --port 8000 &
PIDS+=($!)

echo "Starting Data Ingestor..."
python app/ingestor.py &
PIDS+=($!)

echo "Starting Frontend..."
(cd frontend && npm run dev) &
PIDS+=($!)

echo "========================================="
echo " All services started.                   "
echo " Frontend: http://localhost:3000         "
echo " Backend:  http://localhost:8000         "
echo " Press Ctrl+C to stop.                   "
echo "========================================="

wait
