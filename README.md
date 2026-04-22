# AI Agent-Driven Live Stream Crypto Trading Simulator

This project is a high-performance, asynchronous trading simulator driven by AI agents. It bridges the gap between heavy data processing, RAG-based strategy development, and real-time UI updates for live streaming.

## Architecture Overview

The system is composed of several key modules:

1.  **FastAPI Backend & Data Ingestion**:
    *   `app/main.py`: The core FastAPI application providing REST endpoints and a WebSocket (`/ws/prices`) for live data streaming.
    *   `app/ingestor.py`: A background worker that pushes mock market data (price, RSI, L2 book, macro indicators, sentiment) into a Redis Pub/Sub channel.

2.  **AI Agents (The Brain & The Actor)**:
    *   `app/research_agent.py`: Uses **ChromaDB** to store "Market Memories" and analyzes current market conditions using a RAG-based approach. It outputs strategy snapshots and a confidence score.
    *   `app/actor_agent.py`: Executes mock trades based on the Research Agent's signals. It features advanced execution realism including depth-weighted L2 slippage, taker fees, perpetual funding simulation, and an automated circuit breaker based on maximum drawdown.

3.  **Next.js Dashboard**:
    *   `frontend/`: A React (Next.js 14 App Router) dashboard styled with Tailwind CSS. It features a live price chart (`TradingChart.tsx`) with liquidation heatbands, an L2 Order Book display, and a terminal streaming the AI's internal thoughts.

## Prerequisites

*   Python 3.10+
*   Node.js 18+
*   Redis Server

## Setup and Installation

You can use the provided setup script to bootstrap the environment:

```bash
chmod +x setup.sh
./setup.sh
```

Alternatively, you can install dependencies manually:

1.  **Start Redis**: Ensure your local Redis server is running (`sudo service redis-server start` or equivalent).
2.  **Backend Dependencies**: `pip install -r requirements.txt`
3.  **Frontend Dependencies**: `cd frontend && npm install`

## Running the Simulator

To start the full stack locally, simply execute the `start.sh` script:

```bash
./start.sh
```

This will automatically start the Backend API, the Data Ingestor, and the Frontend UI in the background. Navigate to `http://localhost:3000` to view the live dashboard. To stop all services, press `Ctrl+C` in the terminal.

## Running Tests

To run the core backend logic tests:

```bash
PYTHONPATH=. pytest tests/test_flow.py
```