import asyncio
import websockets
import json

async def listen_to_ws():
    uri = "ws://localhost:8000/ws/prices"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Listening for messages...")
            # Listen for 3 messages to verify throttling and data flow
            for i in range(3):
                message = await websocket.recv()
                data = json.loads(message)
                print(f"Received tick {i+1}: {data}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(listen_to_ws())