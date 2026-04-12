import asyncio
import json
import random
import redis.asyncio as redis
import time

async def simulate_data_ingestion():
    # Connect to the local Redis instance
    r = redis.Redis(host='localhost', port=6379, db=0)

    base_price = 65000.0

    print("Starting data ingestion loop...")
    try:
        while True:
            # Simulate a realistic price variation (random walk)
            variation = random.uniform(-50, 50)
            base_price += variation

            # Simple RSI simulation (just random for mock)
            rsi = random.uniform(20, 80)

            data = {
                "symbol": "BTC",
                "price": round(base_price, 2),
                "rsi": round(rsi, 2),
                "timestamp": time.time()
            }

            # Publish the data to the 'crypto_prices' channel
            await r.publish("crypto_prices", json.dumps(data))

            # Print occasionally so we know it's working if run standalone
            if random.random() < 0.1:
                print(f"Published: {data}")

            # Simulate tick rate (e.g., 10 ticks per second)
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        print("Ingestion cancelled.")
    finally:
        await r.close()

if __name__ == "__main__":
    asyncio.run(simulate_data_ingestion())