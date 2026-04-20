import uuid

import random
import asyncio

class ActorAgent:
    def __init__(self, initial_balance=10000.0):
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.mock_trades = [] # History
        self.open_positions = {} # Currently active trades

        self.peak_wallet = initial_balance
        self.max_drawdown = 0.0
        self.wins = 0
        self.losses = 0
        self.circuit_breaker_active = False

    def check_risk(self, trade_amount: float, total_wallet_value: float) -> bool:
        """Risk check: Is the trade size > 5% of the mock wallet?"""
        max_allowed = total_wallet_value * 0.05
        if trade_amount > max_allowed:
            return False
        return True

    def calculate_funding(self):
        """Applies a mock funding rate to all open positions to simulate perpetual futures."""
        # E.g., Longs pay shorts 0.01% every 8 hours. Mocking as a simple flat drain for realism.
        funding_rate = 0.0001
        for trade_id, pos in self.open_positions.items():
            funding_fee = pos["amount_usd"] * funding_rate
            self.balance -= funding_fee
            if "funding_fees_paid" not in pos:
                pos["funding_fees_paid"] = 0.0
            pos["funding_fees_paid"] += funding_fee

    async def execute_trade(self, symbol: str, price: float, confidence_score: float, l2_book: dict = None, total_wallet_value: float = None) -> dict:
        """Executes a mock trade with latency simulation, L2-based slippage, and fees."""
        if self.circuit_breaker_active:
             return {"status": "rejected", "reason": "Circuit Breaker Active"}

        # Simulate network latency (20ms to 100ms)
        latency = random.uniform(0.02, 0.1)
        await asyncio.sleep(latency)

        if total_wallet_value is None:
            total_wallet_value = self.balance

        # Cap at 5% of wallet value to pass risk checks
        trade_fraction = min(0.05, confidence_score * 0.05)
        trade_amount = total_wallet_value * trade_fraction

        if trade_amount < 10.0 or trade_amount > self.balance:
            return {"status": "skipped", "reason": "Trade amount invalid"}

        if not self.check_risk(trade_amount, total_wallet_value):
            return {"status": "rejected", "reason": "Risk check failed"}

        # Advanced Realism: L2 Order Book Slippage Calculation
        if l2_book and "asks" in l2_book:
            # Calculate depth-weighted average price (DWAP)
            # We are buying, so we eat into the 'asks'
            remaining_usd = trade_amount
            total_tokens_bought = 0.0
            vwap_sum = 0.0

            for ask_price, ask_vol in l2_book["asks"]:
                if remaining_usd <= 0:
                    break
                available_usd_at_level = ask_price * ask_vol
                usd_to_take = min(remaining_usd, available_usd_at_level)
                tokens_to_take = usd_to_take / ask_price

                total_tokens_bought += tokens_to_take
                vwap_sum += usd_to_take
                remaining_usd -= usd_to_take

            if total_tokens_bought > 0:
                entry_price = vwap_sum / total_tokens_bought
                slippage_pct = (entry_price - price) / price
            else:
                slippage_pct = random.uniform(0.0001, 0.0005)
                entry_price = price * (1 + slippage_pct)
        else:
            # Fallback if no L2 book provided
            slippage_pct = random.uniform(0.0001, 0.0005)
            entry_price = price * (1 + slippage_pct)

        # Fee: 0.1% typical taker fee
        fee_usd = trade_amount * 0.001
        capital_deployed = trade_amount - fee_usd

        self.balance -= trade_amount
        trade_id = str(uuid.uuid4())

        trade_record = {
            "id": trade_id,
            "symbol": symbol,
            "quoted_price": price,
            "entry_price": entry_price,
            "slippage_pct": slippage_pct,
            "fee_usd": fee_usd,
            "amount_usd": trade_amount,
            "tokens": capital_deployed / entry_price,
            "confidence": confidence_score,
            "status": "open"
        }

        self.open_positions[trade_id] = trade_record
        return trade_record

    async def close_trade(self, trade_id: str, current_price: float, l2_book: dict = None) -> dict:
        """Closes an open mock trade with latency, L2 slippage, and fees."""
        if trade_id not in self.open_positions:
            return {"status": "error", "reason": "Trade not found"}

        # Prevent concurrent closure race conditions
        trade = self.open_positions.pop(trade_id, None)
        if trade is None:
            return {"status": "error", "reason": "Trade not found"}

        # Simulate network latency
        latency = random.uniform(0.02, 0.1)
        await asyncio.sleep(latency)

        # Realism: L2 Slippage on exit (Selling into bids)
        if l2_book and "bids" in l2_book:
            remaining_tokens = trade["tokens"]
            total_usd_received = 0.0

            for bid_price, bid_vol in l2_book["bids"]:
                if remaining_tokens <= 0:
                    break
                tokens_to_take = min(remaining_tokens, bid_vol)
                usd_gained = tokens_to_take * bid_price

                total_usd_received += usd_gained
                remaining_tokens -= tokens_to_take

            if trade["tokens"] > 0:
                exit_price = total_usd_received / trade["tokens"]
                slippage_pct = (current_price - exit_price) / current_price
            else:
                slippage_pct = random.uniform(0.0001, 0.0005)
                exit_price = current_price * (1 - slippage_pct)
        else:
            slippage_pct = random.uniform(0.0001, 0.0005)
            exit_price = current_price * (1 - slippage_pct)

        gross_exit_value = trade["tokens"] * exit_price
        exit_fee = gross_exit_value * 0.001 # 0.1% fee
        net_exit_value = gross_exit_value - exit_fee

        pnl = net_exit_value - trade["amount_usd"]

        self.balance += net_exit_value

        if pnl > 0:
            self.wins += 1
        else:
            self.losses += 1

        trade["exit_price"] = exit_price
        trade["exit_fee_usd"] = exit_fee
        trade["pnl"] = pnl
        trade["status"] = "closed"

        self.mock_trades.append(trade)
        return trade

    def update_mdd(self, current_wallet_value: float):
        if current_wallet_value > self.peak_wallet:
            self.peak_wallet = current_wallet_value
        drawdown = (self.peak_wallet - current_wallet_value) / self.peak_wallet
        if drawdown > self.max_drawdown:
            self.max_drawdown = drawdown

        # Senior Reliability: Circuit Breaker Logic
        if self.max_drawdown >= 0.15:
            self.circuit_breaker_active = True

    def get_stats(self, current_price: float = None) -> dict:
        """Returns mock agent statistics including active PnL."""
        active_value = 0.0
        active_pnl = 0.0

        if current_price is not None:
            for pos in self.open_positions.values():
                val = pos["tokens"] * current_price
                active_value += val
                active_pnl += (val - pos["amount_usd"])

        total_wallet = self.balance + active_value
        self.update_mdd(total_wallet)

        win_rate = 0.0
        total_closed = self.wins + self.losses
        if total_closed > 0:
            win_rate = (self.wins / total_closed) * 100

        # Mock Sharpe Ratio based on win rate and profitability
        sharpe_ratio = 0.0
        if total_closed > 0:
            avg_return = (total_wallet - self.initial_balance) / total_closed
            # simplified mock sharpe
            sharpe_ratio = avg_return / 10.0 if avg_return > 0 else avg_return / 5.0

        return {
            "balance": self.balance,
            "wallet_value": total_wallet,
            "floating_pnl": active_pnl,
            "open_positions": len(self.open_positions),
            "total_closed_trades": total_closed,
            "win_rate": win_rate,
            "max_drawdown": self.max_drawdown * 100,
            "sharpe_ratio": sharpe_ratio,
            "circuit_breaker_active": self.circuit_breaker_active
        }

if __name__ == "__main__":
    actor = ActorAgent()
    print("Initial stats:", actor.get_stats())

    # Simulate a high confidence trade
    result = actor.execute_trade("BTC", 65000, 0.9)
    print("Trade result:", result)
    print("Post-trade stats:", actor.get_stats())

    # Simulate a low confidence trade that gets skipped
    result = actor.execute_trade("BTC", 65000, 0.01)
    print("Low conf trade result:", result)