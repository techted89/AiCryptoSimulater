import asyncio
import websockets
import time
import json

async def measure_websocket():
    async with websockets.connect("ws://localhost:8000/ws/state") as websocket:
        start_time = time.time()
        messages = 0
        while time.time() - start_time < 5:
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                messages += 1
            except asyncio.TimeoutError:
                pass
        print(f"WebSocket baseline: {messages} pushed updates in 5s (0 HTTP polling requests)")

# asyncio.run(measure_websocket())
