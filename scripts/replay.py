import asyncio
import json
import redis.asyncio as redis
import time
import argparse

async def record(duration_seconds: int, output_file: str):
    print(f"Starting to record Redis 'crypto_prices' channel for {duration_seconds} seconds...")
    r = redis.Redis(host='localhost', port=6379, db=0)
    pubsub = r.pubsub()
    await pubsub.subscribe("crypto_prices")

    start_time = time.time()
    events = []

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"].decode("utf-8"))
                events.append(data)

                if time.time() - start_time >= duration_seconds:
                    break
    finally:
        await pubsub.unsubscribe("crypto_prices")
        await r.close()

    with open(output_file, 'w') as f:
        json.dump(events, f)

    print(f"Recorded {len(events)} ticks to {output_file}")

async def replay(input_file: str, speed_multiplier: float):
    print(f"Loading {input_file} for replay at {speed_multiplier}x speed...")
    with open(input_file, 'r') as f:
        events = json.load(f)

    if not events:
        print("No events found.")
        return

    r = redis.Redis(host='localhost', port=6379, db=0)

    print(f"Replaying {len(events)} ticks...")
    try:
        for i in range(len(events)):
            event = events[i]
            await r.publish("crypto_prices", json.dumps(event))

            if i < len(events) - 1:
                # Calculate time to next tick
                next_event = events[i+1]
                time_diff = max(0.01, next_event["timestamp"] - event["timestamp"])
                wait_time = time_diff / speed_multiplier
                await asyncio.sleep(wait_time)

    finally:
        await r.close()
    print("Replay complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Replay Buffer for Crypto Sim")
    parser.add_argument("action", choices=["record", "replay"])
    parser.add_argument("--file", type=str, default="buffer.json")
    parser.add_argument("--duration", type=int, default=10, help="Record duration in seconds")
    parser.add_argument("--speed", type=float, default=1.0, help="Replay speed multiplier")

    args = parser.parse_args()

    if args.action == "record":
        asyncio.run(record(args.duration, args.file))
    elif args.action == "replay":
        asyncio.run(replay(args.file, args.speed))