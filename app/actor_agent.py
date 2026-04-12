import uuid

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

    def check_risk(self, trade_amount: float, total_wallet_value: float) -> bool:
        """Risk check: Is the trade size > 5% of the mock wallet?"""
        max_allowed = total_wallet_value * 0.05
        if trade_amount > max_allowed:
            return False
        return True

    def execute_trade(self, symbol: str, price: float, confidence_score: float, total_wallet_value: float = None) -> dict:
        """Executes a mock trade based on confidence score."""
        if total_wallet_value is None:
            total_wallet_value = self.balance

        # Cap at 5% of wallet value to pass risk checks
        trade_fraction = min(0.05, confidence_score * 0.05)
        trade_amount = total_wallet_value * trade_fraction

        if trade_amount < 10.0 or trade_amount > self.balance:
            return {"status": "skipped", "reason": "Trade amount invalid"}

        if not self.check_risk(trade_amount, total_wallet_value):
            return {"status": "rejected", "reason": "Risk check failed"}

        self.balance -= trade_amount
        trade_id = str(uuid.uuid4())

        trade_record = {
            "id": trade_id,
            "symbol": symbol,
            "entry_price": price,
            "amount_usd": trade_amount,
            "tokens": trade_amount / price,
            "confidence": confidence_score,
            "status": "open"
        }

        self.open_positions[trade_id] = trade_record
        return trade_record

    def close_trade(self, trade_id: str, current_price: float) -> dict:
        """Closes an open mock trade."""
        if trade_id not in self.open_positions:
            return {"status": "error", "reason": "Trade not found"}

        trade = self.open_positions.pop(trade_id)
        exit_value = trade["tokens"] * current_price
        pnl = exit_value - trade["amount_usd"]

        self.balance += exit_value

        if pnl > 0:
            self.wins += 1
        else:
            self.losses += 1

        trade["exit_price"] = current_price
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
            "sharpe_ratio": sharpe_ratio
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