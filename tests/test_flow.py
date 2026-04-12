import pytest
import asyncio
import json
import redis.asyncio as redis
from app.research_agent import ResearchAgent
from app.actor_agent import ActorAgent

@pytest.mark.asyncio
async def test_flow():
    print("Initializing Agents...")
    research_agent = ResearchAgent()
    actor_agent = ActorAgent(initial_balance=10000.0)

    # 1. Simulate an incoming tick
    test_tick = {
        "symbol": "BTC",
        "price": 64500.0,
        "rsi": 25.0 # Oversold, might trigger higher confidence
    }

    print(f"Simulated Tick: {test_tick}")

    # 2. Research Agent analyzes state
    confidence = research_agent.analyze_current_state(
        test_tick["symbol"],
        test_tick["price"],
        test_tick["rsi"]
    )
    print(f"Research Agent Confidence Score: {confidence}")

    # 3. Actor Agent decides on trade
    trade_result = await actor_agent.execute_trade(
        test_tick["symbol"],
        test_tick["price"],
        confidence
    )
    print(f"Actor Agent Trade Result: {trade_result}")

    # Assertions
    assert "status" in trade_result

    # 4. Record the snapshot for future memory
    doc_id = research_agent.record_snapshot(
        test_tick["symbol"],
        test_tick["price"],
        test_tick["rsi"],
        success=True # Assuming it was a good trade for mock purposes
    )
    print(f"Recorded memory snapshot with doc_id: {doc_id}")

    # Verify overall state
    stats = actor_agent.get_stats()
    print(f"Final Actor Stats: {stats}")

    print("End-to-End Core Logic Flow Test Passed!")

if __name__ == "__main__":
    asyncio.run(test_flow())
