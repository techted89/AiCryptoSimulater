import asyncio
import json
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
import os
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
import time
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import redis.asyncio as redis
from app.utils.redis import get_redis_client
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
    r = get_redis_client()
    pubsub = r.pubsub()
    await pubsub.subscribe("crypto_prices")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"].decode("utf-8"))
                latest_market_state["price"] = data.get("price", 65000.0)
                latest_market_state["rsi"] = data.get("rsi", 50.0)

                # Publish the raw data to market_ticks for decoupled agents to consume
                await r.publish("market_ticks", message["data"])
    except Exception as e:
        logger.exception(f"Background Redis Error: {e}")
    finally:
        await pubsub.unsubscribe("crypto_prices")
        await r.close()

async def watchdog_task():
    """Automated Health Watchdog."""
    import subprocess
    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    if not ollama_url.startswith("http"):
        ollama_url = f"http://{ollama_url}"

    while True:
        try:
            # Check Ollama
            ollama_ok = False
            try:
                import aiohttp
                async with aiohttp.ClientSession() as session:
                    async with session.get(ollama_url, timeout=2.0) as res:
                        ollama_ok = res.status == 200
            except Exception:
                ollama_ok = False

            # Check Redis
            r = get_redis_client()
            redis_ok = await r.ping()
            await r.close()

            if not ollama_ok or not redis_ok:
                if not getattr(actor_agent, 'paused', False):
                    logger.warning("Watchdog: Dependencies offline. Pausing Actor Agent.")
                    actor_agent.paused = True
            else:
                if getattr(actor_agent, 'paused', False):
                    logger.info("Watchdog: Dependencies restored. Resuming Actor Agent.")
                    actor_agent.paused = False

        except Exception as e:
            logger.exception(f"Watchdog Error: {e}")

        await asyncio.sleep(10)

async def maintenance_task():
    """Periodic ChromaDB pruning and strategy reflection."""
    while True:
        await asyncio.sleep(3600) # Run every hour
        try:
            await research_agent.prune_old_snapshots()
            await research_agent.reflect_on_performance()
        except Exception as e:
            logger.error(f"Maintenance task error: {e}")



# -----------------
# WebSocket Endpoint
# -----------------
@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()

    # Connect to Redis
    r = get_redis_client()
    pubsub = r.pubsub()
    await pubsub.subscribe("crypto_prices")

    last_send_time = 0.0
    throttle_interval = 0.5  # Only send updates every 500ms

    logger.info("Client connected to /ws/prices")
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
                        logger.info("Client disconnected.")
                        break
                    except Exception as e:
                        logger.warning(f"Error sending message: {e}")
                        break

    except Exception as e:
        logger.exception(f"WebSocket Error: {e}")
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
            stats = actor_agent.get_stats(price=latest_market_state["price"])
            active = list(actor_agent.open_positions.values())
            history = actor_agent.mock_trades[-20:] # Last 20 closed

            shared_agent_state = {
                "ollama": {
                    "stats": stats,
                    "trades": {
                        "active": active,
                        "history": history
                    }
                },
                "gemini": {
                    "db_size": await run_in_threadpool(lambda: research_agent.collection.count() if hasattr(research_agent, "collection") and research_agent.collection else 0),
                    "recent_snapshots": await run_in_threadpool(lambda: research_agent.get_recent_snapshots() if hasattr(research_agent, "get_recent_snapshots") else [])
                },
                "price": latest_market_state.get("price")
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
            logger.exception(f"Broadcast State Error: {e}")
            await asyncio.sleep(1.0)

@app.on_event("startup")
async def startup_event():
    r = get_redis_client()
    task1 = asyncio.create_task(background_redis_listener())
    task2 = asyncio.create_task(broadcast_state_task())
    task3 = asyncio.create_task(actor_agent.listen_market_ticks(r))
    task4 = asyncio.create_task(actor_agent.listen_trade_signals(r))
    task5 = asyncio.create_task(research_agent.listen_market_ticks(r))
    task6 = asyncio.create_task(watchdog_task())
    task7 = asyncio.create_task(maintenance_task())

    for t in [task1, task2, task3, task4, task5, task6, task7]:
        persistent_tasks.add(t)
        t.add_done_callback(persistent_tasks.discard)


@app.websocket("/ws/state")
async def state_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()
    active_state_connections.append(websocket)
    logger.info("Client connected to /ws/state")

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
        logger.info("Client disconnected from /ws/state")
    except Exception as e:
        logger.exception(f"State WebSocket Error: {e}")
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
    return actor_agent.get_stats(price=latest_market_state["price"])

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


class KeysRequest(BaseModel):
    researcher_key: str
    groq_key: str = ""


# Mock secure store
_secure_store = {}

@app.post("/api/keys")
async def set_keys(req: KeysRequest):
    _secure_store["GEMINI_API_KEY_RESEARCHER"] = req.researcher_key
    os.environ["GEMINI_API_KEY_RESEARCHER"] = req.researcher_key

    if req.groq_key:
        _secure_store["GROQ_API_KEY"] = req.groq_key
        os.environ["GROQ_API_KEY"] = req.groq_key

    return {"status": "success", "message": "API keys updated"}


class ControlRequest(BaseModel):
    action: str

@app.post("/api/control")
async def admin_control(req: ControlRequest):
    if req.action == "reset_wallet":
        actor_agent.reset()
        research_agent.thought_log = []
        return {"status": "success", "message": "Wallet and Circuit Breaker reset"}
    elif req.action == "trigger_trade":
        AGENT_MEMORY_QUERIES.inc()
        # Manually trigger a mock trade from the backend for demonstration
        # First trigger research agent analysis to populate thought log
        # Offload synchronous ChromaDB call to threadpool to prevent blocking the event loop
        conf = await research_agent.analyze_current_state(
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
            trade = actor_agent.open_positions[trade_id]
            with TRADE_EXECUTION_LATENCY.time():
                 result = await actor_agent.close_trade(trade_id, latest_market_state["price"])

                 # If the trade was linked to a memory snapshot, update its success state
                 if "memory_doc_id" in trade:
                     is_success = result.get("pnl", 0) > 0
                     await run_in_threadpool(research_agent.update_snapshot_success, trade["memory_doc_id"], is_success)

            return {"status": "success", "result": result}
        return {"status": "error", "message": "No open trades"}

    return {"status": "error", "message": "Unknown action"}

@app.get("/")
async def root():
    return {"message": "Live Stream Crypto Trading Simulator Backend"}