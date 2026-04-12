class ActorAgent:
    def __init__(self, initial_balance=10000.0):
        self.balance = initial_balance
        self.mock_trades = []

    def check_risk(self, trade_amount: float) -> bool:
        """Risk check: Is the trade size > 5% of the mock wallet?"""
        max_allowed = self.balance * 0.05
        if trade_amount > max_allowed:
            return False
        return True

    def execute_trade(self, symbol: str, price: float, confidence_score: float) -> dict:
        """Executes a mock trade based on confidence score."""

        # Determine trade size based on confidence (higher confidence = slightly larger trade)
        # Cap at 5% of balance to pass risk checks
        trade_fraction = min(0.05, confidence_score * 0.05)
        trade_amount = self.balance * trade_fraction

        if trade_amount < 10.0: # Minimum trade amount
            return {"status": "skipped", "reason": "Trade amount too small"}

        if not self.check_risk(trade_amount):
            return {"status": "rejected", "reason": "Risk check failed"}

        # For simplicity, we just assume a long position.
        # Record the trade. In a real sim, you'd track the entry price and calc PnL later.
        self.balance -= trade_amount # Simulating locking in the funds

        trade_record = {
            "symbol": symbol,
            "entry_price": price,
            "amount_usd": trade_amount,
            "confidence": confidence_score,
            "status": "executed"
        }

        self.mock_trades.append(trade_record)
        return trade_record

    def get_stats(self) -> dict:
        """Returns mock agent statistics."""
        return {
            "balance": self.balance,
            "total_trades": len(self.mock_trades)
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