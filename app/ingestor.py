import os
import asyncio
import json
import random
import redis.asyncio as redis
import time

async def simulate_data_ingestion():
    # Connect to the local Redis instance
    r = redis.Redis(host=os.getenv('REDIS_HOST', 'localhost'), port=6379, db=0)

    base_price = 65000.0

    print("Starting data ingestion loop...")
    try:
        while True:
            # Simulate a realistic price variation (random walk)
            variation = random.uniform(-50, 50)
            base_price += variation

            # Simple RSI simulation (just random for mock)
            rsi = random.uniform(20, 80)

            # Additional Indicators Simulation
            mfi = random.uniform(20, 80)
            cmf = random.uniform(-1.0, 1.0)
            stoch_rsi = random.uniform(0, 100)
            tdi = random.uniform(30, 70)
            macd = random.uniform(-100, 100)
            obv = random.uniform(-10000, 10000)

            # Advanced Realism: Mock L2 Order Book, DXY, and SP500
            # Create a simple synthetic L2 order book structure
            spread = random.uniform(0.1, 2.0)
            best_bid = round(base_price - (spread / 2), 2)
            best_ask = round(base_price + (spread / 2), 2)

            bids = [[round(best_bid - i, 2), round(random.uniform(0.1, 5.0), 3)] for i in range(5)]
            asks = [[round(best_ask + i, 2), round(random.uniform(0.1, 5.0), 3)] for i in range(5)]

            # Mock Macro Indicators
            dxy = round(104.0 + random.uniform(-0.5, 0.5), 2)
            sp500 = round(5200.0 + random.uniform(-10, 10), 2)

            # Mock News Sentiment Flag
            sentiment = random.choice(["Neutral", "Neutral", "Neutral", "Bullish_News", "Bearish_News"])

            data = {
                "symbol": "BTC",
                "price": round(base_price, 2),
                "rsi": round(rsi, 2),
                "mfi": round(mfi, 2),
                "cmf": round(cmf, 2),
                "stoch_rsi": round(stoch_rsi, 2),
                "tdi": round(tdi, 2),
                "macd": round(macd, 2),
                "obv": round(obv, 2),
                "timestamp": time.time(),
                "order_book": {
                    "bids": bids,
                    "asks": asks
                },
                "macro": {
                    "dxy": dxy,
                    "sp500": sp500
                },
                "news_sentiment": sentiment
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