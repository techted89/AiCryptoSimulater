import re

with open("app/main.py", "r") as f:
    content = f.read()

ws_state_endpoint = """

# -----------------
# State WebSocket Endpoint
# -----------------
@app.websocket("/ws/state")
async def state_websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()
    print("Client connected to /ws/state")
    try:
        while True:
            # Gather state
            stats = actor_agent.get_stats(current_price=latest_market_state["price"])
            active = list(actor_agent.open_positions.values())
            history = actor_agent.mock_trades[-20:] # Last 20 closed

            data = {
                "stats": stats,
                "trades": {
                    "active": active,
                    "history": history
                }
            }

            await websocket.send_json(data)
            await asyncio.sleep(1.0) # Push state every 1 second

    except WebSocketDisconnect:
        print("Client disconnected from /ws/state")
    except Exception as e:
        print(f"State WebSocket Error: {e}")
    finally:
        WEBSOCKET_CONNECTIONS.dec()
        try:
            await websocket.close()
        except Exception:
            pass
"""

content = content.replace("# -----------------\n# REST API Endpoints\n# -----------------", ws_state_endpoint + "\n# -----------------\n# REST API Endpoints\n# -----------------")

with open("app/main.py", "w") as f:
    f.write(content)
