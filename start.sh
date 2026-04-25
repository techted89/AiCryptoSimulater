#!/bin/bash

# ==============================================================================
# AI Crypto Trading Simulator - Tmux Service Runner
# ==============================================================================

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
# 1. Send SIGTERM gracefully first
lsof -t -i :3000 -i :3001 -i :3002 -i :8000 | xargs -r kill || true
pkill -u "$USER" -f "uvicorn app.main:app" || true
pkill -u "$USER" -f "frontend.*next" || true
pkill -u "$USER" -f "app/ingestor.py" || true

sleep 1

# 2. Escalate to SIGKILL for any stubborn remaining processes
lsof -t -i :3000 -i :3001 -i :3002 -i :8000 | xargs -r kill -9 || true
pkill -9 -u "$USER" -f "uvicorn app.main:app" || true
pkill -9 -u "$USER" -f "frontend.*next" || true
pkill -9 -u "$USER" -f "app/ingestor.py" || true

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

# Create new detached session and capture the root pane ID
PANE0=$(tmux new-session -d -s $SESSION_NAME -n "Control" -P -F "#{pane_id}")

# Window 1, Pane 0: Control & Readiness Checks
tmux send-keys -t $PANE0 "echo 'Initializing services...'" C-m

# Pane 1: Backend
PANE1=$(tmux split-window -h -t $PANE0 -P -F "#{pane_id}")
tmux send-keys -t $PANE1 "source venv/bin/activate 2>/dev/null || true; uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 | tee backend.log" C-m

# Pane 2: Data Ingestor
PANE2=$(tmux split-window -v -t $PANE1 -P -F "#{pane_id}")
tmux send-keys -t $PANE2 "source venv/bin/activate 2>/dev/null || true; PYTHONPATH=. python app/ingestor.py 2>&1 | tee ingestor.log" C-m

# Pane 3: Frontend
PANE3=$(tmux split-window -h -t $PANE0 -P -F "#{pane_id}")
# Escaping run command
tmux send-keys -t $PANE3 "cd frontend; export NEXT_TELEMETRY_DISABLED=1; npm run dev > ../frontend.log 2>&1" C-m

# Adjust layout to make all panes readable
tmux select-layout -t $SESSION_NAME tiled

# ==============================================================================
# Health Checks
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

# Run health checks directly in the active terminal to inform the user
echo "Waiting for services to spin up inside Tmux..."

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

OLLAMA_URL=${OLLAMA_BASE_URL:-"http://localhost:11434"}
# Ensure proper HTTP scheme
if [[ ! "$OLLAMA_URL" =~ ^http ]]; then
    OLLAMA_URL="http://${OLLAMA_URL}"
fi

if ! wait_for_url "$OLLAMA_URL" "Ollama Agent"; then
    echo "Error: Ollama Agent failed to start at $OLLAMA_URL. The Actor Agent requires Ollama."
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
