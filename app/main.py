import asyncio
import json
import os
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from app.actor_agent import ActorAgent
from app.research_agent import ResearchAgent

app = FastAPI()

# Enable CORS for the frontend
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Metrics
WEBSOCKET_CONNECTIONS = Gauge('websocket_connections_active', 'Active WebSocket Connections')
TRADE_EXECUTION_LATENCY = Histogram('trade_execution_latency_seconds', 'Latency of trade execution logic')
AGENT_MEMORY_QUERIES = Counter('agent_memory_queries_total', 'Total RAG queries made by Research Agent')

# Global Agents and State
actor_agent = ActorAgent(initial_balance=10000.0)
research_agent = ResearchAgent()

from contextlib import asynccontextmanager

# To calculate live stats, we need the most recent price
latest_market_state = {"price": 65000.0, "rsi": 50.0}

persistent_tasks = set()

async def background_redis_listener():
    r = redis.Redis(host='localhost', port=6379, db=0)
    pubsub = r.pubsub()
    await pubsub.subscribe("crypto_prices")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"].decode("utf-8"))
                latest_market_state["price"] = data.get("price", 65000.0)
                latest_market_state["rsi"] = data.get("rsi", 50.0)

                # Mock automated trading logic: Occasionally close trades randomly to simulate trading flow
                if actor_agent.open_positions and time.time() % 10 < 1:
                    trade_id = list(actor_agent.open_positions.keys())[0]
                    # We must await async functions now
                    await actor_agent.close_trade(trade_id, latest_market_state["price"])

    except Exception as e:
        print(f"Background Redis Error: {e}")
    finally:
        await pubsub.unsubscribe("crypto_prices")
        await r.close()


# -----------------
# WebSocket Endpoint
# -----------------
@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()

    # Connect to Redis
    r = redis.Redis(host='localhost', port=6379, db=0)
    pubsub = r.pubsub()
    await pubsub.subscribe("crypto_prices")

    last_send_time = 0.0
    throttle_interval = 0.5  # Only send updates every 500ms

    print("Client connected to /ws/prices")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                current_time = time.time()

                # Throttle the updates
                if current_time - last_send_time >= throttle_interval:
                    data = message["data"].decode("utf-8")

                    try:
                        await websocket.send_text(data)
                        last_send_time = current_time
                    except WebSocketDisconnect:
                        print("Client disconnected.")
                        break
                    except Exception as e:
                        print(f"Error sending message: {e}")
                        break

    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        WEBSOCKET_CONNECTIONS.dec()
        await pubsub.unsubscribe("crypto_prices")
        await r.close()
        try:
            await websocket.close()
        except Exception:
            pass



# -----------------
# State WebSocket Endpoint
# -----------------
# Broadcast task and state
active_state_connections: list[WebSocket] = []
shared_agent_state = None

async def broadcast_state_task():
    global shared_agent_state
    while True:
        try:
            # Calculate state once every tick regardless of active connections
            # to ensure first clients receive an up-to-date state instantly.
            stats = actor_agent.get_stats(current_price=latest_market_state["price"])
            active = list(actor_agent.open_positions.values())
            history = actor_agent.mock_trades[-20:] # Last 20 closed

            shared_agent_state = {
                "stats": stats,
                "trades": {
                    "active": active,
                    "history": history
                }
            }

            if active_state_connections:
                # Broadcast to all connected clients
                disconnected = []
                for ws in active_state_connections:
                    try:
                        await ws.send_json(shared_agent_state)
                    except Exception:
                        disconnected.append(ws)

                for ws in disconnected:
                    active_state_connections.remove(ws)

            await asyncio.sleep(1.0) # Update rate
        except Exception as e:
            print(f"Broadcast State Error: {e}")
            await asyncio.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    task1 = asyncio.create_task(background_redis_listener())
    persistent_tasks.add(task1)
    task1.add_done_callback(persistent_tasks.discard)

    task2 = asyncio.create_task(broadcast_state_task())
    persistent_tasks.add(task2)
    task2.add_done_callback(persistent_tasks.discard)

@app.websocket("/ws/state")
async def state_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()
    active_state_connections.append(websocket)
    print("Client connected to /ws/state")

    # Send current state immediately upon connection if available
    if shared_agent_state:
        try:
            await websocket.send_json(shared_agent_state)
        except Exception:
            pass

    try:
        # Keep connection open to receive disconnect events
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        print("Client disconnected from /ws/state")
    except Exception as e:
        print(f"State WebSocket Error: {e}")
    finally:
        if websocket in active_state_connections:
            active_state_connections.remove(websocket)
        WEBSOCKET_CONNECTIONS.dec()
        try:
            await websocket.close()
        except Exception:
            pass

# -----------------
# REST API Endpoints
# -----------------
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/stats")
async def get_stats():
    # Pass the current price so floating PnL is accurate
    return actor_agent.get_stats(current_price=latest_market_state["price"])

@app.get("/api/trades")
async def get_trades():
    # Combine active open positions and historical trades
    active = list(actor_agent.open_positions.values())
    history = actor_agent.mock_trades[-20:] # Last 20 closed
    return {"active": active, "history": history}

@app.get("/api/strategy")
async def get_strategy():
    return research_agent.get_strategy_details()

@app.get("/api/analysis")
async def get_analysis():
    analysis = research_agent.get_market_analysis(
        "BTC",
        latest_market_state["price"],
        latest_market_state["rsi"]
    )
    return {"text": analysis}

@app.get("/api/thoughts")
async def get_thoughts():
    return {"thoughts": research_agent.thought_log}

class ControlRequest(BaseModel):
    action: str

@app.post("/api/control")
async def admin_control(req: ControlRequest):
    if req.action == "reset_wallet":
        actor_agent.balance = 10000.0
        actor_agent.mock_trades = []
        actor_agent.open_positions = {}
        actor_agent.wins = 0
        actor_agent.losses = 0
        actor_agent.peak_wallet = 10000.0
        actor_agent.max_drawdown = 0.0
        actor_agent.circuit_breaker_active = False
        research_agent.thought_log = []
        return {"status": "success", "message": "Wallet and Circuit Breaker reset"}
    elif req.action == "trigger_trade":
        AGENT_MEMORY_QUERIES.inc()
        # Manually trigger a mock trade from the backend for demonstration
        # First trigger research agent analysis to populate thought log
        # Offload synchronous ChromaDB call to threadpool to prevent blocking the event loop
        conf = await run_in_threadpool(
            research_agent.analyze_current_state,
            "BTC",
            latest_market_state["price"],
            latest_market_state["rsi"]
        )

        with TRADE_EXECUTION_LATENCY.time():
             # Since it's now async, we must await it
             result = await actor_agent.execute_trade("BTC", latest_market_state["price"], conf)
        return {"status": "success", "result": result}
    elif req.action == "close_trade":
        # Manually close the oldest open trade
        if actor_agent.open_positions:
            trade_id = list(actor_agent.open_positions.keys())[0]
            with TRADE_EXECUTION_LATENCY.time():
                 result = await actor_agent.close_trade(trade_id, latest_market_state["price"])
            return {"status": "success", "result": result}
        return {"status": "error", "message": "No open trades"}

    return {"status": "error", "message": "Unknown action"}

@app.get("/")
async def root():
    return {"message": "Live Stream Crypto Trading Simulator Backend"}