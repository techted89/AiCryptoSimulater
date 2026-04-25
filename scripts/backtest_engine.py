import asyncio
import json
import logging
import os
import sys

# Ensure project root is in PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.actor_agent import ActorAgent
from app.research_agent import ResearchAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backtest_engine")

async def run_backtest(data_file_path: str):
    """
    Streams static JSON historical dataset through the AI pipeline
    bypassing the live Redis ingestor.
    """
    if not os.path.exists(data_file_path):
        logger.error(f"Dataset not found at {data_file_path}")
        # Create a mock dataset for testing if none provided
        dataset = [
            {"symbol": "BTC", "price": 60000.0, "rsi": 25.0, "news_sentiment": "Bullish"},
            {"symbol": "BTC", "price": 61000.0, "rsi": 55.0, "news_sentiment": "Neutral"},
            {"symbol": "BTC", "price": 63000.0, "rsi": 75.0, "news_sentiment": "Bearish"},
            {"symbol": "BTC", "price": 62000.0, "rsi": 50.0, "news_sentiment": "Neutral"},
        ]
        with open("mock_history.json", "w") as f:
            json.dump(dataset, f)
        data_file_path = "mock_history.json"
        logger.info("Created mock_history.json for demonstration.")

    with open(data_file_path, "r") as f:
        dataset = json.load(f)

    logger.info("Initializing Agents for Backtest...")
    actor = ActorAgent(initial_balance=10000.0)
    researcher = ResearchAgent()

    for idx, tick in enumerate(dataset):
        logger.info(f"--- Processing Tick {idx+1}/{len(dataset)}: Price {tick['price']}, RSI {tick['rsi']} ---")

        # 1. Evaluate Exits for existing trades based on the new tick
        closed_trades = await actor.evaluate_exits(tick["price"], l2_book=None)
        if closed_trades:
            for ct in closed_trades:
                 if "memory_doc_id" in ct:
                     is_success = ct.get("pnl", 0) > 0
                     # Simulate synchronous block or proper awaiting in backtest
                     researcher.update_snapshot_success(ct["memory_doc_id"], is_success)

        # 2. Research Analysis
        conf = await researcher.analyze_current_state(
            symbol=tick.get("symbol", "BTC"),
            price=tick["price"],
            rsi=tick["rsi"],
            news=tick.get("news_sentiment", "Neutral")
        )

        # 3. Execution Phase
        if conf > 0.6: # Configurable threshold
            res = await actor.execute_trade(
                symbol=tick.get("symbol", "BTC"),
                price=tick["price"],
                confidence_score=conf
            )
            logger.info(f"Trade Execution: {res}")

            if res.get("status") == "open":
                # Record snapshot for RAG memory
                doc_id = researcher.record_snapshot(
                    symbol=tick.get("symbol", "BTC"),
                    price=tick["price"],
                    rsi=tick["rsi"],
                    news=tick.get("news_sentiment", "Neutral"),
                    success="pending"
                )
                actor.open_positions[res["id"]]["memory_doc_id"] = doc_id

    # Force close remaining positions at the last price to get final PnL
    final_price = dataset[-1]["price"] if dataset else 0
    for trade_id in list(actor.open_positions.keys()):
        await actor.close_trade(trade_id, final_price)

    stats = actor.get_stats(final_price)
    logger.info("=========================================")
    logger.info("          BACKTEST COMPLETE              ")
    logger.info("=========================================")
    logger.info(json.dumps(stats, indent=2))

if __name__ == "__main__":
    asyncio.run(run_backtest("historical_data.json"))
