import os
import asyncio
import json
import random
import time
import redis.asyncio as redis
import ccxt.pro as ccxt

SYMBOL = 'BTC/USDT'
BASE_SYMBOL = 'BTC'

# Shared state to hold latest data before publishing
shared_state = {
    "symbol": BASE_SYMBOL,
    "price": None,
    "order_book": {
        "bids": [],
        "asks": []
    },
    "live": False
}

async def fetch_ticker(exchange):
    while True:
        try:
            ticker = await exchange.watch_ticker(SYMBOL)
            last_price = ticker.get('last')
            if last_price is not None:
                shared_state["price"] = last_price

            if shared_state["price"] is not None and shared_state["order_book"]["bids"] and shared_state["order_book"]["asks"]:
                shared_state["live"] = True

        except (ccxt.NetworkError, ccxt.RequestTimeout, ccxt.ExchangeNotAvailable) as e:
            print(f"Transient error in fetch_ticker: {e}")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Fatal error in fetch_ticker: {e}")
            raise e

async def fetch_order_book(exchange):
    while True:
        try:
            orderbook = await exchange.watch_order_book(SYMBOL, limit=5)
            shared_state["order_book"]["bids"] = orderbook.get('bids', [])
            shared_state["order_book"]["asks"] = orderbook.get('asks', [])

            if shared_state["price"] is not None and shared_state["order_book"]["bids"] and shared_state["order_book"]["asks"]:
                shared_state["live"] = True

        except (ccxt.NetworkError, ccxt.RequestTimeout, ccxt.ExchangeNotAvailable) as e:
            print(f"Transient error in fetch_order_book: {e}")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Fatal error in fetch_order_book: {e}")
            raise e

async def publish_data(r):
    print("Starting data ingestion loop...")
    try:
        while True:
            # Freshness guard using 'live' flag
            if not shared_state["live"]:
                await asyncio.sleep(0.1)
                continue

            # We still simulate the technical and macro indicators as requested,
            # but we use the real live price and real live L2 order book.

            # Simple RSI simulation (just random for mock)
            rsi = random.uniform(20, 80)

            # Additional Indicators Simulation
            mfi = random.uniform(20, 80)
            cmf = random.uniform(-1.0, 1.0)
            stoch_rsi = random.uniform(0, 100)
            tdi = random.uniform(30, 70)
            macd = random.uniform(-100, 100)
            obv = random.uniform(-10000, 10000)

            # Mock Macro Indicators
            dxy = round(104.0 + random.uniform(-0.5, 0.5), 2)
            sp500 = round(5200.0 + random.uniform(-10, 10), 2)

            # Mock News Sentiment Flag
            sentiment = random.choice(["Neutral", "Neutral", "Neutral", "Bullish_News", "Bearish_News"])

            data = {
                "symbol": BASE_SYMBOL,
                "price": round(shared_state["price"], 2),
                "rsi": round(rsi, 2),
                "mfi": round(mfi, 2),
                "cmf": round(cmf, 2),
                "stoch_rsi": round(stoch_rsi, 2),
                "tdi": round(tdi, 2),
                "macd": round(macd, 2),
                "obv": round(obv, 2),
                "timestamp": time.time(),
                "order_book": shared_state["order_book"],
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

async def simulate_data_ingestion():
    # Connect to the local Redis instance
    r = redis.Redis(host=os.environ.get('REDIS_HOST', 'localhost'), port=int(os.environ.get('REDIS_PORT', '6379')), db=int(os.environ.get('REDIS_DB', '0')))

    exchange = ccxt.binanceus()

    # Start async tasks to gather live ticker and order book data
    tasks = [
        asyncio.create_task(fetch_ticker(exchange)),
        asyncio.create_task(fetch_order_book(exchange)),
        asyncio.create_task(publish_data(r))
    ]

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        print("Tasks cancelled")
    finally:
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await exchange.close()
        await r.close()

if __name__ == "__main__":
    try:
        asyncio.run(simulate_data_ingestion())
    except KeyboardInterrupt:
        pass
