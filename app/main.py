import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis
from app.actor_agent import ActorAgent

app = FastAPI()

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Actor Agent instance for the backend state
actor_agent = ActorAgent(initial_balance=10000.0)

# -----------------
# WebSocket Endpoint
# -----------------
@app.websocket("/ws/prices")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

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
        await pubsub.unsubscribe("crypto_prices")
        await r.close()
        try:
            await websocket.close()
        except Exception:
            pass

# -----------------
# REST API Endpoints
# -----------------
@app.get("/api/stats")
async def get_stats():
    return actor_agent.get_stats()

@app.get("/api/trades")
async def get_trades():
    # Return the last 20 trades
    return {"trades": actor_agent.mock_trades[-20:]}

class ControlRequest(BaseModel):
    action: str

@app.post("/api/control")
async def admin_control(req: ControlRequest):
    if req.action == "reset_wallet":
        actor_agent.balance = 10000.0
        actor_agent.mock_trades = []
        return {"status": "success", "message": "Wallet reset to $10,000"}
    elif req.action == "trigger_trade":
        # Manually trigger a mock trade from the backend for demonstration
        result = actor_agent.execute_trade("BTC", 65000.0, 0.95)
        return {"status": "success", "result": result}

    return {"status": "error", "message": "Unknown action"}

@app.get("/")
async def root():
    return {"message": "Live Stream Crypto Trading Simulator Backend"}