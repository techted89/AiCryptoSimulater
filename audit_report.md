# Performance & Workflow Audit Report

## 1. Critical Fixes

| Component | Issue | Recommended Fix |
| :--- | :--- | :--- |
| **Logic & Error Handling** | `actor_agent.py` loops over the entire `l2_book` array ($O(N)$) multiple times inside `execute_trade` and `close_trade` which blocks the event loop for a highly volatile websocket feed. | Pre-calculate/cache `vwap` (Volume Weighted Average Price) asynchronously outside the trade loop or limit parsing to the top 5-10 depth levels instead of full iterations. |
| **Safety Checks** | `latest_market_state["price"]` and `l2_book` values are blindly passed to `execute_trade` and `evaluate_exits` without strict validation. | Implement `None` and type checking before executing logic to prevent runtime exceptions if the ingestor sends malformed or partial payloads. |
| **Frontend Render** | `TradingChart.tsx` state array size approaches `MAX_DATA_POINTS = 10000`, causing React to duplicate and render massive DOM elements inside Recharts with every 500ms tick. | Drop `MAX_DATA_POINTS` significantly (e.g. to 500) and use React Virtualization or a Canvas-based charting library (like Lightweight Charts) instead of SVG-based Recharts for high-density streaming. |
| **Dependency Risks** | `package.json` has deprecated dependencies that cause warnings during `npm install` and fail audits. | Explicitly remove legacy dependencies and manage `npm install --no-audit` to avoid destructive `npm audit fix --force` breakages by the user. |

## 2. Performance Wins

1. **WebSocket Transition:**
   The application currently utilizes WebSockets for the price feed (`/ws/prices`), but the state feed (`/ws/state`) recalculates the agent stats and database sizes globally inside an infinite `asyncio.sleep(1.0)` loop (`broadcast_state_task`).
   *Optimization:* Cache `db_size` calculations instead of querying ChromaDB via `run_in_threadpool` every 1 second for all connections.

2. **O(N) Bottlenecks:**
   In `app/research_agent.py`, `get_recent_snapshots` pulls `limit=1000` items from ChromaDB and sorts them locally: `snapshots.sort(key=lambda x: x["timestamp"], reverse=True)`.
   *Optimization:* Reduce the limit significantly (e.g., `limit=50`) or use ChromaDB's native filtering if supported to prevent severe I/O and CPU blocking.

3. **Deployment Improvements:**
   `start.sh` does not verify if Ollama is actively running. Since the Actor Agent requires it, the script should be updated to execute `curl -fsS "$OLLAMA_BASE_URL"` to confirm local inference is online before declaring the simulation "actively running".

4. **Component Modularization:**
   `TradingChart.tsx` should separate the heavy SVG elements (like `LineChart` and `ReferenceLine` markers) into memoized child components (`React.memo`).
