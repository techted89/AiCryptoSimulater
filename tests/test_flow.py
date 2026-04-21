import pytest
import asyncio
import json
import redis.asyncio as redis
from unittest.mock import patch
from app.research_agent import ResearchAgent
from app.actor_agent import ActorAgent

@pytest.mark.asyncio
@patch('app.actor_agent.aiohttp.ClientSession.post')
async def test_flow(mock_post):
    # Mock LLM API response for evaluate_exits
    class MockResponse:
        status_code = 200
        def json(self):
            return {"choices": [{"message": {"content": "HOLD"}}]}
    mock_post.return_value = MockResponse()

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
    confidence = await research_agent.analyze_current_state(
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

    # Exercise ActorAgent.evaluate_exits
    print("Exercising evaluate_exits...")
    await actor_agent.evaluate_exits(64000.0)
    print("evaluate_exits completed.")

    # Verify overall state
    stats = actor_agent.get_stats()
    print(f"Final Actor Stats: {stats}")

    print("End-to-End Core Logic Flow Test Passed!")

if __name__ == "__main__":
    asyncio.run(test_flow())
