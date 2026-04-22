#!/bin/bash

# Abort on error
set -e

echo "========================================="
echo " Deploying AI Crypto Trading Simulator   "
echo "========================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "1. Checking Docker installation..."
if ! command_exists docker; then
    echo "Docker is not installed. Attempting to install Docker..."
    if command_exists apt-get; then
        . /etc/os-release
        sudo apt-get update
        sudo apt-get install -y ca-certificates curl gnupg
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$ID/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$ID \
          $VERSION_CODENAME stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    else
        echo "Automatic installation is only supported on APT-based systems."
        echo "Please install Docker manually: https://docs.docker.com/get-docker/"
        exit 1
    fi
else
    echo "Docker is already installed."
fi

echo "2. Checking Docker Compose installation..."
# Docker compose can be a standalone binary or a docker plugin
if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose is not installed. Attempting to install..."
    if command_exists apt-get; then
         sudo apt-get update
         sudo apt-get install -y docker-compose-plugin
    else
         echo "Automatic installation is only supported on APT-based systems."
         echo "Please install Docker Compose manually: https://docs.docker.com/compose/install/"
         exit 1
    fi
else
    echo "Docker Compose is already installed."
fi


echo "3. Building and Starting Docker Containers..."
# Try modern docker compose first, fallback to older docker-compose
if docker compose version >/dev/null 2>&1; then
    docker compose up --build -d
else
    docker-compose up --build -d
fi

echo "========================================="
echo " Deployment Complete!                    "
echo "========================================="
echo "The simulator is running in the background."
echo "Dashboard: http://localhost:3000"
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo "========================================="
