#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo " Setting up AI Crypto Trading Simulator  "
echo "========================================="

echo "1. Checking/Installing Redis..."
if ! command -v redis-server &> /dev/null
then
    echo "Redis could not be found. Please install Redis manually."
    echo "On Ubuntu/Debian: sudo apt-get update && sudo apt-get install redis-server"
    echo "On MacOS: brew install redis"
else
    echo "Redis is already installed."
fi

echo "2. Installing Backend Python Dependencies..."
pip install -r requirements.txt
pip install pytest pytest-asyncio # Ensure test dependencies are present

echo "3. Installing Frontend Node Dependencies..."
cd frontend
npm install

echo "========================================="
echo " Setup Complete!                         "
echo "========================================="
echo "To run the application, open 3 terminals and run:"
echo "  1. uvicorn app.main:app --reload --port 8000"
echo "  2. python app/ingestor.py"
echo "  3. cd frontend && npm run dev"
echo "========================================="
