#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================="
echo " Setting up AI Crypto Trading Simulator  "
echo "========================================="

echo "1. Checking/Installing Redis..."
if ! command -v redis-server &> /dev/null
then
    echo "Redis could not be found. Attempting to install via apt-get..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -y
        sudo apt-get install -y redis-server
    else
        echo "Please install Redis manually. E.g. brew install redis"
    fi
else
    echo "Redis is already installed."
fi

echo "2. Setting up Python Virtual Environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

echo "3. Installing Backend Python Dependencies..."
pip install -r requirements.txt

echo "4. Installing Frontend Node Dependencies..."
cd frontend
# Clean install to avoid missing .bin symlinks
rm -rf node_modules
npm install --legacy-peer-deps

echo "========================================="
echo " Setup Complete!                         "
echo "========================================="
echo "To run the application natively, execute:"
echo "  ./start.sh"
echo "========================================="
