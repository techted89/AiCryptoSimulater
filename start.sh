#!/bin/bash
set -e

echo "========================================="
echo " Starting AI Crypto Trading Simulator    "
echo "========================================="

# Terminate all background processes on script exit
trap "echo 'Stopping all services...'; kill 0" EXIT

echo "Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
    echo "Redis is not running. Start Redis before running ./start.sh."
    exit 1
fi

echo "Starting Backend API..."
uvicorn app.main:app --port 8000 &

echo "Starting Data Ingestor..."
python app/ingestor.py &

echo "Starting Frontend..."
(cd frontend && npm run dev) &

echo "========================================="
echo " All services started.                   "
echo " Frontend: http://localhost:3000         "
echo " Backend:  http://localhost:8000         "
echo " Press Ctrl+C to stop.                   "
echo "========================================="

wait
