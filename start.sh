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
    pkill -f "uvicorn app.main:app" || true
    pkill -f "next" || true
    pkill -f "app/ingestor.py" || true
}
trap cleanup SIGINT SIGTERM EXIT

echo "Cleaning up lingering ports before starting..."
lsof -t -i :3000 | xargs -r kill -9 || true
lsof -t -i :8000 | xargs -r kill -9 || true


echo "========================================="
echo " Starting AI Crypto Trading Simulator    "
echo "========================================="

echo "Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
    echo "Redis is not running. Attempting to start Redis..."
    sudo service redis-server start || redis-server --daemonize yes || echo "Failed to start Redis"
    sleep 2 # Give Redis time to start
fi

echo "Setting environment variables..."
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: .env file not found. Falling back to defaults."
fi

# Activate the virtual environment before running python/uvicorn
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Starting Backend API..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

echo "Starting Data Ingestor..."
python app/ingestor.py > ingestor.log 2>&1 &
INGESTOR_PID=$!
PIDS+=($INGESTOR_PID)

echo "Starting Frontend..."
(cd frontend && npm run dev) > frontend.log 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

wait_for_url() {
    local URL=$1
    local SERVICE_NAME=$2
    local MAX_RETRIES=60
    local RETRIES=0

    echo -n "Waiting for $SERVICE_NAME to be ready..."
    while ! curl -s "$URL" > /dev/null; do
        if [ $RETRIES -eq $MAX_RETRIES ]; then
            echo " Failed!"
            return 1
        fi
        echo -n "."
        sleep 1
        RETRIES=$((RETRIES+1))
    done
    echo " Ready!"
    return 0
}

wait_for_url "http://localhost:8000/" "Backend API"
wait_for_url "http://localhost:3000/" "Frontend"

if kill -0 "$INGESTOR_PID" 2>/dev/null; then
    echo "Data Ingestor is running."
else
    echo "Warning: Data Ingestor process is not running."
fi

echo "========================================="
echo " All services are actively running.      "
echo " Frontend: http://localhost:3000         "
echo " Backend:  http://localhost:8000         "
echo " Press Ctrl+C to stop.                   "
echo "========================================="

wait
