#!/bin/bash

# Setup trap to kill children on exit
PIDS=()

# ==============================================================================
# cleanup()
#
# Helper function to gracefully terminate all child background processes and
# explicit core service names when the script exits or is interrupted.
# ==============================================================================
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

SESSION_NAME="aicrypto"

echo "========================================="
echo " Starting AI Crypto Trading Simulator    "
echo "========================================="

# Ensure tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed. Please install it (e.g., sudo apt install tmux)."
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

echo "Cleaning up lingering ports before starting..."
lsof -t -i :3000 -i :3001 -i :3002 -i :8000 | xargs -r kill -9 || true
pkill -f "uvicorn app.main:app" || true
pkill -f "next" || true
pkill -f "node.*next" || true
pkill -f "app/ingestor.py" || true

echo "Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
    echo "Redis is not running. Attempting to start Redis..."
    sudo service redis-server start || redis-server --daemonize yes || echo "Failed to start Redis"
    sleep 2
fi

echo "Setting environment variables..."
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: .env file not found. Falling back to defaults."
fi

# ==============================================================================
# Tmux Session Initialization
# ==============================================================================

# Create new detached session
tmux new-session -d -s $SESSION_NAME -n "Control"

# Window 1, Pane 0: Control & Readiness Checks
tmux send-keys -t $SESSION_NAME:0.0 "echo 'Initializing services...'" C-m

# Pane 1: Backend
tmux split-window -h -t $SESSION_NAME:0.0
tmux send-keys -t $SESSION_NAME:0.1 "source venv/bin/activate 2>/dev/null || true; uvicorn app.main:app --host 0.0.0.0 --port 8000 | tee backend.log" C-m

echo "Starting Backend API..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
PIDS+=("$BACKEND_PID")

echo "Starting Data Ingestor..."
PYTHONPATH=. python app/ingestor.py > ingestor.log 2>&1 &
INGESTOR_PID=$!
PIDS+=("$INGESTOR_PID")

export NEXT_TELEMETRY_DISABLED=1
echo "Starting Frontend..."
(cd frontend && npm run dev) > frontend.log 2>&1 &
FRONTEND_PID=$!
PIDS+=("$FRONTEND_PID")

# ==============================================================================
# wait_for_url()
#
# Repeatedly probes a given URL until it returns a successful HTTP status code
# or reaches a maximum timeout limit.
#
# Args:
#   URL: The HTTP URL to test (e.g., "http://localhost:8000/").
#   SERVICE_NAME: A friendly name for the service being tested (for logging).
#
# Returns:
#   0 if the URL becomes successfully responsive within the timeout limit.
#   1 if the maximum number of retries is reached.
# ==============================================================================
wait_for_url() {
    local URL=$1
    local SERVICE_NAME=$2
    local MAX_RETRIES=60
    local RETRIES=0

    echo -n "Waiting for $SERVICE_NAME to be ready..."
    while ! curl -fsS "$URL" > /dev/null 2>&1; do
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

if ! wait_for_url "http://74.208.167.101:11434" "Ollama Agent"; then
    echo "Error: Ollama Agent failed to start. The Actor Agent requires Ollama."
    exit 1
fi

if ! wait_for_url "http://localhost:8000/" "Backend API"; then
    echo "Error: Backend API failed to start."
    echo "--- Backend Logs ---"
    tail -n 50 backend.log
    echo "--------------------"
    tmux kill-session -t $SESSION_NAME
    exit 1
fi

if ! wait_for_url "http://localhost:3000/" "Frontend"; then
    echo "Error: Frontend failed to start."
    echo "--- Frontend Logs ---"
    tail -n 50 frontend.log
    echo "---------------------"
    tmux kill-session -t $SESSION_NAME
    exit 1
fi

if ! wait_for_url "http://74.208.167.101:11434" "Ollama Agent"; then
    echo "Error: Ollama Agent failed to start. The Actor Agent requires Ollama."
    tmux kill-session -t $SESSION_NAME
    exit 1
fi

echo "========================================="
echo " All services are actively running in Tmux."
echo " Frontend: http://localhost:3000         "
echo " Backend:  http://localhost:8000         "
echo " "
echo " Run 'tmux attach -t $SESSION_NAME' to view logs."
echo " Run 'tmux kill-session -t $SESSION_NAME' to stop."
echo "========================================="
