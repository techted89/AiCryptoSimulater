import asyncio
import json
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import redis.asyncio as redis

app = FastAPI()

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

@app.get("/")
async def root():
    return {"message": "Live Stream Crypto Trading Simulator Backend"}